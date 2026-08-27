import { sendErr, throwErr } from "./api-errors.js";
import { cleanupStoredObjects } from "./asset-upload-helpers.js";
import { transaction } from "./db.js";
import { decodeDocumentBuffer, parseCreatorDocument } from "./document-parser.js";
import { importStructuredCreatorDocumentWithClient } from "./creator-document-structure-service.js";
import { loadFeishuDocumentText } from "./feishu-document-client.js";
import { runDocumentProcessing } from "./document-processing-guard.js";
import { reviewCreatorDocument } from "./document-ai-review-service.js";
import {
  importImageFileToRoleSection,
  importPdfPagesToRoleScript,
  prepareImagePageAssetUpload,
  preparePdfPageAssetUploads,
  renderPdfPageBuffers
} from "./document-page-import.js";
import {
  configureCreatorDocumentTransaction,
  ensureDocumentCharacterScript,
  insertDocumentSections,
  lockDocumentEditor,
  lockDocumentRole,
  upsertStoryManuscript
} from "./repositories/creator-document-repository.js";
import {
  assertWorldRevisionMatch,
  parseIfMatch,
  runRevisionMutation
} from "./world-revision.js";

const IMAGE_CONTENT_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"]
]);

function fileExtension(filename) {
  return String(filename ?? "").toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

function hasExpectedSignature(buffer, extension) {
  if (extension === ".pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if ([".jpg", ".jpeg"].includes(extension)) {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (extension === ".png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === ".gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (extension === ".webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function normalizeParsedSections(document) {
  const sections = Array.isArray(document?.sections) ? document.sections : [];
  if (!sections.length || sections.length > 80) throwErr("DOCUMENT_EMPTY");
  return sections.map((section) => {
    const title = String(section?.title ?? "").trim();
    const body = String(section?.body ?? "").trim();
    if (!title || !body) throwErr("DOCUMENT_EMPTY");
    return {
      title,
      body,
      metadata: {
        source: "document_import",
        filename: String(document?.filename ?? "").trim()
      }
    };
  });
}

function pageImportResponse(result) {
  return {
    target: "role_script_pages",
    skipped: result.skipped,
    pageCount: result.pageCount,
    sections: result.sections,
    layout: result.layout ?? "single_section"
  };
}

export async function parseCreatorDocumentForWorld(payload) {
  if (payload?.rightsConfirmed !== true) throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
  const parsed = await runDocumentProcessing(() => parseCreatorDocument(payload ?? {}));
  const aiDocumentReview = await reviewCreatorDocument({
    text: parsed?.text ?? "",
    filename: parsed?.filename ?? "",
    creationType: payload?.creationType
  });
  return { ...parsed, aiDocumentReview };
}

export async function parseFeishuDocumentForWorld(payload) {
  if (payload?.rightsConfirmed !== true) throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
  const feishu = await runDocumentProcessing(() => loadFeishuDocumentText({
    url: payload?.url,
    creationType: payload?.creationType
  }));
  const aiDocumentReview = await reviewCreatorDocument({
    text: feishu?.text ?? "",
    filename: feishu?.filename ?? "feishu.docx",
    creationType: payload?.creationType
  });
  return { ...feishu, aiDocumentReview };
}

export async function importParsedCreatorDocument({ request, reply, actorId, worldId, payload }) {
  if (payload?.rightsConfirmed !== true) throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
  const target = payload?.target ?? "manuscript";
  const document = payload?.document ?? {};
  if (target === "structured") {
    return runRevisionMutation(request, reply, worldId, async (client) => {
      await lockDocumentEditor(client, { worldId, actorId });
      return importStructuredCreatorDocumentWithClient(client, {
        worldId,
        actorId,
        document,
        creationType: payload?.creationType,
        rightsConfirmed: payload?.rightsConfirmed
      });
    }, {
      sendErr,
      statusCode: 201,
      configureClient: configureCreatorDocumentTransaction,
      shouldBumpRevision: (result) => result.changed
    });
  }
  if (target === "manuscript") {
    const text = String(document.text ?? "");
    if (!text.trim()) throwErr("DOCUMENT_EMPTY");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      await lockDocumentEditor(client, { worldId, actorId });
      await upsertStoryManuscript(client, { worldId, actorId, body: text });
      return { target, sections: Array.isArray(document.sections) ? document.sections.length : 0 };
    }, {
      sendErr,
      statusCode: 201,
      configureClient: configureCreatorDocumentTransaction
    });
  }

  const roleSlotId = payload?.roleSlotId;
  if (!roleSlotId) throwErr("ROLE_SLOT_IMPORT_REQUIRED");
  const sections = normalizeParsedSections(document);
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await lockDocumentEditor(client, { worldId, actorId });
    await lockDocumentRole(client, { worldId, roleSlotId });
    const scriptId = await ensureDocumentCharacterScript(client, roleSlotId);
    const inserted = await insertDocumentSections(client, {
      scriptId,
      roleSlotId,
      sections,
      publicationStatus: "draft"
    });
    return { target: "role_script", sections: inserted.length };
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureCreatorDocumentTransaction
  });
}

export async function importCreatorDocumentPages({ request, reply, actorId, worldId, payload }) {
  if (payload?.rightsConfirmed !== true) throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
  const roleSlotId = payload?.roleSlotId;
  if (!roleSlotId) throwErr("ROLE_SLOT_IMPORT_REQUIRED");
  const filename = String(payload?.filename ?? "").trim();
  const extension = fileExtension(filename);
  if (extension !== ".pdf" && !IMAGE_CONTENT_TYPES.has(extension)) {
    throwErr("DOCUMENT_TYPE_UNSUPPORTED");
  }
  const buffer = decodeDocumentBuffer(payload);
  if (!hasExpectedSignature(buffer, extension)) {
    throwErr("DOCUMENT_TYPE_UNSUPPORTED", "Document content does not match its filename extension");
  }
  const layout = payload?.layout === "one_section_per_page" ? "one_section_per_page" : "single_section";
  const publicationStatus = ["draft", "testing", "published"].includes(payload?.publicationStatus)
    ? payload.publicationStatus
    : "draft";

  await transaction(async (client) => {
    await configureCreatorDocumentTransaction(client);
    await lockDocumentEditor(client, { worldId, actorId });
    await lockDocumentRole(client, { worldId, roleSlotId });
  });
  const expectedRevision = parseIfMatch(request);
  await assertWorldRevisionMatch(worldId, expectedRevision);
  let renderedPages = null;
  if (extension === ".pdf") {
    renderedPages = await runDocumentProcessing(() => renderPdfPageBuffers(buffer));
  }

  const preparedAssets = extension === ".pdf"
    ? await preparePdfPageAssetUploads({
        worldId,
        actorId,
        roleSlotId,
        filename,
        pages: renderedPages.pages
      })
    : [await prepareImagePageAssetUpload({
        worldId,
        actorId,
        roleSlotId,
        filename,
        buffer,
        contentType: IMAGE_CONTENT_TYPES.get(extension)
      })];
  const uploadedObjectKeys = preparedAssets.map((asset) => asset.objectKey);
  const onRollback = () => cleanupStoredObjects(uploadedObjectKeys);

  const response = await runRevisionMutation(request, reply, worldId, async (client) => {
    await lockDocumentEditor(client, { worldId, actorId });
    const result = extension === ".pdf"
      ? await importPdfPagesToRoleScript({
          worldId,
          actorId,
          roleSlotId,
          filename,
          buffer,
          title: payload?.title,
          publicationStatus,
          layout,
          renderedPages,
          preparedAssets,
          client
        })
      : await importImageFileToRoleSection({
          worldId,
          actorId,
          roleSlotId,
          filename,
          buffer,
          contentType: IMAGE_CONTENT_TYPES.get(extension),
          title: payload?.title,
          publicationStatus,
          preparedAsset: preparedAssets[0],
          client
        });
    return pageImportResponse(result);
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureCreatorDocumentTransaction,
    shouldBumpRevision: (result) => !result.skipped,
    onRollback
  });
  if (response?.skipped) await cleanupStoredObjects(uploadedObjectKeys);
  return response;
}
