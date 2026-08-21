/**
 * Extended content-package import for case fixtures:
 * role archives, material booklets, mechanism package, mini-game templates, host notes.
 */
import { upsertRoleArchive, createMaterialBooklet } from "./creator-bible.js";
import { normalizeMiniGameTemplate } from "../../shared/mini-game-protocol.js";
import { assertMechanismPackage } from "../../shared/mechanism-package.js";

function remapId(map, sourceId) {
  if (!sourceId) return null;
  return map.get(sourceId) ?? null;
}

function remapIdList(map, ids = []) {
  return (Array.isArray(ids) ? ids : []).map((id) => remapId(map, id)).filter(Boolean);
}

function visibilityFromFixture(value) {
  const raw = String(value || "").trim();
  const allowed = new Set(["host_only", "owner_role", "shared_roles", "public_table"]);
  return allowed.has(raw) ? raw : "host_only";
}

export async function importCaseExtensions(client, worldId, payload, maps, warnings = []) {
  const { roleIds, clueIds, chapterIds } = maps;
  let archivesImported = 0;
  let bookletsImported = 0;
  let mechanismImported = 0;
  let miniGamesImported = 0;

  for (const archive of payload.roleArchives ?? []) {
    const roleSlotId = remapId(roleIds, archive.roleSlotId || archive.role_slot_id);
    if (!roleSlotId) {
      warnings.push({
        level: "warning",
        title: "已跳过角色档案",
        detail: `无法解析角色引用：${archive.roleSlotId || archive.role_slot_id || "?"}`,
      });
      continue;
    }
    await upsertRoleArchive(
      worldId,
      roleSlotId,
      {
        externalGoal: archive.externalGoal || archive.external_goal || "",
        secret: archive.secret || "",
        appearanceStates: archive.appearanceStates || archive.appearance_states || [],
        publicIdentity: archive.publicIdentity || "",
        hiddenIdentity: archive.hiddenIdentity || "",
        metadata: {
          ...(archive.metadata || {}),
          packageSourceId: archive.roleSlotId || archive.role_slot_id || null,
        },
      },
      { client },
    );
    archivesImported += 1;
  }

  for (const booklet of payload.materialBooklets ?? []) {
    const ownerRoleSlotId = remapId(
      roleIds,
      booklet.ownerRoleSlotId || booklet.owner_role_slot_id,
    );
    const chapterId = remapId(chapterIds, booklet.chapterId || booklet.chapter_id);
    const linkedClueIds = remapIdList(
      clueIds,
      booklet.linkedClueIds || booklet.linked_clue_ids,
    );
    const linkedRoleSlotIds = remapIdList(
      roleIds,
      booklet.linkedRoleSlotIds || booklet.linked_role_slot_ids,
    );
    try {
      await createMaterialBooklet(
        worldId,
        {
          kind: booklet.kind,
          title: booklet.title,
          summary: booklet.summary,
          ownerRoleSlotId,
          phaseLabel: booklet.phaseLabel || booklet.phase_label || "",
          chapterId,
          visibility: visibilityFromFixture(booklet.visibility),
          pages: booklet.pages || [],
          linkedClueIds,
          linkedRoleSlotIds,
          sequence: booklet.sequence || 1,
          metadata: {
            ...(booklet.metadata || {}),
            packageSourceId: booklet.packageSourceId || booklet.id || null,
          },
        },
        client,
      );
      bookletsImported += 1;
    } catch (error) {
      warnings.push({
        level: "warning",
        title: `物料册「${booklet.title || "未命名"}」导入失败`,
        detail: error?.message || String(error),
      });
    }
  }

  if (payload.mechanismPackage) {
    try {
      const packageValue = payload.mechanismPackage;
      assertMechanismPackage(packageValue);
      await client.query(
        `INSERT INTO world_mechanism_packages
           (world_id, schema_version, source, package, metadata, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, now())
         ON CONFLICT (world_id) DO UPDATE SET
           schema_version = EXCLUDED.schema_version,
           source = EXCLUDED.source,
           package = EXCLUDED.package,
           metadata = EXCLUDED.metadata,
           updated_at = now()`,
        [
          worldId,
          Number(packageValue.schemaVersion) || 1,
          String(packageValue.source || "case_fixture").slice(0, 80),
          JSON.stringify(packageValue),
          JSON.stringify({ importedFromCase: true }),
        ],
      );
      mechanismImported = 1;
    } catch (error) {
      warnings.push({
        level: "warning",
        title: "机制包导入失败",
        detail: error?.message || String(error),
      });
    }
  }

  const miniGameTemplates = (payload.miniGameTemplates || [])
    .map((row) => normalizeMiniGameTemplate(row))
    .slice(0, 50);
  if (miniGameTemplates.length || payload.hostNotes) {
    await client.query(
      `UPDATE worlds
       SET settings = COALESCE(settings, '{}'::jsonb)
         || jsonb_build_object(
              'miniGameTemplates', $2::jsonb,
              'caseHostNotes', $3::jsonb
            ),
           updated_at = now()
       WHERE id = $1`,
      [
        worldId,
        JSON.stringify(miniGameTemplates),
        JSON.stringify(payload.hostNotes || {}),
      ],
    );
    miniGamesImported = miniGameTemplates.length;
  }

  return {
    archivesImported,
    bookletsImported,
    mechanismImported,
    miniGamesImported,
  };
}
