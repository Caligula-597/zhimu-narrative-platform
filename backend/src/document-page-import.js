import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import { uploadWorldAssetFromBuffer } from "./asset-upload-helpers.js";
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

function baseName(filename) {
  return String(filename ?? "导入文档").replace(/\.[^.]+$/, "") || "导入文档";
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
  client: existingClient = null
}) {
  if (!buffer?.length || buffer.length > MAX_DOCUMENT_BYTES) throwErr("DOCUMENT_SIZE_INVALID");
  const role = await runWithClient(existingClient, async (client) => {
    const roleRow = await client.query(
      `SELECT rs.id, rs.name FROM role_slots rs WHERE rs.id = $1 AND rs.world_id = $2`,
      [roleSlotId, worldId]
    );
    if (!roleRow.rowCount) throwErr("ROLE_SLOT_IMPORT_REQUIRED");
    return roleRow.rows[0];
  });

  const { pageCount, pages } = renderedPages ?? await renderPdfPageBuffers(buffer);
  const stem = baseName(filename);
  const importKey = `pdf-pages:${stem}:${pageCount}:${buffer.length}`;

  return runWithClient(existingClient, async (client) => {
    const existing = await client.query(
      `SELECT ss.id FROM script_sections ss
       WHERE ss.role_slot_id = $1 AND ss.metadata->>'importKey' = $2
       LIMIT 1`,
      [roleSlotId, importKey]
    );
    if (existing.rowCount) {
      return { skipped: true, reason: "duplicate_import", sectionId: existing.rows[0].id, pageCount };
    }

    const script = await client.query(
      `INSERT INTO character_scripts (role_slot_id, title)
       SELECT $1, '角色私人剧本'
       WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
       RETURNING id`,
      [roleSlotId]
    );
    const scriptId =
      script.rows[0]?.id ??
      (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId]))
        .rows[0].id;

    const pageAssetIds = [];
    for (const page of pages) {
      const uploaded = await uploadWorldAssetFromBuffer(client, {
        actorId,
        worldId,
        roleSlotId,
        filename: `${stem}-p${page.pageNumber}.png`,
        buffer: page.buffer,
        contentType: page.contentType,
        visibility: "role",
        assetKind: "image"
      });
      pageAssetIds.push(uploaded.assetId);
    }

    const maxSeq = await client.query(
      `SELECT COALESCE(MAX(sequence), 0)::int AS value FROM script_sections WHERE character_script_id = $1`,
      [scriptId]
    );
    let nextSequence = maxSeq.rows[0].value;

    const createdSections = [];

    if (layout === "one_section_per_page") {
      for (let index = 0; index < pageAssetIds.length; index += 1) {
        nextSequence += 1;
        const sectionTitle = pageAssetIds.length > 1 ? `${stem} - 第 ${index + 1} 页` : stem;
        const metadata = buildPagesSectionMetadata({
          pageAssetIds: [pageAssetIds[index]],
          sourceFilename: filename,
          pageCount: 1,
          importKey: `${importKey}:page:${index + 1}`
        });
        const inserted = await client.query(
          `INSERT INTO script_sections
            (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
           RETURNING id, title, sequence, metadata`,
          [scriptId, roleSlotId, sectionTitle, PAGES_BODY_PLACEHOLDER, nextSequence, publicationStatus, JSON.stringify(metadata)]
        );
        createdSections.push(inserted.rows[0]);
      }
    } else {
      nextSequence += 1;
      const sectionTitle = title?.trim() || stem;
      const metadata = buildPagesSectionMetadata({
        pageAssetIds,
        sourceFilename: filename,
        pageCount,
        importKey
      });
      const inserted = await client.query(
        `INSERT INTO script_sections
          (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id, title, sequence, metadata`,
        [scriptId, roleSlotId, sectionTitle, PAGES_BODY_PLACEHOLDER, nextSequence, publicationStatus, JSON.stringify(metadata)]
      );
      createdSections.push(inserted.rows[0]);
    }

    return {
      skipped: false,
      roleName: role.name,
      pageCount,
      pageAssetIds,
      sections: createdSections,
      layout
    };
  });
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
  client: existingClient = null
}) {
  if (!buffer?.length || buffer.length > MAX_DOCUMENT_BYTES) throwErr("DOCUMENT_SIZE_INVALID");
  const stem = baseName(filename);
  const importKey = `image-page:${stem}:${buffer.length}`;

  return runWithClient(existingClient, async (client) => {
    const roleRow = await client.query(
      `SELECT rs.id, rs.name FROM role_slots rs WHERE rs.id = $1 AND rs.world_id = $2`,
      [roleSlotId, worldId]
    );
    if (!roleRow.rowCount) throwErr("ROLE_SLOT_IMPORT_REQUIRED");

    const existing = await client.query(
      `SELECT ss.id FROM script_sections ss
       WHERE ss.role_slot_id = $1 AND ss.metadata->>'importKey' = $2 LIMIT 1`,
      [roleSlotId, importKey]
    );
    if (existing.rowCount) {
      return { skipped: true, reason: "duplicate_import", sectionId: existing.rows[0].id };
    }

    const uploaded = await uploadWorldAssetFromBuffer(client, {
      actorId,
      worldId,
      roleSlotId,
      filename,
      buffer,
      contentType: contentType || "image/jpeg",
      visibility: "role",
      assetKind: "image"
    });

    const script = await client.query(
      `INSERT INTO character_scripts (role_slot_id, title)
       SELECT $1, '角色私人剧本'
       WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
       RETURNING id`,
      [roleSlotId]
    );
    const scriptId =
      script.rows[0]?.id ??
      (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId]))
        .rows[0].id;

    const maxSeq = await client.query(
      `SELECT COALESCE(MAX(sequence), 0)::int AS value FROM script_sections WHERE character_script_id = $1`,
      [scriptId]
    );
    const metadata = buildPagesSectionMetadata({
      pageAssetIds: [uploaded.assetId],
      sourceFilename: filename,
      pageCount: 1,
      importKey
    });
    const inserted = await client.query(
      `INSERT INTO script_sections
        (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, title, sequence, metadata`,
      [
        scriptId,
        roleSlotId,
        title?.trim() || stem,
        PAGES_BODY_PLACEHOLDER,
        maxSeq.rows[0].value + 1,
        publicationStatus,
        JSON.stringify(metadata)
      ]
    );

    return {
      skipped: false,
      roleName: roleRow.rows[0].name,
      pageCount: 1,
      pageAssetIds: [uploaded.assetId],
      sections: [inserted.rows[0]]
    };
  });
}
