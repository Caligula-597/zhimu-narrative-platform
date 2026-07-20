import { transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { assertWorldCreateQuota } from "./quota-guards.js";
import { matchRoleSlotByName, normalizeRoleLabel } from "./script-bundle-classify.js";
import { appendStoryManuscript, importBundleAssetFile, importClueImageFile, importPdfPagesToRoleWithKey, importTextSectionsToRole } from "./document-text-import.js";
import { analyzeScriptBundle } from "./script-bundle-payload.js";
import { cleanupPreparedScriptBundle, markPreparedBundleFileUsed, prepareScriptBundleImport, preparedScriptBundleObjectKeys, scriptBundleImageContentType } from "./script-bundle-preparation.js";
import { lockDocumentRole } from "./repositories/creator-document-repository.js";

export { analyzeScriptBundle, loadScriptBundleBuffer } from "./script-bundle-payload.js";
export { cleanupPreparedScriptBundle, prepareScriptBundleImport, preparedScriptBundleObjectKeys } from "./script-bundle-preparation.js";

function bundleImportKey(rootFolder, relativePath, byteSize) {
  return `script-bundle:${rootFolder || "root"}:${relativePath}:${byteSize}`;
}

async function listWorldRoles(client, worldId) {
  const result = await client.query(`SELECT id, name, sequence, public_profile FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId]);
  return result.rows;
}

async function nextRoleSequence(client, worldId) {
  const result = await client.query(`SELECT COALESCE(MAX(sequence), 0)::int AS value FROM role_slots WHERE world_id = $1`, [worldId]);
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

function bundleFileNeedsDatabase(file, options) {
  return !(file.preparationError || file.classification.category === "skip" || file.classification.category === "unknown" || options.skipCategories?.includes(file.classification.category));
}

async function importSingleBundleFile({ client, worldId, actorId, file, rootFolder, options, roleSlots, roleMappings, preparedImport }) {
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

  if (file.preparationError) {
    return {
      relativePath,
      status: "failed",
      errorCode: file.preparationError.code,
      errorMessage: file.preparationError.message
    };
  }

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
      return {
        relativePath,
        status: "skipped",
        reason: "role_not_found",
        roleName: classification.roleName
      };
    }
    await lockDocumentRole(client, { worldId, roleSlotId: role.id });

    if (file.preparedMode === "pages") {
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
        renderedPages: file.renderedPages,
        preparedAssets: file.preparedAssets,
        client
      });
      if (!result.skipped) markPreparedBundleFileUsed(preparedImport, file);
      return {
        relativePath,
        status: result.skipped ? "duplicate" : "imported",
        category: "role_script",
        mode: "pages",
        roleName: role.name,
        ...result
      };
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
      extractedText: file.extractedText,
      client
    });
    return {
      relativePath,
      status: textResult.skipped ? "duplicate" : "imported",
      category: "role_script",
      mode: "text",
      roleName: role.name,
      ...textResult
    };
  }

  if (classification.category === "clue") {
    const result = await importClueImageFile({
      worldId,
      actorId,
      clueName: classification.clueName || classification.label,
      filename: classification.filename,
      buffer,
      contentType: scriptBundleImageContentType(extension),
      importKey,
      preparedAsset: file.preparedAsset,
      client
    });
    if (!result.skipped) markPreparedBundleFileUsed(preparedImport, file);
    return {
      relativePath,
      status: result.skipped ? "duplicate" : "imported",
      category: "clue",
      ...result
    };
  }

  if (classification.category === "asset") {
    const result = await importBundleAssetFile({
      worldId,
      actorId,
      filename: classification.filename,
      buffer,
      contentType: scriptBundleImageContentType(extension),
      importKey,
      label: classification.assetName || classification.label,
      preparedAsset: file.preparedAsset,
      client
    });
    if (!result.skipped) markPreparedBundleFileUsed(preparedImport, file);
    return {
      relativePath,
      status: result.skipped ? "duplicate" : "imported",
      category: "asset",
      ...result
    };
  }

  if (["host_manual", "public_script", "role_profile"].includes(classification.category)) {
    if (file.preparedMode === "pdf_asset") {
      const pageResult = await importBundleAssetFile({
        worldId,
        actorId,
        filename: classification.filename,
        buffer,
        contentType: "application/pdf",
        importKey,
        label: classification.title,
        assetKind: "document",
        preparedAsset: file.preparedAsset,
        client
      });
      if (pageResult.skipped) {
        return {
          relativePath,
          status: "duplicate",
          category: classification.category,
          mode: "pdf_asset",
          ...pageResult
        };
      }
      await (async () => appendStoryManuscript(client, worldId, actorId, `（${classification.title} - 图片 PDF，已作为素材 ${pageResult.assetId} 保存）`, classification.title))();
      markPreparedBundleFileUsed(preparedImport, file);
      return {
        relativePath,
        status: "imported",
        category: classification.category,
        mode: "pdf_asset",
        ...pageResult
      };
    }
    await appendStoryManuscript(client, worldId, actorId, file.extractedText, classification.title || classification.label);
    return {
      relativePath,
      status: "imported",
      category: classification.category,
      mode: "manuscript_text"
    };
  }

  return { relativePath, status: "skipped", reason: "unsupported" };
}

export async function importScriptBundleToWorldWithClient(client, worldId, actorId, body, options = {}, preparedImport = null) {
  if (!preparedImport) {
    throw new Error("Script bundle must be prepared before opening its database transaction");
  }
  const { extracted, analysis } = preparedImport;

  const worldLock = await client.query(`SELECT id FROM worlds WHERE id = $1 FOR UPDATE`, [worldId]);
  if (!worldLock.rowCount) throwErr("WORLD_NOT_FOUND");

  const roleSlots = await client.query(`SELECT id, name, sequence, public_profile FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId]).then((result) => result.rows);

  const results = [];
  for (const [index, file] of extracted.files.entries()) {
    const importArgs = {
      client,
      worldId,
      actorId,
      file,
      rootFolder: extracted.rootFolder,
      options,
      roleSlots,
      roleMappings: options.roleMappings ?? body.roleMappings ?? {},
      preparedImport
    };
    if (!bundleFileNeedsDatabase(file, options)) {
      results.push(await importSingleBundleFile(importArgs));
      continue;
    }
    const savepoint = `script_bundle_file_${index + 1}`;
    const roleCountBefore = roleSlots.length;
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      const result = await importSingleBundleFile(importArgs);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      results.push(result);
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      roleSlots.splice(roleCountBefore);
      results.push({
        relativePath: file.relativePath,
        status: "failed",
        errorCode: error.code ?? "IMPORT_FAILED",
        errorMessage: error.message ?? "Import failed"
      });
    }
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
  const preparedImport = await prepareScriptBundleImport(worldId, actorId, body, options);
  try {
    const result = await transaction((client) => importScriptBundleToWorldWithClient(client, worldId, actorId, body, options, preparedImport));
    await cleanupPreparedScriptBundle(preparedImport, { unusedOnly: true });
    return result;
  } catch (error) {
    await cleanupPreparedScriptBundle(preparedImport);
    throw error;
  }
}

export async function createWorldFromScriptBundle(actorId, body, options = {}) {
  await assertWorldCreateQuota(actorId);
  const analysis = analyzeScriptBundle(body);
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
