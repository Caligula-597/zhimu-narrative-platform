import mammoth from "mammoth";
import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import { cleanText, splitSections } from "./document-parser.js";
import { detectPdfContentMode, extractTextFromPdfBuffer } from "./pdf-document.js";
import { buildPagesSectionMetadata, PAGES_BODY_PLACEHOLDER } from "./section-content.js";
import { uploadWorldAssetFromBuffer } from "./asset-upload-helpers.js";
import { renderPdfPageBuffers } from "./document-page-import.js";

function baseName(filename) {
  return String(filename ?? "导入文档").replace(/\.[^.]+$/, "") || "导入文档";
}

async function ensureCharacterScriptId(client, roleSlotId) {
  const script = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title)
     SELECT $1, '角色私人剧本'
     WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
     RETURNING id`,
    [roleSlotId]
  );
  if (script.rowCount) return script.rows[0].id;
  return (
    await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId])
  ).rows[0].id;
}

export async function extractDocumentText(buffer, filename) {
  const extension = String(filename ?? "").toLowerCase().match(/\.[^.]+$/)?.[0];
  if ([".txt", ".md", ".markdown"].includes(extension)) return cleanText(buffer.toString("utf8"));
  if (extension === ".docx") return cleanText((await mammoth.extractRawText({ buffer })).value);
  if (extension === ".pdf") {
    const detected = await detectPdfContentMode(buffer);
    if (detected.mode === "pages") return null;
    const pdf = await extractTextFromPdfBuffer(buffer, { allowOcr: false });
    return cleanText(pdf.text);
  }
  throwErr("DOCUMENT_TYPE_UNSUPPORTED");
}

export async function appendStoryManuscript(client, worldId, actorId, text, sourceLabel) {
  const cleaned = cleanText(text);
  if (!cleaned) return { appended: false };
  const header = sourceLabel ? `## ${sourceLabel}\n\n` : "";
  await client.query(
    `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
     VALUES ($1, $2, 'manual', $3)
     ON CONFLICT (world_id) DO UPDATE
     SET body = CASE
           WHEN story_manuscripts.body = '' THEN EXCLUDED.body
           ELSE story_manuscripts.body || E'\n\n---\n\n' || EXCLUDED.body
         END,
         last_sync_direction = 'manual',
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()`,
    [worldId, `${header}${cleaned}`, actorId]
  );
  return { appended: true, characters: cleaned.length };
}

export async function importTextSectionsToRole({
  worldId,
  actorId,
  roleSlotId,
  filename,
  buffer,
  title = null,
  publicationStatus = "draft",
  importKey
}) {
  const text = await extractDocumentText(buffer, filename);
  if (!text) return { mode: "needs_pages", skipped: false };
  const sections = splitSections(text).slice(0, 80);
  if (!sections.length) throwErr("DOCUMENT_EMPTY");

  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM script_sections WHERE role_slot_id = $1 AND metadata->>'importKey' = $2 LIMIT 1`,
      [roleSlotId, importKey]
    );
    if (existing.rowCount) return { skipped: true, reason: "duplicate_import", sectionId: existing.rows[0].id, mode: "text" };

    const scriptId = await ensureCharacterScriptId(client, roleSlotId);
    const maxSeq = await client.query(
      `SELECT COALESCE(MAX(sequence), 0)::int AS value FROM script_sections WHERE character_script_id = $1`,
      [scriptId]
    );
    let sequence = maxSeq.rows[0].value;
    const created = [];
    for (const [index, section] of sections.entries()) {
      sequence += 1;
      const inserted = await client.query(
        `INSERT INTO script_sections
          (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         RETURNING id, title, sequence`,
        [
          scriptId,
          roleSlotId,
          section.title || title || baseName(filename),
          section.body,
          sequence,
          publicationStatus,
          JSON.stringify({ source: "script_bundle", filename, importKey: `${importKey}:section:${index + 1}` })
        ]
      );
      created.push(inserted.rows[0]);
    }
    return { skipped: false, mode: "text", sections: created, sectionCount: created.length };
  });
}

export async function importPdfPagesToRoleWithKey({
  worldId,
  actorId,
  roleSlotId,
  filename,
  buffer,
  title = null,
  publicationStatus = "draft",
  layout = "single_section",
  importKey
}) {
  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM script_sections WHERE role_slot_id = $1 AND metadata->>'importKey' = $2 LIMIT 1`,
      [roleSlotId, importKey]
    );
    if (existing.rowCount) return { skipped: true, reason: "duplicate_import", sectionId: existing.rows[0].id, mode: "pages" };

    const { pageCount, pages } = await renderPdfPageBuffers(buffer);
    const stem = title?.trim() || baseName(filename);
    const scriptId = await ensureCharacterScriptId(client, roleSlotId);
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
        const sectionTitle = pageAssetIds.length > 1 ? `${stem} · 第 ${index + 1} 页` : stem;
        const metadata = buildPagesSectionMetadata({
          pageAssetIds: [pageAssetIds[index]],
          sourceFilename: filename,
          pageCount: 1,
          importKey: `${importKey}:page:${index + 1}`
        });
        const inserted = await client.query(
          `INSERT INTO script_sections
            (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
           RETURNING id, title, sequence`,
          [scriptId, roleSlotId, sectionTitle, PAGES_BODY_PLACEHOLDER, nextSequence, publicationStatus, JSON.stringify(metadata)]
        );
        createdSections.push(inserted.rows[0]);
      }
    } else {
      nextSequence += 1;
      const metadata = buildPagesSectionMetadata({
        pageAssetIds,
        sourceFilename: filename,
        pageCount,
        importKey
      });
      const inserted = await client.query(
        `INSERT INTO script_sections
          (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         RETURNING id, title, sequence`,
        [scriptId, roleSlotId, stem, PAGES_BODY_PLACEHOLDER, nextSequence, publicationStatus, JSON.stringify(metadata)]
      );
      createdSections.push(inserted.rows[0]);
    }

    return { skipped: false, mode: "pages", pageCount, sections: createdSections };
  });
}

export async function importClueImageFile({
  worldId,
  actorId,
  clueName,
  filename,
  buffer,
  contentType,
  importKey
}) {
  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM clues WHERE world_id = $1 AND metadata->>'importKey' = $2 LIMIT 1`,
      [worldId, importKey]
    );
    if (existing.rowCount) return { skipped: true, reason: "duplicate_import", clueId: existing.rows[0].id };

    const uploaded = await uploadWorldAssetFromBuffer(client, {
      actorId,
      worldId,
      filename,
      buffer,
      contentType: contentType || "image/jpeg",
      visibility: "author",
      assetKind: "image"
    });

    const inserted = await client.query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
       VALUES ($1, $2, $3, '', 'role', $4::jsonb)
       RETURNING id, name`,
      [
        worldId,
        clueName || baseName(filename),
        `（图片线索 · ${filename}）`,
        JSON.stringify({
          clueType: "image",
          assetId: uploaded.assetId,
          importKey,
          source: "script_bundle"
        })
      ]
    );
    return { skipped: false, clue: inserted.rows[0], assetId: uploaded.assetId };
  });
}

export async function importBundleAssetFile({
  worldId,
  actorId,
  filename,
  buffer,
  contentType,
  importKey,
  label,
  assetKind = "image"
}) {
  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM asset_files WHERE world_id = $1 AND metadata->>'importKey' = $2 AND status = 'active' LIMIT 1`,
      [worldId, importKey]
    );
    if (existing.rowCount) return { skipped: true, reason: "duplicate_import", assetId: existing.rows[0].id };

    const uploaded = await uploadWorldAssetFromBuffer(client, {
      actorId,
      worldId,
      filename,
      buffer,
      contentType: contentType || "application/octet-stream",
      visibility: "author",
      assetKind
    });
    await client.query(`UPDATE asset_files SET metadata = $2::jsonb WHERE id = $1`, [
      uploaded.assetId,
      JSON.stringify({ importKey, label, source: "script_bundle" })
    ]);
    return { skipped: false, assetId: uploaded.assetId };
  });
}

export async function updateRolePublicProfileFromText(client, roleSlotId, text, sourceLabel) {
  const cleaned = cleanText(text);
  if (!cleaned) return { updated: false };
  await client.query(
    `UPDATE role_slots
     SET public_profile = CASE
           WHEN public_profile = '' OR public_profile IS NULL THEN $2
           ELSE public_profile || E'\n\n' || $2
         END
     WHERE id = $1`,
    [roleSlotId, `【${sourceLabel}】\n${cleaned.slice(0, 4000)}`]
  );
  return { updated: true };
}
