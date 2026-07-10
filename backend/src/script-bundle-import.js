import { transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { assertWorldCreateQuota } from "./quota-guards.js";
import { parseDocumentPayloadBase64 } from "./section-content.js";
import { scriptBundleMaxBytes } from "./script-bundle-limits.js";
import { analyzeScriptBundleBuffer, extractScriptBundleZip } from "./script-bundle-zip.js";
import { matchRoleSlotByName, normalizeRoleLabel } from "./script-bundle-classify.js";
import {
  appendStoryManuscript,
  extractDocumentText,
  importBundleAssetFile,
  importClueImageFile,
  importPdfPagesToRoleWithKey,
  importTextSectionsToRole
} from "./document-text-import.js";
import { detectPdfContentMode } from "./pdf-document.js";

function imageContentType(extension) {
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

function bundleImportKey(rootFolder, relativePath, byteSize) {
  return `script-bundle:${rootFolder || "root"}:${relativePath}:${byteSize}`;
}

async function listWorldRoles(client, worldId) {
  const result = await client.query(
    `SELECT id, name, sequence, public_profile FROM role_slots WHERE world_id = $1 ORDER BY sequence`,
    [worldId]
  );
  return result.rows;
}

async function nextRoleSequence(client, worldId) {
  const result = await client.query(
    `SELECT COALESCE(MAX(sequence), 0)::int AS value FROM role_slots WHERE world_id = $1`,
    [worldId]
  );
  return result.rows[0].value + 1;
}

async function ensureRoleSlot(client, worldId, roleName, { createMissingRoles }) {
  const roles = await listWorldRoles(client, worldId);
  const matched = matchRoleSlotByName(roles, roleName);
  if (matched) return matched;
  if (!createMissingRoles) return null;

  const sequence = await nextRoleSequence(client, worldId);
  const created = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
     VALUES ($1, $2, '', '', $3, $4::jsonb)
     RETURNING id, name, sequence, public_profile`,
    [worldId, String(roleName).trim(), sequence, JSON.stringify({ source: "script_bundle" })]
  );
  return created.rows[0];
}

export function loadScriptBundleBuffer(body) {
  const contentBase64 = parseDocumentPayloadBase64(body ?? {});
  const buffer = Buffer.from(String(contentBase64 ?? ""), "base64");
  if (!buffer.length || buffer.length > scriptBundleMaxBytes()) {
    throwErr("SCRIPT_BUNDLE_TOO_LARGE", `Zip must be between 1 byte and ${scriptBundleMaxBytes()} bytes`);
  }
  return buffer;
}

export function analyzeScriptBundle(body) {
  const buffer = loadScriptBundleBuffer(body);
  const analysis = analyzeScriptBundleBuffer(buffer);
  return {
    ...analysis,
    byteSize: buffer.length,
    limits: {
      maxBytes: scriptBundleMaxBytes()
    }
  };
}

async function importSingleBundleFile({
  client,
  worldId,
  actorId,
  file,
  rootFolder,
  options,
  roleSlots,
  roleMappings
}) {
  const { classification, relativePath, buffer, byteSize, extension } = file;
  const importKey = bundleImportKey(rootFolder, relativePath, byteSize);
  const publicationStatus = options.publicationStatus ?? "draft";
  const pdfLayout = options.pdfLayout ?? "single_section";

  if (classification.category === "skip" || classification.category === "unknown") {
    return { relativePath, status: "skipped", reason: classification.category };
  }

  if (options.skipCategories?.includes(classification.category)) {
    return { relativePath, status: "skipped", reason: "category_disabled" };
  }

  try {
    if (classification.category === "role_script") {
      const mappedRoleId = roleMappings?.[classification.roleName] ?? roleMappings?.[normalizeRoleLabel(classification.roleName)];
      let role = mappedRoleId ? roleSlots.find((item) => item.id === mappedRoleId) : matchRoleSlotByName(roleSlots, classification.roleName);
      if (!role) {
        role = await ensureRoleSlot(client, worldId, classification.roleName, {
          createMissingRoles: options.createMissingRoles !== false
        });
        if (role) roleSlots.push(role);
      }
      if (!role) {
        return { relativePath, status: "skipped", reason: "role_not_found", roleName: classification.roleName };
      }

      if (extension === ".pdf") {
        const detected = await detectPdfContentMode(buffer);
        if (detected.mode === "pages") {
          const result = await importPdfPagesToRoleWithKey({
            worldId,
            actorId,
            roleSlotId: role.id,
            filename: classification.filename,
            buffer,
            title: classification.roleName,
            publicationStatus,
            layout: pdfLayout,
            importKey,
            client
          });
          return { relativePath, status: result.skipped ? "duplicate" : "imported", category: "role_script", mode: "pages", roleName: role.name, ...result };
        }
      }

      const textResult = await importTextSectionsToRole({
        worldId,
        actorId,
        roleSlotId: role.id,
        filename: classification.filename,
        buffer,
        title: classification.roleName,
        publicationStatus,
        importKey,
        client
      });
      if (textResult.mode === "needs_pages") {
        const pageResult = await importPdfPagesToRoleWithKey({
          worldId,
          actorId,
          roleSlotId: role.id,
          filename: classification.filename,
          buffer,
          title: classification.roleName,
          publicationStatus,
          layout: pdfLayout,
          importKey,
          client
        });
        return { relativePath, status: pageResult.skipped ? "duplicate" : "imported", category: "role_script", mode: "pages", roleName: role.name, ...pageResult };
      }
      return { relativePath, status: textResult.skipped ? "duplicate" : "imported", category: "role_script", mode: "text", roleName: role.name, ...textResult };
    }

    if (classification.category === "clue") {
      const result = await importClueImageFile({
        worldId,
        actorId,
        clueName: classification.clueName || classification.label,
        filename: classification.filename,
        buffer,
        contentType: imageContentType(extension),
        importKey,
        client
      });
      return { relativePath, status: result.skipped ? "duplicate" : "imported", category: "clue", ...result };
    }

    if (classification.category === "asset") {
      const result = await importBundleAssetFile({
        worldId,
        actorId,
        filename: classification.filename,
        buffer,
        contentType: imageContentType(extension),
        importKey,
        label: classification.assetName || classification.label,
        client
      });
      return { relativePath, status: result.skipped ? "duplicate" : "imported", category: "asset", ...result };
    }

    if (["host_manual", "public_script", "role_profile"].includes(classification.category)) {
      if (extension === ".pdf") {
        const detected = await detectPdfContentMode(buffer);
        if (detected.mode === "pages") {
          const pageResult = await importBundleAssetFile({
            worldId,
            actorId,
            filename: classification.filename,
            buffer,
            contentType: "application/pdf",
            importKey,
            label: classification.title,
            assetKind: "document",
            client
          });
          await (async () =>
            appendStoryManuscript(client, worldId, actorId, `（${classification.title} - 图片 PDF，已作为素材 ${pageResult.assetId} 保存）`, classification.title)
          )();
          return { relativePath, status: "imported", category: classification.category, mode: "pdf_asset", ...pageResult };
        }
      }
      const text = await extractDocumentText(buffer, classification.filename);
      await appendStoryManuscript(client, worldId, actorId, text, classification.title || classification.label);
      return { relativePath, status: "imported", category: classification.category, mode: "manuscript_text" };
    }

    return { relativePath, status: "skipped", reason: "unsupported" };
  } catch (error) {
    return {
      relativePath,
      status: "failed",
      errorCode: error.code ?? "IMPORT_FAILED",
      errorMessage: error.message ?? "Import failed"
    };
  }
}

export async function importScriptBundleToWorldWithClient(client, worldId, actorId, body, options = {}) {
  const buffer = loadScriptBundleBuffer(body);
  const extracted = extractScriptBundleZip(buffer);
  const analysis = analyzeScriptBundleBuffer(buffer);

  const roleSlots = await client.query(`SELECT id, name, sequence, public_profile FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId]).then(
    (result) => result.rows
  );

  const results = [];
  for (const file of extracted.files) {
    results.push(
      await importSingleBundleFile({
        client,
        worldId,
        actorId,
        file,
        rootFolder: extracted.rootFolder,
        options,
        roleSlots,
        roleMappings: options.roleMappings ?? body.roleMappings ?? {}
      })
    );
  }

  const importedCount = results.filter((item) => item.status === "imported").length;
  const duplicateCount = results.filter((item) => item.status === "duplicate").length;
  const failed = results.filter((item) => item.status === "failed");
  const skipped = results.filter((item) => item.status === "skipped");

  await client.query(
    `UPDATE worlds
     SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
       'lastScriptBundleImportAt', to_jsonb(now()),
       'lastScriptBundleRoot', $2::text
     ),
     updated_at = now()
     WHERE id = $1`,
    [worldId, extracted.rootFolder ?? ""]
  );

  return {
    ok: true,
    mode: "append",
    worldId,
    rootFolder: extracted.rootFolder,
    suggestedWorldName: analysis.suggestedWorldName,
    suggestedPlayerCount: analysis.suggestedPlayerCount,
    summary: {
      imported: importedCount,
      duplicate: duplicateCount,
      failed: failed.length,
      skipped: skipped.length,
      total: results.length
    },
    inventory: analysis.inventory,
    warnings: analysis.warnings,
    results
  };
}

export async function importScriptBundleToWorld(worldId, actorId, body, options = {}) {
  return transaction((client) => importScriptBundleToWorldWithClient(client, worldId, actorId, body, options));
}

export async function createWorldFromScriptBundle(actorId, body, options = {}) {
  await assertWorldCreateQuota(actorId);
  const buffer = loadScriptBundleBuffer(body);
  const analysis = analyzeScriptBundleBuffer(buffer);
  const worldName = String(body.worldName ?? body.name ?? analysis.suggestedWorldName ?? "导入的剧本世界").trim();
  const worldSummary = String(body.worldSummary ?? body.summary ?? "").trim();
  const playerCount = body.playerCount ?? analysis.suggestedPlayerCount;

  const created = await transaction(async (client) => {
    const world = await client.query(
      `INSERT INTO worlds (owner_user_id, name, summary, settings)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, name`,
      [
        actorId,
        worldName,
        worldSummary,
        JSON.stringify({
          source: "script_bundle",
          suggestedPlayerCount: playerCount ?? null,
          importedAt: new Date().toISOString()
        })
      ]
    );
    const worldId = world.rows[0].id;
    await client.query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [worldId, actorId]);
    return { worldId, worldName: world.rows[0].name };
  });

  const importResult = await importScriptBundleToWorld(created.worldId, actorId, body, {
    ...options,
    createMissingRoles: options.createMissingRoles !== false
  });

  return {
    ...importResult,
    mode: "new_world",
    world: created
  };
}
