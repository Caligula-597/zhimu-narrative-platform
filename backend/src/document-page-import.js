import { createHash } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import {
  cleanupStoredObjects,
  prepareWorldAssetUpload,
  registerPreparedWorldAsset,
  uploadWorldAssetFromBuffer
} from "./asset-upload-helpers.js";
import {
  loadPdfDocument,
  renderPdfPageToPng,
  pdfPageImportMaxPages,
  pdfPageRenderScale,
  isPdfTextSufficient,
  extractPdfTextFromDocument
} from "./pdf-document.js";
import { buildPagesSectionMetadata, PAGES_BODY_PLACEHOLDER } from "./section-content.js";
import { MAX_DOCUMENT_BYTES } from "./document-parser.js";
import { createStorageQuotaReservation } from "./quota-guards.js";
import {
  ensureDocumentCharacterScript,
  findImportedDocumentSection,
  insertDocumentSections,
  lockDocumentRole
} from "./repositories/creator-document-repository.js";

function baseName(filename) {
  return String(filename ?? "导入文档").replace(/\.[^.]+$/, "") || "导入文档";
}

function contentHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function runWithClient(client, work) {
  return client ? work(client) : transaction(work);
}

export async function detectPdfImportMode(buffer) {
  const doc = await loadPdfDocument(buffer);
  const textResult = await extractPdfTextFromDocument(doc);
  if (isPdfTextSufficient(textResult.text, textResult.pageCount)) {
    return { mode: "text", pageCount: textResult.pageCount };
  }
  return { mode: "pages", pageCount: textResult.pageCount };
}

export async function renderPdfPageBuffers(buffer, { maxPages = null, scale = null } = {}) {
  const doc = await loadPdfDocument(buffer);
  const limit = maxPages ?? pdfPageImportMaxPages();
  if (doc.numPages > limit) {
    throwErr("PDF_PAGE_IMPORT_LIMIT", `PDF has ${doc.numPages} pages; import limit is ${limit}`);
  }
  const renderScale = scale ?? pdfPageRenderScale();
  const pages = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const png = await renderPdfPageToPng(page, renderScale);
    pages.push({ pageNumber, buffer: png, contentType: "image/png" });
  }
  return { pageCount: doc.numPages, pages };
}

export async function preparePdfPageAssetUploads({
  worldId,
  actorId,
  roleSlotId,
  filename,
  pages,
  quotaReservation = null
}) {
  const stem = baseName(filename);
  const preparedAssets = [];
  const reservation = quotaReservation ?? await createStorageQuotaReservation(actorId);
  try {
    for (const page of pages) {
      preparedAssets.push(await prepareWorldAssetUpload({
        actorId,
        worldId,
        roleSlotId,
        filename: `${stem}-p${page.pageNumber}.png`,
        buffer: page.buffer,
        contentType: page.contentType,
        visibility: "role",
        assetKind: "image",
        quotaReservation: reservation
      }));
    }
    return preparedAssets;
  } catch (error) {
    await cleanupStoredObjects(preparedAssets.map((asset) => asset.objectKey));
    throw error;
  }
}

export function prepareImagePageAssetUpload({ worldId, actorId, roleSlotId, filename, buffer, contentType }) {
  return prepareWorldAssetUpload({
    actorId,
    worldId,
    roleSlotId,
    filename,
    buffer,
    contentType: contentType || "image/jpeg",
    visibility: "role",
    assetKind: "image"
  });
}

export async function importPdfPagesToRoleScript({
  worldId,
  actorId,
  roleSlotId,
  filename,
  buffer,
  title = null,
  publicationStatus = "draft",
  layout = "single_section",
  renderedPages = null,
  preparedAssets = null,
  onAssetUploaded = null,
  client: existingClient = null
}) {
  if (!buffer?.length || buffer.length > MAX_DOCUMENT_BYTES) throwErr("DOCUMENT_SIZE_INVALID");
  const { pageCount, pages } = renderedPages ?? await renderPdfPageBuffers(buffer);
  const stem = baseName(filename);
  const importKey = `pdf-pages:sha256:${contentHash(buffer)}`;
  const legacyImportKey = `pdf-pages:${stem}:${pageCount}:${buffer.length}`;
  const uploadedObjectKeys = [];
  if (preparedAssets && preparedAssets.length !== pages.length) {
    throw new Error("Prepared PDF asset count does not match rendered page count");
  }

  try {
    return await runWithClient(existingClient, async (client) => {
      const role = await lockDocumentRole(client, { worldId, roleSlotId });
      const existing = await findImportedDocumentSection(client, {
        roleSlotId,
        importKeys: [importKey, legacyImportKey],
        includePageChildren: true
      });
      if (existing) {
        return {
          skipped: true,
          reason: "duplicate_import",
          sectionId: existing.id,
          pageCount,
          layout
        };
      }

      const scriptId = await ensureDocumentCharacterScript(client, roleSlotId);
      const pageAssetIds = [];
      for (const [index, page] of pages.entries()) {
        const uploaded = preparedAssets
          ? await registerPreparedWorldAsset(client, preparedAssets[index])
          : await uploadWorldAssetFromBuffer(client, {
              actorId,
              worldId,
              roleSlotId,
              filename: `${stem}-p${page.pageNumber}.png`,
              buffer: page.buffer,
              contentType: page.contentType,
              visibility: "role",
              assetKind: "image"
            });
        uploadedObjectKeys.push(uploaded.objectKey);
        onAssetUploaded?.(uploaded);
        pageAssetIds.push(uploaded.assetId);
      }

      const sections = layout === "one_section_per_page"
        ? pageAssetIds.map((assetId, index) => ({
            title: pageAssetIds.length > 1 ? `${stem} - 第 ${index + 1} 页` : stem,
            body: PAGES_BODY_PLACEHOLDER,
            metadata: buildPagesSectionMetadata({
              pageAssetIds: [assetId],
              sourceFilename: filename,
              pageCount: 1,
              importKey: `${importKey}:page:${index + 1}`
            })
          }))
        : [{
            title: title?.trim() || stem,
            body: PAGES_BODY_PLACEHOLDER,
            metadata: buildPagesSectionMetadata({
              pageAssetIds,
              sourceFilename: filename,
              pageCount,
              importKey
            })
          }];
      const createdSections = await insertDocumentSections(client, {
        scriptId,
        roleSlotId,
        publicationStatus,
        sections
      });
      return {
        skipped: false,
        roleName: role.name,
        pageCount,
        pageAssetIds,
        sections: createdSections,
        layout
      };
    });
  } catch (error) {
    if (!preparedAssets) await cleanupStoredObjects(uploadedObjectKeys);
    throw error;
  }
}

export async function importImageFileToRoleSection({
  worldId,
  actorId,
  roleSlotId,
  filename,
  buffer,
  contentType,
  title = null,
  publicationStatus = "draft",
  preparedAsset = null,
  onAssetUploaded = null,
  client: existingClient = null
}) {
  if (!buffer?.length || buffer.length > MAX_DOCUMENT_BYTES) throwErr("DOCUMENT_SIZE_INVALID");
  const stem = baseName(filename);
  const importKey = `image-page:sha256:${contentHash(buffer)}`;
  const legacyImportKey = `image-page:${stem}:${buffer.length}`;
  const uploadedObjectKeys = [];

  try {
    return await runWithClient(existingClient, async (client) => {
      const role = await lockDocumentRole(client, { worldId, roleSlotId });
      const existing = await findImportedDocumentSection(client, {
        roleSlotId,
        importKeys: [importKey, legacyImportKey]
      });
      if (existing) {
        return { skipped: true, reason: "duplicate_import", sectionId: existing.id, pageCount: 1 };
      }

      const uploaded = preparedAsset
        ? await registerPreparedWorldAsset(client, preparedAsset)
        : await uploadWorldAssetFromBuffer(client, {
            actorId,
            worldId,
            roleSlotId,
            filename,
            buffer,
            contentType: contentType || "image/jpeg",
            visibility: "role",
            assetKind: "image"
          });
      uploadedObjectKeys.push(uploaded.objectKey);
      onAssetUploaded?.(uploaded);

      const scriptId = await ensureDocumentCharacterScript(client, roleSlotId);
      const metadata = buildPagesSectionMetadata({
        pageAssetIds: [uploaded.assetId],
        sourceFilename: filename,
        pageCount: 1,
        importKey
      });
      const sections = await insertDocumentSections(client, {
        scriptId,
        roleSlotId,
        publicationStatus,
        sections: [{
          title: title?.trim() || stem,
          body: PAGES_BODY_PLACEHOLDER,
          metadata
        }]
      });
      return {
        skipped: false,
        roleName: role.name,
        pageCount: 1,
        pageAssetIds: [uploaded.assetId],
        sections,
        layout: "single_section"
      };
    });
  } catch (error) {
    if (!preparedAsset) await cleanupStoredObjects(uploadedObjectKeys);
    throw error;
  }
}
