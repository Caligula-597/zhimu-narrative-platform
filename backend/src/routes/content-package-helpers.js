import { query, transaction } from "../db.js";
import { throwErr } from "../api-errors.js";
import { buildWorldSnapshot, creatorChecks, storageUsage } from "./world-helpers.js";

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
    const walk = (value, path = "rule") => {
      if (Array.isArray(value)) return value.forEach((item, index) => walk(item, `${path}[${index}]`));
      if (!value || typeof value !== "object") return;
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
      Object.values(value).forEach((item) => walk(item, path));
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
    const sequence = chapterOffset + (chapter.sequence ?? chapterIds.size + 1);
    const result = await client.query(
      `INSERT INTO chapters (world_id, title, summary, sequence, publication_status, unlock_rules)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [worldId, chapter.title, chapter.summary ?? "", sequence, chapter.publication_status ?? "draft", JSON.stringify(chapter.unlock_rules ?? {})]
    );
    chapterIds.set(chapter.id, result.rows[0].id);
  }

  for (const role of payload.roles) {
    const sequence = roleOffset + (role.sequence ?? roleIds.size + 1);
    const result = await client.query(
      `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [worldId, role.name, role.public_profile ?? "", role.private_profile ?? "", sequence]
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
    const sequence = sectionOffset + (section.sequence ?? 1);
    sectionOffsetByRole.set(roleId, sequence);
    const result = await client.query(
      `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [scriptId, roleId, chapterId, section.title, section.body ?? "", sequence, section.publication_status ?? "draft"]
    );
    sectionIds.set(section.id, result.rows[0].id);
    sectionsImported += 1;
  }

  for (const scene of payload.scenes ?? []) {
    const chapterId = scene.chapter_id ? chapterIds.get(scene.chapter_id) ?? null : null;
    if (scene.chapter_id && !chapterId) {
      warnings.push({ level: "warning", title: `场景「${scene.name}」未绑定章节`, detail: "原章节引用无法在目标世界中解析。" });
    }
    const result = await client.query(
      `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [worldId, chapterId, scene.name, scene.public_text ?? "", scene.host_text ?? "", JSON.stringify(scene.metadata ?? {})]
    );
    sceneIds.set(scene.id, result.rows[0].id);
  }

  for (const clue of payload.clues ?? []) {
    const result = await client.query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [worldId, clue.name, clue.public_text ?? "", clue.host_text ?? "", clue.visibility ?? "role", JSON.stringify(clue.metadata ?? {})]
    );
    clueIds.set(clue.id, result.rows[0].id);
  }

  let pointsImported = 0;
  for (const point of payload.investigationPoints ?? []) {
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
      [worldId, sceneId, point.name, point.description ?? "", point.interaction_text ?? "", point.result_text ?? "", clueId, point.sequence ?? 0, JSON.stringify(point.metadata ?? {})]
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
    await client.query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [worldId, edge.from_type, fromId, edge.to_type, toId, edge.relation_type ?? "mainline", edge.label ?? ""]
    );
    edgesImported += 1;
  }

  const maps = { roleIds, sectionIds, sceneIds, clueIds, pointIds, chapterIds };
  let rulesImported = 0;
  for (const rule of payload.rules ?? []) {
    await client.query(
      `INSERT INTO automation_rules (world_id, name, mode, priority, enabled, conditions, actions)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [worldId, rule.name, rule.mode ?? "automatic", rule.priority ?? 100, rule.enabled !== false, JSON.stringify(remapRuleValue(rule.conditions ?? { all: [] }, maps)), JSON.stringify(remapRuleValue(rule.actions ?? [], maps))]
    );
    rulesImported += 1;
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

export async function createWorldFromContentPackage(actorId, { name, summary = "", data }) {
  const quota = await storageUsage(actorId);
  const worldCount = await query(`SELECT COUNT(*)::int AS count FROM worlds WHERE owner_user_id = $1 AND status <> 'archived'`, [actorId]);
  if (worldCount.rows[0].count >= quota.max_worlds) {
    throwErr("WORLD_QUOTA_EXCEEDED");
  }
  const worldName = name?.trim() || data.world?.name?.trim() || "导入的世界";
  const worldSummary = summary?.trim() || data.world?.summary?.trim() || "";
  return transaction(async (client) => {
    const created = await client.query(
      `INSERT INTO worlds (owner_user_id, name, summary, settings) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, name`,
      [actorId, worldName, worldSummary, JSON.stringify(data.world?.settings ?? {})]
    );
    const worldId = created.rows[0].id;
    await client.query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [worldId, actorId]);
    const result = await importContentPackageData(client, worldId, data);
    return { world: created.rows[0], ...result };
  });
}

export async function exportSummaryForWorld(worldId) {
  const snapshot = await buildWorldSnapshot(worldId);
  const assets = await assetSummaryForWorld(worldId);
  return buildContentSummary(snapshot, assets);
}
