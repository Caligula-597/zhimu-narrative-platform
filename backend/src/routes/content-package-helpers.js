import { query, transaction } from "../db.js";
import { throwErr } from "../api-errors.js";
import { buildWorldArchiveSnapshot, creatorChecks, storageUsage } from "./world-helpers.js";
import { admitWorldCreation } from "../quota-guards.js";
import { assertCapability } from "../capabilities.js";
import { resolveClueKind } from "../clue-kind.js";
import { assertContentPackageWithinLimits } from "../content-package-limits.js";

export const PACKAGE_FORMAT = "zhimu-world-package";
export const PACKAGE_VERSION = 1;

export function normalizeContentPackagePayload(body) {
  const envelope = body?.data ?? body;
  if (!envelope || typeof envelope !== "object") {
    throwErr("CONTENT_PACKAGE_INVALID");
  }
  if (!Array.isArray(envelope.roles) || !Array.isArray(envelope.chapters)) {
    throwErr("CONTENT_PACKAGE_STRUCTURE_INVALID");
  }
  assertContentPackageWithinLimits(envelope);
  return envelope;
}

export function validateEnvelope(body) {
  if (body?.format && body.format !== PACKAGE_FORMAT) {
    throwErr("CONTENT_PACKAGE_FORMAT_INVALID", `Unsupported package format: ${body.format}`);
  }
  if (body?.version && Number(body.version) !== PACKAGE_VERSION) {
    throwErr("CONTENT_PACKAGE_VERSION_INVALID", `Unsupported package version: ${body.version}`);
  }
}

const VALID_VISIBILITY = new Set(["author", "host", "role", "faction", "public", "postgame"]);
const VALID_PUBLICATION_STATUS = new Set(["draft", "testing", "published"]);
const VALID_RULE_MODES = new Set(["automatic", "host_confirm", "manual"]);
const VALID_EDGE_RELATIONS = new Set(["mainline", "parallel", "extension"]);

function oneOf(value, valid, fallback) {
  return valid.has(String(value)) ? String(value) : fallback;
}

function positiveInt(value, fallback = 1) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

export async function assetSummaryForWorld(worldId, client = { query }) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(byte_size) FILTER (WHERE status = 'active'), 0)::bigint AS total_bytes
     FROM asset_files
     WHERE world_id = $1 AND status IN ('pending_upload', 'active')`,
    [worldId]
  );
  const row = result.rows[0] ?? { count: 0, total_bytes: 0 };
  return { assetCount: row.count, assetBytes: Number(row.total_bytes), hasAttachments: row.count > 0 };
}

export function buildContentSummary(snapshot, assetMeta = { assetCount: 0, hasAttachments: false }) {
  return {
    worldName: snapshot.world?.name ?? "未命名世界",
    worldSummary: snapshot.world?.summary ?? "",
    roles: snapshot.roles?.length ?? 0,
    chapters: snapshot.chapters?.length ?? 0,
    sections: snapshot.sections?.length ?? 0,
    scenes: snapshot.scenes?.length ?? 0,
    clues: snapshot.clues?.length ?? 0,
    investigationPoints: snapshot.investigationPoints?.length ?? 0,
    rules: snapshot.rules?.length ?? 0,
    items: snapshot.items?.length ?? 0,
    edges: snapshot.edges?.length ?? 0,
    segmentRefs: snapshot.segmentRefs?.length ?? 0,
    truthClaims: snapshot.truthClaims?.length ?? 0,
    roleRelationships: snapshot.roleRelationships?.length ?? 0,
    roleArchives: snapshot.roleArchives?.length ?? 0,
    foreshadowBeats: snapshot.foreshadowBeats?.length ?? 0,
    timelineEvents: snapshot.timelineEvents?.length ?? 0,
    creatorReviews: snapshot.creatorReviews?.length ?? 0,
    assetCount: assetMeta.assetCount ?? 0,
    hasAttachments: Boolean(assetMeta.hasAttachments),
    includesBinaryAssets: false
  };
}

function entityIds(snapshot) {
  return {
    roles: new Set((snapshot.roles ?? []).map((item) => item.id)),
    chapters: new Set((snapshot.chapters ?? []).map((item) => item.id)),
    sections: new Set((snapshot.sections ?? []).map((item) => item.id)),
    scenes: new Set((snapshot.scenes ?? []).map((item) => item.id)),
    clues: new Set((snapshot.clues ?? []).map((item) => item.id)),
    points: new Set((snapshot.investigationPoints ?? []).map((item) => item.id))
  };
}

function duplicateNameWarnings(payload, targetSnapshot) {
  if (!targetSnapshot) return [];
  const warnings = [];
  const pushDup = (kind, incoming, existing) => {
    warnings.push({
      level: "warning",
      code: "duplicate_name",
      title: `${kind}「${incoming}」与当前世界重名`,
      detail: `当前世界已有同名${kind}「${existing}」。导入仍会追加新记录，不会覆盖已有内容。`
    });
  };
  const roleNames = new Set((targetSnapshot.roles ?? []).map((item) => item.name));
  for (const role of payload.roles ?? []) {
    if (roleNames.has(role.name)) pushDup("角色", role.name, role.name);
  }
  const chapterTitles = new Set((targetSnapshot.chapters ?? []).map((item) => item.title));
  for (const chapter of payload.chapters ?? []) {
    if (chapterTitles.has(chapter.title)) pushDup("章节", chapter.title, chapter.title);
  }
  const sceneNames = new Set((targetSnapshot.scenes ?? []).map((item) => item.name));
  for (const scene of payload.scenes ?? []) {
    if (sceneNames.has(scene.name)) pushDup("场景", scene.name, scene.name);
  }
  const clueNames = new Set((targetSnapshot.clues ?? []).map((item) => item.name));
  for (const clue of payload.clues ?? []) {
    if (clueNames.has(clue.name)) pushDup("线索", clue.name, clue.name);
  }
  return warnings;
}

function packageReferenceWarnings(payload) {
  const warnings = [];
  const ids = entityIds(payload);
  const roleById = new Map((payload.roles ?? []).map((item) => [item.id, item.name]));
  const chapterById = new Map((payload.chapters ?? []).map((item) => [item.id, item.title]));

  for (const section of payload.sections ?? []) {
    if (!ids.roles.has(section.role_slot_id)) {
      warnings.push({
        level: "error",
        code: "missing_role_ref",
        title: `分幕「${section.title}」缺少角色引用`,
        detail: `role_slot_id ${section.role_slot_id} 不在内容包内，该分幕导入时将被跳过。`
      });
    }
    if (section.chapter_id && !ids.chapters.has(section.chapter_id)) {
      warnings.push({
        level: "warning",
        code: "missing_chapter_ref",
        title: `分幕「${section.title}」绑定了包外章节`,
        detail: `chapter_id ${section.chapter_id} 不在内容包内，导入后将不绑定公共章节。`
      });
    }
  }

  for (const scene of payload.scenes ?? []) {
    if (scene.chapter_id && !ids.chapters.has(scene.chapter_id)) {
      warnings.push({
        level: "warning",
        code: "missing_chapter_ref",
        title: `场景「${scene.name}」绑定了包外章节`,
        detail: `chapter_id ${scene.chapter_id} 不在内容包内。`
      });
    }
  }

  for (const point of payload.investigationPoints ?? []) {
    if (!ids.scenes.has(point.scene_id)) {
      warnings.push({
        level: "error",
        code: "missing_scene_ref",
        title: `调查点「${point.name}」缺少场景引用`,
        detail: `scene_id ${point.scene_id} 不在内容包内，该调查点导入时将被跳过。`
      });
    }
    if (point.clue_id && !ids.clues.has(point.clue_id)) {
      warnings.push({
        level: "warning",
        code: "missing_clue_ref",
        title: `调查点「${point.name}」引用了包外线索`,
        detail: `clue_id ${point.clue_id} 不在内容包内，导入后线索关联将丢失。`
      });
    }
  }

  const edgeMaps = { scene: ids.scenes, clue: ids.clues, investigation_point: ids.points, chapter: ids.chapters };
  for (const edge of payload.edges ?? []) {
    const fromOk = edgeMaps[edge.from_type]?.has(edge.from_id);
    const toOk = edgeMaps[edge.to_type]?.has(edge.to_id);
    if (!fromOk || !toOk) {
      warnings.push({
        level: "warning",
        code: "missing_edge_ref",
        title: "剧情连线存在缺失引用",
        detail: `${edge.from_type}:${edge.from_id} → ${edge.to_type}:${edge.to_id} 无法在包内解析，导入时将跳过该连线。`
      });
    }
  }

  for (const rule of payload.rules ?? []) {
    const walk = (root, rootPath = "rule") => {
      const stack = [{ value: root, path: rootPath }];
      let visited = 0;
      while (stack.length) {
        const { value, path } = stack.pop();
        visited += 1;
        if (visited > 50_000) throwErr("CONTENT_PACKAGE_TOO_LARGE", "Rule structure is too deeply nested");
        if (Array.isArray(value)) {
          value.forEach((item, index) => stack.push({ value: item, path: `${path}[${index}]` }));
          continue;
        }
        if (!value || typeof value !== "object") continue;
      if (value.roleSlotId && !ids.roles.has(value.roleSlotId)) {
        warnings.push({
          level: "error",
          code: "missing_rule_ref",
          title: `规则「${rule.name}」引用了不存在的角色`,
          detail: `${path}.roleSlotId → ${value.roleSlotId}（${roleById.get(value.roleSlotId) ?? "未知"}）`
        });
      }
      if (value.scriptSectionId && !ids.sections.has(value.scriptSectionId)) {
        warnings.push({
          level: "error",
          code: "missing_rule_ref",
          title: `规则「${rule.name}」引用了不存在的分幕`,
          detail: `${path}.scriptSectionId → ${value.scriptSectionId}`
        });
      }
      if (value.sceneId && !ids.scenes.has(value.sceneId)) {
        warnings.push({
          level: "error",
          code: "missing_rule_ref",
          title: `规则「${rule.name}」引用了不存在的场景`,
          detail: `${path}.sceneId → ${value.sceneId}`
        });
      }
      if (value.clueId && !ids.clues.has(value.clueId)) {
        warnings.push({
          level: "error",
          code: "missing_rule_ref",
          title: `规则「${rule.name}」引用了不存在的线索`,
          detail: `${path}.clueId → ${value.clueId}`
        });
      }
      if (value.investigationPointId && !ids.points.has(value.investigationPointId)) {
        warnings.push({
          level: "error",
          code: "missing_rule_ref",
          title: `规则「${rule.name}」引用了不存在的调查点`,
          detail: `${path}.investigationPointId → ${value.investigationPointId}`
        });
      }
      if (value.chapterId && !ids.chapters.has(value.chapterId)) {
        warnings.push({
          level: "warning",
          code: "missing_rule_ref",
          title: `规则「${rule.name}」引用了不存在的章节`,
          detail: `${path}.chapterId → ${value.chapterId}（${chapterById.get(value.chapterId) ?? "未知"}）`
        });
      }
        Object.entries(value).forEach(([key, item]) => stack.push({ value: item, path: `${path}.${key}` }));
      }
    };
    walk(rule.conditions ?? {});
    for (const action of rule.actions ?? []) walk(action, "action");
  }

  return warnings;
}

export function buildImportPreview(payload, { targetSnapshot = null, mode = "append" } = {}) {
  const summary = buildContentSummary(payload, { assetCount: 0, hasAttachments: false });
  const preview = {
    mode,
    sourceWorldName: payload.world?.name ?? "未命名来源世界",
    sourceWorldSummary: payload.world?.summary ?? "",
    summary,
    roles: (payload.roles ?? []).map((item) => ({ name: item.name, sequence: item.sequence })),
    chapters: (payload.chapters ?? []).map((item) => ({ title: item.title, sequence: item.sequence })),
    clues: (payload.clues ?? []).slice(0, 40).map((item) => ({ name: item.name })),
    scenes: (payload.scenes ?? []).slice(0, 40).map((item) => ({ name: item.name })),
    sections: (payload.sections ?? []).slice(0, 40).map((item) => ({ title: item.title })),
    warnings: [],
    qualityChecks: creatorChecks(payload)
  };
  preview.warnings.push(...packageReferenceWarnings(payload));
  if (mode === "append" && targetSnapshot) {
    preview.warnings.push(...duplicateNameWarnings(payload, targetSnapshot));
    preview.targetWorldName = targetSnapshot.world?.name ?? "当前世界";
  }
  preview.canImport = !preview.warnings.some((item) => item.level === "error" && item.code.startsWith("missing_"));
  preview.hasBlockingErrors = preview.warnings.some((item) => item.level === "error");
  return preview;
}

function remapRuleValue(value, maps) {
  const { roleIds, sectionIds, sceneIds, clueIds, pointIds, chapterIds } = maps;
  if (Array.isArray(value)) return value.map((item) => remapRuleValue(item, maps));
  if (!value || typeof value !== "object") return value;
  const next = { ...value };
  if (next.roleSlotId) next.roleSlotId = roleIds.get(next.roleSlotId) ?? next.roleSlotId;
  if (next.scriptSectionId) next.scriptSectionId = sectionIds.get(next.scriptSectionId) ?? next.scriptSectionId;
  if (next.sceneId) next.sceneId = sceneIds.get(next.sceneId) ?? next.sceneId;
  if (next.clueId) next.clueId = clueIds.get(next.clueId) ?? next.clueId;
  if (next.investigationPointId) next.investigationPointId = pointIds.get(next.investigationPointId) ?? next.investigationPointId;
  if (next.chapterId) next.chapterId = chapterIds.get(next.chapterId) ?? next.chapterId;
  return Object.fromEntries(Object.entries(next).map(([key, item]) => [key, remapRuleValue(item, maps)]));
}

export async function importContentPackageData(client, worldId, payload) {
  const warnings = [];
  const importKey = payload.meta?.importKey
    || (payload.meta?.sourceWorldId && payload.meta?.exportedAt ? `${payload.meta.sourceWorldId}:${payload.meta.exportedAt}` : null);
  if (importKey) {
    const world = await client.query(`SELECT settings FROM worlds WHERE id = $1`, [worldId]);
    if (world.rows[0]?.settings?.lastContentPackageImportKey === importKey) {
      return {
        deduplicated: true,
        chapters: 0,
        roles: 0,
        sections: 0,
        scenes: 0,
        clues: 0,
        investigationPoints: 0,
        rules: 0,
        warnings: [{ level: "info", title: "已跳过重复导入", detail: "相同 importKey 的内容包此前已导入。" }]
      };
    }
  }

  async function findByPackageSourceId(table, sourceId) {
    if (!sourceId) return null;
    const row = await client.query(
      `SELECT id FROM ${table} WHERE world_id = $1 AND metadata->>'packageSourceId' = $2 LIMIT 1`,
      [worldId, sourceId]
    );
    return row.rowCount ? row.rows[0].id : null;
  }

  async function findRoleByPackageSourceId(sourceId) {
    if (!sourceId) return null;
    const row = await client.query(
      `SELECT id FROM role_slots WHERE world_id = $1 AND settings->>'packageSourceId' = $2 LIMIT 1`,
      [worldId, sourceId]
    );
    return row.rowCount ? row.rows[0].id : null;
  }

  const chapterIds = new Map();
  const roleIds = new Map();
  const sectionIds = new Map();
  const sceneIds = new Map();
  const clueIds = new Map();
  const pointIds = new Map();

  const chapterSeq = await client.query(`SELECT COALESCE(MAX(sequence), 0)::int AS max FROM chapters WHERE world_id = $1`, [worldId]);
  const roleSeq = await client.query(`SELECT COALESCE(MAX(sequence), 0)::int AS max FROM role_slots WHERE world_id = $1`, [worldId]);
  const sectionSeqByRole = await client.query(
    `SELECT ss.role_slot_id, COALESCE(MAX(ss.sequence), 0)::int AS max
     FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1
     GROUP BY ss.role_slot_id`,
    [worldId]
  );
  const chapterOffset = chapterSeq.rows[0]?.max ?? 0;
  const roleOffset = roleSeq.rows[0]?.max ?? 0;
  const sectionOffsetByRole = new Map(sectionSeqByRole.rows.map((row) => [row.role_slot_id, row.max]));

  for (const chapter of payload.chapters) {
    let existingChapterId = null;
    for (const scene of payload.scenes ?? []) {
      if (scene.chapter_id !== chapter.id) continue;
      const existingSceneId = await findByPackageSourceId("scenes", scene.id);
      if (!existingSceneId) continue;
      const row = await client.query(`SELECT chapter_id FROM scenes WHERE id = $1`, [existingSceneId]);
      existingChapterId = row.rows[0]?.chapter_id ?? null;
      if (existingChapterId) break;
    }
    if (existingChapterId) {
      chapterIds.set(chapter.id, existingChapterId);
      continue;
    }
    const sequence = chapterOffset + positiveInt(chapter.sequence, chapterIds.size + 1);
    const result = await client.query(
      `INSERT INTO chapters (world_id, title, summary, sequence, publication_status, unlock_rules)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [
        worldId,
        chapter.title,
        chapter.summary ?? "",
        sequence,
        oneOf(chapter.publication_status, VALID_PUBLICATION_STATUS, "draft"),
        JSON.stringify(chapter.unlock_rules ?? {})
      ]
    );
    chapterIds.set(chapter.id, result.rows[0].id);
  }

  for (const role of payload.roles) {
    const existingId = await findRoleByPackageSourceId(role.id);
    if (existingId) {
      roleIds.set(role.id, existingId);
      continue;
    }
    const sequence = roleOffset + positiveInt(role.sequence, roleIds.size + 1);
    const result = await client.query(
      `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [worldId, role.name, role.public_profile ?? "", role.private_profile ?? "", sequence, JSON.stringify({ packageSourceId: role.id })]
    );
    roleIds.set(role.id, result.rows[0].id);
  }

  let sectionsImported = 0;
  for (const section of payload.sections ?? []) {
    const roleId = roleIds.get(section.role_slot_id);
    if (!roleId) {
      warnings.push({ level: "warning", title: `已跳过分幕「${section.title}」`, detail: "缺少有效角色引用。" });
      continue;
    }
    const existingSection = await client.query(
      `SELECT id FROM script_sections WHERE role_slot_id = $1 AND metadata->>'packageSourceId' = $2 LIMIT 1`,
      [roleId, section.id]
    );
    if (existingSection.rowCount) {
      sectionIds.set(section.id, existingSection.rows[0].id);
      continue;
    }
    const script = await client.query(
      `INSERT INTO character_scripts (role_slot_id, title)
       SELECT $1, '角色私人剧本' WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1) RETURNING id`,
      [roleId]
    );
    const scriptId = script.rows[0]?.id ?? (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleId])).rows[0].id;
    const chapterId = section.chapter_id ? chapterIds.get(section.chapter_id) ?? null : null;
    if (section.chapter_id && !chapterId) {
      warnings.push({ level: "warning", title: `分幕「${section.title}」未绑定章节`, detail: "原章节引用无法在目标世界中解析。" });
    }
    const sectionOffset = sectionOffsetByRole.get(roleId) ?? 0;
    const sequence = sectionOffset + positiveInt(section.sequence, 1);
    sectionOffsetByRole.set(roleId, sequence);
    const result = await client.query(
      `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,
      [
        scriptId,
        roleId,
        chapterId,
        section.title,
        section.body ?? "",
        sequence,
        oneOf(section.publication_status, VALID_PUBLICATION_STATUS, "draft"),
        JSON.stringify({ packageSourceId: section.id })
      ]
    );
    sectionIds.set(section.id, result.rows[0].id);
    sectionsImported += 1;
  }

  for (const scene of payload.scenes ?? []) {
    const existingId = await findByPackageSourceId("scenes", scene.id);
    if (existingId) {
      sceneIds.set(scene.id, existingId);
      continue;
    }
    const chapterId = scene.chapter_id ? chapterIds.get(scene.chapter_id) ?? null : null;
    if (scene.chapter_id && !chapterId) {
      warnings.push({ level: "warning", title: `场景「${scene.name}」未绑定章节`, detail: "原章节引用无法在目标世界中解析。" });
    }
    const result = await client.query(
      `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [worldId, chapterId, scene.name, scene.public_text ?? "", scene.host_text ?? "", JSON.stringify({ ...(scene.metadata ?? {}), packageSourceId: scene.id })]
    );
    sceneIds.set(scene.id, result.rows[0].id);
  }

  for (const clue of payload.clues ?? []) {
    const existingId = await findByPackageSourceId("clues", clue.id);
    if (existingId) {
      clueIds.set(clue.id, existingId);
      continue;
    }
    const result = await client.query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
      [
        worldId,
        clue.name,
        clue.public_text ?? "",
        clue.host_text ?? "",
        oneOf(clue.visibility, VALID_VISIBILITY, "role"),
        resolveClueKind(clue),
        JSON.stringify({ ...(clue.metadata ?? {}), packageSourceId: clue.id })
      ]
    );
    clueIds.set(clue.id, result.rows[0].id);
  }

  let pointsImported = 0;
  for (const point of payload.investigationPoints ?? []) {
    const existingId = await findByPackageSourceId("investigation_points", point.id);
    if (existingId) {
      pointIds.set(point.id, existingId);
      continue;
    }
    const sceneId = sceneIds.get(point.scene_id);
    if (!sceneId) {
      warnings.push({ level: "warning", title: `已跳过调查点「${point.name}」`, detail: "缺少有效场景引用。" });
      continue;
    }
    const clueId = point.clue_id ? clueIds.get(point.clue_id) ?? null : null;
    if (point.clue_id && !clueId) {
      warnings.push({ level: "warning", title: `调查点「${point.name}」未绑定线索`, detail: "原线索引用无法在目标世界中解析。" });
    }
    const result = await client.query(
      `INSERT INTO investigation_points (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id`,
      [
        worldId,
        sceneId,
        point.name,
        point.description ?? "",
        point.interaction_text ?? "",
        point.result_text ?? "",
        clueId,
        Math.max(0, Number(point.sequence) || 0),
        JSON.stringify({ ...(point.metadata ?? {}), packageSourceId: point.id })
      ]
    );
    pointIds.set(point.id, result.rows[0].id);
    pointsImported += 1;
  }

  const edgeMaps = { scene: sceneIds, clue: clueIds, investigation_point: pointIds, chapter: chapterIds };
  let edgesImported = 0;
  for (const edge of payload.edges ?? []) {
    const fromId = edgeMaps[edge.from_type]?.get(edge.from_id);
    const toId = edgeMaps[edge.to_type]?.get(edge.to_id);
    if (!fromId || !toId) continue;
    const relationType = oneOf(edge.relation_type, VALID_EDGE_RELATIONS, "mainline");
    const existingEdge = await client.query(
      `SELECT id FROM story_graph_edges
       WHERE world_id = $1 AND from_type = $2 AND from_id = $3 AND to_type = $4 AND to_id = $5 AND relation_type = $6
       LIMIT 1`,
      [worldId, edge.from_type, fromId, edge.to_type, toId, relationType]
    );
    if (existingEdge.rowCount) continue;
    await client.query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [worldId, edge.from_type, fromId, edge.to_type, toId, relationType, edge.label ?? ""]
    );
    edgesImported += 1;
  }

  const maps = { roleIds, sectionIds, sceneIds, clueIds, pointIds, chapterIds };
  let rulesImported = 0;
  for (const rule of payload.rules ?? []) {
    if (rule.id) {
      const existingRule = await client.query(
        `SELECT id FROM automation_rules WHERE world_id = $1 AND conditions->'_packageImport'->>'sourceId' = $2 LIMIT 1`,
        [worldId, rule.id]
      );
      if (existingRule.rowCount) continue;
    }
    const conditions = remapRuleValue(rule.conditions ?? { all: [] }, maps);
    if (rule.id) conditions._packageImport = { sourceId: rule.id };
    await client.query(
      `INSERT INTO automation_rules (world_id, name, mode, priority, enabled, conditions, actions)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [
        worldId,
        rule.name,
        oneOf(rule.mode, VALID_RULE_MODES, "automatic"),
        Math.max(0, Number(rule.priority) || 100),
        rule.enabled !== false,
        JSON.stringify(conditions),
        JSON.stringify(remapRuleValue(rule.actions ?? [], maps))
      ]
    );
    rulesImported += 1;
  }

  if (importKey) {
    await client.query(
      `UPDATE worlds SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('lastContentPackageImportKey', $2::text), updated_at = now() WHERE id = $1`,
      [worldId, importKey]
    );
  }

  return {
    imported: {
      chapters: chapterIds.size,
      roles: roleIds.size,
      sections: sectionsImported,
      scenes: sceneIds.size,
      clues: clueIds.size,
      points: pointsImported,
      edges: edgesImported,
      rules: rulesImported
    },
    idMaps: {
      chapters: Object.fromEntries(chapterIds),
      roles: Object.fromEntries(roleIds),
      sections: Object.fromEntries(sectionIds),
      scenes: Object.fromEntries(sceneIds),
      clues: Object.fromEntries(clueIds),
      points: Object.fromEntries(pointIds)
    },
    warnings
  };
}

export async function importContentPackage(worldId, payload) {
  return transaction(async (client) => importContentPackageData(client, worldId, payload));
}

export async function createWorldFromContentPackage(actorId, { name, summary = "", requestId = "", data }) {
  await assertCapability(actorId, "world.create");
  if (requestId) {
    const existing = await query(
      `SELECT id, name
       FROM worlds
       WHERE owner_user_id = $1
         AND settings->>'contentPackageCreationRequestId' = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [actorId, requestId]
    );
    if (existing.rowCount) {
      return {
        world: existing.rows[0],
        imported: { chapters: 0, roles: 0, sections: 0, scenes: 0, clues: 0, points: 0, edges: 0, rules: 0 },
        warnings: [],
        deduplicated: true
      };
    }
  }
  const cleanText = (value) => typeof value === "string" ? value.trim() : "";
  const worldName = cleanText(name) || cleanText(data.world?.name) || "导入的世界";
  const worldSummary = cleanText(summary) || cleanText(data.world?.summary);
  return transaction(async (client) => {
    if (requestId) {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`content-package:${actorId}:${requestId}`]);
      const existing = await client.query(
        `SELECT id, name
         FROM worlds
         WHERE owner_user_id = $1
           AND settings->>'contentPackageCreationRequestId' = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [actorId, requestId]
      );
      if (existing.rowCount) {
        return {
          world: existing.rows[0],
          imported: { chapters: 0, roles: 0, sections: 0, scenes: 0, clues: 0, points: 0, edges: 0, rules: 0 },
          warnings: [],
          deduplicated: true
        };
      }
    }
    await admitWorldCreation(client, actorId);
    const sourceSettings = data.world?.settings;
    const settings = sourceSettings && typeof sourceSettings === "object" && !Array.isArray(sourceSettings)
      ? { ...sourceSettings }
      : {};
    if (requestId) settings.contentPackageCreationRequestId = requestId;
    const created = await client.query(
      `INSERT INTO worlds (owner_user_id, name, summary, settings) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, name`,
      [actorId, worldName, worldSummary, JSON.stringify(settings)]
    );
    const worldId = created.rows[0].id;
    await client.query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [worldId, actorId]);
    const result = await importContentPackageData(client, worldId, data);
    return { world: created.rows[0], ...result };
  });
}

export async function exportSummaryForWorld(worldId) {
  const snapshot = await buildWorldArchiveSnapshot(worldId);
  const assets = await assetSummaryForWorld(worldId);
  return buildContentSummary(snapshot, assets);
}
