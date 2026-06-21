import { pool, query, transaction } from "../db.js";
import { throwErr } from "../api-errors.js";
import { validateDeepseekProposal } from "../deepseek.js";

async function nextRoleSlotSequence(client, worldId) {
  const row = await client.query(
    `SELECT COALESCE(MAX(sequence), 0)::int AS max_seq FROM role_slots WHERE world_id = $1`,
    [worldId]
  );
  return row.rows[0].max_seq + 1;
}

async function ensureCharacterScript(client, roleSlotId, roleName) {
  const script = await client.query(
    `SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`,
    [roleSlotId]
  );
  if (script.rowCount) return script.rows[0].id;
  const created = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1,$2) RETURNING id`,
    [roleSlotId, `${roleName} · 私人剧本`]
  );
  return created.rows[0].id;
}

/** Resolve pipeline/mystery role by deepseekRoleKey; create at next free sequence if missing. */
async function resolveOrCreateDeepseekRoleSlot(client, worldId, role, roleIndex) {
  const roleKey = role.key || `pipeline-role-${roleIndex}`;
  const existingRole = await client.query(
    `SELECT id FROM role_slots
     WHERE world_id = $1 AND settings->>'deepseekRoleKey' = $2
     LIMIT 1`,
    [worldId, roleKey]
  );
  if (existingRole.rowCount) {
    const roleSlotId = existingRole.rows[0].id;
    await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
    return { roleSlotId, roleKey };
  }

  const nextSequence = await nextRoleSlotSequence(client, worldId);
  const createdRole = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
    [
      worldId,
      role.name,
      role.publicProfile || "",
      role.privateProfile || "",
      nextSequence,
      JSON.stringify({ deepseekRoleKey: roleKey })
    ]
  );
  const roleSlotId = createdRole.rows[0].id;
  await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
  return { roleSlotId, roleKey };
}

function rethrowPipelineImportDbError(error) {
  if (error?.code === "23505") {
    throwErr("CONFLICT", "上传与现有角色或编排数据冲突，请刷新创作中心后重试");
  }
  throw error;
}

/** Rooms visible to actor: owners/editors see all; hosts/viewers only their own hosted or joined rooms. */
export const ROOMS_VISIBLE_TO_ACTOR_SQL = `(
  EXISTS (
    SELECT 1 FROM world_members wm
    WHERE wm.world_id = r.world_id AND wm.user_id = $2 AND wm.role IN ('owner', 'editor')
  )
  OR r.host_user_id = $2
  OR EXISTS (
    SELECT 1 FROM room_members rm
    WHERE rm.room_id = r.id AND rm.user_id = $2 AND rm.status = 'active'
  )
)`;

import { effectiveStorageLimits, countOwnedWorlds } from "../plans.js";

export async function storageUsage(userId) {
  const limits = await effectiveStorageLimits(userId);
  const usage = await query(
    `SELECT COALESCE(SUM(a.byte_size) FILTER (WHERE a.status IN ('pending_upload', 'active')), 0)::bigint AS used_bytes
     FROM asset_files a
     WHERE a.owner_user_id = $1`,
    [userId]
  );
  const used = Number(usage.rows[0]?.used_bytes ?? 0);
  const usedWorlds = await countOwnedWorlds(userId);
  await query(
    `INSERT INTO storage_quotas (user_id, max_bytes, max_worlds, max_single_file_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = storage_quotas.updated_at`,
    [userId, limits.max_bytes, limits.max_worlds, limits.max_single_file_bytes]
  );
  return {
    max_bytes: limits.max_bytes,
    max_worlds: limits.max_worlds,
    max_single_file_bytes: limits.max_single_file_bytes,
    used_bytes: used,
    used_worlds: usedWorlds,
    plan_code: limits.planCode
  };
}

export async function requireAssetRead(actorId, assetId) {
  const result = await query(
    `SELECT a.*, rm.member_type, rm.role_slot_id AS member_role_slot_id
     FROM asset_files a
     LEFT JOIN room_members rm ON rm.room_id = a.room_id AND rm.user_id = $2 AND rm.status = 'active'
     LEFT JOIN world_members wm ON wm.world_id = a.world_id AND wm.user_id = $2
     WHERE a.id = $1 AND a.status = 'active'
       AND (
         a.owner_user_id = $2 OR wm.role IN ('owner', 'editor', 'host')
         OR a.visibility = 'public'
         OR (a.visibility = 'host' AND rm.member_type IN ('host', 'cohost'))
         OR (a.visibility = 'role' AND rm.role_slot_id = a.role_slot_id)
         OR (
           a.visibility = 'role'
           AND a.role_slot_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM room_members rm2
             JOIN rooms r2 ON r2.id = rm2.room_id
             WHERE rm2.user_id = $2
               AND rm2.status = 'active'
               AND rm2.role_slot_id = a.role_slot_id
               AND r2.world_id = a.world_id
           )
         )
       )`,
    [assetId, actorId]
  );
  if (!result.rowCount) throwErr("ASSET_NOT_FOUND");
  return result.rows[0];
}

export async function buildWorldSnapshot(worldId, client = null) {
  if (!client) {
    const pooledClient = await pool.connect();
    try {
      return await buildWorldSnapshot(worldId, pooledClient);
    } finally {
      pooledClient.release();
    }
  }
  const world = await client.query(`SELECT id, name, summary, status, settings FROM worlds WHERE id = $1`, [worldId]);
  const chapters = await client.query(`SELECT * FROM chapters WHERE world_id = $1 ORDER BY sequence`, [worldId]);
  const roles = await client.query(`SELECT * FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId]);
  const sections = await client.query(
    `SELECT ss.* FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1 ORDER BY rs.sequence, ss.sequence`,
    [worldId]
  );
  const scenes = await client.query(`SELECT * FROM scenes WHERE world_id = $1 ORDER BY created_at`, [worldId]);
  const clues = await client.query(`SELECT * FROM clues WHERE world_id = $1 ORDER BY created_at`, [worldId]);
  const points = await client.query(`SELECT * FROM investigation_points WHERE world_id = $1 ORDER BY created_at`, [worldId]);
  const items = await client.query(`SELECT id, name FROM items WHERE world_id = $1 ORDER BY created_at`, [worldId]);
  const edges = await client.query(`SELECT * FROM story_graph_edges WHERE world_id = $1 ORDER BY created_at`, [worldId]);
  const rules = await client.query(`SELECT * FROM automation_rules WHERE world_id = $1 ORDER BY priority, created_at`, [worldId]);
  const rooms = await client.query(`SELECT id, name, status, invite_code FROM rooms WHERE world_id = $1 ORDER BY created_at DESC`, [worldId]);
  return {
    world: world.rows[0], chapters: chapters.rows, roles: roles.rows, sections: sections.rows,
    scenes: scenes.rows, clues: clues.rows, investigationPoints: points.rows, items: items.rows, edges: edges.rows,
    rules: rules.rows, rooms: rooms.rows
  };
}

function automationRuleHasBrokenReferences(rule, snapshot) {
  const ids = {
    roles: new Set(snapshot.roles.map((item) => item.id)),
    sections: new Set(snapshot.sections.map((item) => item.id)),
    scenes: new Set(snapshot.scenes.map((item) => item.id)),
    clues: new Set(snapshot.clues.map((item) => item.id)),
    points: new Set(snapshot.investigationPoints.map((item) => item.id))
  };
  for (const condition of rule.conditions?.all ?? []) {
    if (condition.roleSlotId && !ids.roles.has(condition.roleSlotId)) return true;
    if (condition.scriptSectionId && !ids.sections.has(condition.scriptSectionId)) return true;
    if (condition.clueId && !ids.clues.has(condition.clueId)) return true;
    if (condition.investigationPointId && !ids.points.has(condition.investigationPointId)) return true;
  }
  for (const action of rule.actions ?? []) {
    if (action.roleSlotId && !ids.roles.has(action.roleSlotId)) return true;
    if (action.scriptSectionId && !ids.sections.has(action.scriptSectionId)) return true;
    if (action.clueId && !ids.clues.has(action.clueId)) return true;
    if (action.sceneId && !ids.scenes.has(action.sceneId)) return true;
  }
  return false;
}

export function findBrokenAutomationRuleIds(snapshot) {
  return snapshot.rules.filter((rule) => automationRuleHasBrokenReferences(rule, snapshot)).map((rule) => rule.id);
}

export async function pruneBrokenAutomationRules(worldId, client = null) {
  const run = async (c) => {
    const snapshot = await buildWorldSnapshot(worldId, c);
    const broken = findBrokenAutomationRuleIds(snapshot);
    if (!broken.length) return 0;
    await c.query(`DELETE FROM automation_rules WHERE world_id = $1 AND id = ANY($2::uuid[])`, [worldId, broken]);
    return broken.length;
  };
  if (client) return run(client);
  return transaction(run);
}

export async function compactChapterSequences(client, worldId) {
  const remaining = await client.query(
    `SELECT id FROM chapters WHERE world_id = $1 ORDER BY sequence, created_at`,
    [worldId]
  );
  for (const [index, row] of remaining.rows.entries()) {
    await client.query(
      `UPDATE chapters SET sequence = $1, updated_at = now() WHERE id = $2 AND world_id = $3`,
      [index + 1, row.id, worldId]
    );
  }
  return remaining.rowCount;
}

export function chapterSequencesNeedRepair(chapterRows) {
  if (!chapterRows.length) return false;
  return chapterRows.some((row, index) => Number(row.sequence) !== index + 1);
}

/** Renumber chapters to 1..N when gaps remain (e.g. prologue deleted before auto-compact existed). */
export async function repairChapterSequencesIfNeeded(worldId, client = null) {
  const run = async (c) => {
    const rows = await c.query(
      `SELECT id, sequence FROM chapters WHERE world_id = $1 ORDER BY sequence, created_at`,
      [worldId]
    );
    if (!chapterSequencesNeedRepair(rows.rows)) return 0;
    return compactChapterSequences(c, worldId);
  };
  if (client) return run(client);
  return transaction(run);
}

/** Delete a public chapter, remove bound role sections + dependent rules, renumber survivors. */
export async function deleteWorldChapter(client, worldId, chapterId) {
  const sectionRows = await client.query(
    `SELECT ss.id FROM script_sections ss
     INNER JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1 AND ss.chapter_id = $2`,
    [worldId, chapterId]
  );
  const sectionIds = sectionRows.rows.map((row) => row.id);

  if (sectionIds.length) {
    const rules = await client.query(`SELECT id, conditions, actions FROM automation_rules WHERE world_id = $1`, [worldId]);
    const sectionIdSet = new Set(sectionIds);
    const ruleIdsToDelete = rules.rows.filter((rule) => {
      const conditionHit = (rule.conditions?.all ?? []).some((item) => sectionIdSet.has(item.scriptSectionId));
      const actionHit = (rule.actions ?? []).some((item) => sectionIdSet.has(item.scriptSectionId));
      return conditionHit || actionHit;
    }).map((rule) => rule.id);
    if (ruleIdsToDelete.length) {
      await client.query(`DELETE FROM automation_rules WHERE world_id = $1 AND id = ANY($2::uuid[])`, [worldId, ruleIdsToDelete]);
    }
    await client.query(`DELETE FROM script_sections WHERE id = ANY($1::uuid[])`, [sectionIds]);
  }

  await client.query(
    `DELETE FROM story_graph_edges
     WHERE world_id = $1 AND ((from_type = 'chapter' AND from_id = $2) OR (to_type = 'chapter' AND to_id = $2))`,
    [worldId, chapterId]
  );

  const deleted = await client.query(
    `DELETE FROM chapters WHERE id = $1 AND world_id = $2 RETURNING id`,
    [chapterId, worldId]
  );
  if (!deleted.rowCount) return null;

  await compactChapterSequences(client, worldId);
  await pruneBrokenAutomationRules(worldId, client);
  return { deletedId: chapterId, sectionsRemoved: sectionIds.length };
}

export { creatorChecks } from "../world-publish-readiness.js";

export function classifyStoryDraft(text) {
  const blocks = String(text ?? "").split(/\n\s*\n|\r?\n(?=(?:场景|线索|调查点|地点|证据|搜证|scene|clue|point|investigation)\s*[：:])/i).map((item) => item.trim()).filter(Boolean);
  let sceneIndex = 0;
  return blocks.slice(0, 80).map((block, index) => {
    const [prefix = "", ...rest] = block.split(/[：:]/);
    const body = rest.length ? rest.join("：").trim() : block;
    const normalized = prefix.trim();
    let type = "scene";
    if (/^(线索|证据|clue)$/i.test(normalized) || /线索|证据|信件|记录|残页|照片|钥匙/.test(block)) type = "clue";
    if (/^(调查点|搜证|point|investigation)$/i.test(normalized) || /调查点|搜查|检查|翻找|调查/.test(block)) type = "investigation_point";
    if (/^(场景|地点|scene)$/i.test(normalized)) type = "scene";
    if (type === "scene") sceneIndex += 1;
    const name = body.split(/[。；;，,\n]/)[0].trim().slice(0, 42) || `${type}-${index + 1}`;
    return { key: `draft-${index + 1}`, type, name, text: body, sceneIndex };
  });
}

export function storyDraftEdges(nodes) {
  return nodes.slice(1).map((node, index) => {
    const previous = nodes[index];
    return {
      fromKey: previous.key,
      toKey: node.key,
      relationType: node.type === "scene" && previous.type === "scene" ? "mainline" : "extension",
      label: node.type === "scene" && previous.type === "scene" ? "助手生成 · 剧情推进" : "助手生成 · 内容关联"
    };
  });
}

export function storyDraftSuggestions(nodes) {
  const suggestions = [];
  if (!nodes.some((node) => node.type === "scene")) suggestions.push("至少补充一个场景，让玩家知道剧情发生在哪里。");
  if (!nodes.some((node) => node.type === "investigation_point")) suggestions.push("建议补充调查点，明确玩家可以主动搜查什么。");
  if (!nodes.some((node) => node.type === "clue")) suggestions.push("建议补充至少一条线索，形成可被玩家获得的信息。");
  if (nodes.length < 3) suggestions.push("当前剧情片段较少，可以继续补充后续变化或新的可探索地点。");
  if (!suggestions.length) suggestions.push("结构已经包含场景、调查点和线索，可以写入剧情编排后继续调整关系。");
  return suggestions;
}

export function renderStoryManuscript(snapshot) {
  const lines = ["# 完整剧情文稿", "", "这份母稿由剧情编排生成。可以继续编辑，再同步回剧情编排。", ""];
  for (const scene of snapshot.scenes) {
    lines.push(`场景：${scene.name}`, scene.public_text || scene.host_text || "待补充场景说明", "");
    for (const point of snapshot.investigationPoints.filter((item) => item.scene_id === scene.id)) {
      lines.push(`调查点：${point.name}`, point.description || point.result_text || "待补充调查结果", "");
      const clue = snapshot.clues.find((item) => item.id === point.clue_id);
      if (clue) lines.push(`线索：${clue.name}`, clue.public_text || clue.host_text || "待补充线索内容", "");
    }
  }
  const linkedClueIds = new Set(snapshot.investigationPoints.map((item) => item.clue_id).filter(Boolean));
  for (const clue of snapshot.clues.filter((item) => !linkedClueIds.has(item.id))) {
    lines.push(`线索：${clue.name}`, clue.public_text || clue.host_text || "待补充线索内容", "");
  }
  return lines.join("\n").trim();
}

export async function syncManuscriptToGraph(worldId, text, existingClient = null) {
  const drafts = classifyStoryDraft(text);
  if (!drafts.length) throwErr("STORY_BLOCKS_EMPTY");
  const work = async (client) => {
    const ids = new Map();
    let currentSceneId = null;
    await client.query(`DELETE FROM story_graph_edges WHERE world_id = $1 AND label LIKE '完整剧情同步%'`, [worldId]);
    await client.query(
      `DELETE FROM story_graph_edges
       WHERE world_id = $1 AND (
         (from_type = 'scene' AND from_id IN (SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (to_type = 'scene' AND to_id IN (SELECT id FROM scenes WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (from_type = 'clue' AND from_id IN (SELECT id FROM clues WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (to_type = 'clue' AND to_id IN (SELECT id FROM clues WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (from_type = 'investigation_point' AND from_id IN (SELECT id FROM investigation_points WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
         OR (to_type = 'investigation_point' AND to_id IN (SELECT id FROM investigation_points WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'))
       )`,
      [worldId]
    );
    await client.query(`DELETE FROM investigation_points WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'`, [worldId]);
    await client.query(`DELETE FROM clues WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'`, [worldId]);
    await client.query(`DELETE FROM scenes WHERE world_id = $1 AND metadata->>'source' = 'story_manuscript'`, [worldId]);
    for (const draft of drafts) {
      const metadata = JSON.stringify({ source: "story_manuscript", manuscriptKey: draft.key });
      let created;
      if (draft.type === "scene") {
        created = await client.query(
          `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
           VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
          [worldId, draft.name, draft.text, "完整剧情母稿同步，等待创作者复核。", metadata]
        );
        currentSceneId = created.rows[0].id;
      } else if (draft.type === "clue") {
        created = await client.query(
          `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
           VALUES ($1,$2,$3,$4,'role',$5::jsonb) RETURNING id`,
          [worldId, draft.name, draft.text, "完整剧情母稿同步，等待创作者复核。", metadata]
        );
      } else {
        if (!currentSceneId) {
          const fallback = await client.query(
            `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
             VALUES ($1,'待整理场景','完整剧情母稿为未归属调查点建立的临时场景。',$2,$3::jsonb) RETURNING id`,
            [worldId, "请在剧情编排中调整归属。", JSON.stringify({ source: "story_manuscript", fallback: true })]
          );
          currentSceneId = fallback.rows[0].id;
        }
        created = await client.query(
          `INSERT INTO investigation_points (world_id, scene_id, name, description, result_text, metadata)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
          [worldId, currentSceneId, draft.name, draft.text, draft.text, metadata]
        );
      }
      ids.set(draft.key, { type: draft.type, id: created.rows[0].id });
    }
    for (let index = 1; index < drafts.length; index += 1) {
      const clue = ids.get(drafts[index].key), point = ids.get(drafts[index - 1].key);
      if (drafts[index].type === "clue" && drafts[index - 1].type === "investigation_point") {
        await client.query(`UPDATE investigation_points SET clue_id = $1 WHERE id = $2 AND world_id = $3`, [clue.id, point.id, worldId]);
      }
    }
    const edges = [];
    for (const edge of storyDraftEdges(drafts)) {
      const from = ids.get(edge.fromKey), to = ids.get(edge.toKey);
      if (!from || !to) continue;
      const created = await client.query(
        `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [worldId, from.type, from.id, to.type, to.id, edge.relationType, `完整剧情同步 · ${edge.label}`]
      );
      edges.push(created.rows[0]);
    }
    return { nodes: drafts.length, edges: edges.length, suggestions: storyDraftSuggestions(drafts) };
  };
  if (existingClient) return work(existingClient);
  return transaction(work);
}

export async function importDeepseekProposalWithClient(client, worldId, rawProposal) {
  const proposal = validateDeepseekProposal(rawProposal);
  const chapterIds = new Map();
  const sceneIds = new Map();
  const clueIds = new Map();
  const pointIds = new Map();
  const sourceTag = "deepseek_proposal";

  async function findExistingId(table, proposalKey) {
    const row = await client.query(
      `SELECT id FROM ${table}
       WHERE world_id = $1 AND metadata->>'proposalKey' = $2 AND metadata->>'source' = $3
       LIMIT 1`,
      [worldId, proposalKey, sourceTag]
    );
    return row.rowCount ? row.rows[0].id : null;
  }

  async function resolveChapterId(chapterKey, chapter) {
    const fromScene = await client.query(
      `SELECT chapter_id FROM scenes
       WHERE world_id = $1 AND metadata->>'chapterKey' = $2
       LIMIT 1`,
      [worldId, chapterKey]
    );
    if (fromScene.rowCount) return fromScene.rows[0].chapter_id;

    const fromTitle = await client.query(
      `SELECT c.id FROM chapters c
       WHERE c.world_id = $1 AND c.title = $2
         AND EXISTS (
           SELECT 1 FROM scenes s
           WHERE s.chapter_id = c.id AND s.metadata->>'source' = $3
         )
       ORDER BY c.sequence
       LIMIT 1`,
      [worldId, chapter.title, sourceTag]
    );
    return fromTitle.rowCount ? fromTitle.rows[0].id : null;
  }

  const sequence = await client.query(`SELECT COALESCE(MAX(sequence), 0)::int AS value FROM chapters WHERE world_id = $1`, [worldId]);
  let nextSequence = sequence.rows[0].value;
  for (const [index, chapter] of proposal.chapters.entries()) {
    const existingId = await resolveChapterId(chapter.key, chapter);
    if (existingId) {
      chapterIds.set(chapter.key, existingId);
      continue;
    }
    nextSequence += 1;
    const created = await client.query(
      `INSERT INTO chapters (world_id, title, summary, sequence)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [worldId, chapter.title, chapter.summary ?? "", nextSequence]
    );
    chapterIds.set(chapter.key, created.rows[0].id);
  }

  for (const clue of proposal.clues) {
    const existingId = await findExistingId("clues", clue.key);
    if (existingId) {
      clueIds.set(clue.key, existingId);
      continue;
    }
    const created = await client.query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
       VALUES ($1,$2,$3,$4,'role',$5::jsonb) RETURNING id`,
      [worldId, clue.name, clue.publicText ?? "", clue.hostText ?? "", JSON.stringify({ source: sourceTag, proposalKey: clue.key })]
    );
    clueIds.set(clue.key, created.rows[0].id);
  }

  for (const scene of proposal.scenes) {
    const existingId = await findExistingId("scenes", scene.key);
    if (existingId) {
      sceneIds.set(scene.key, existingId);
      continue;
    }
    const created = await client.query(
      `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [
        worldId,
        chapterIds.get(scene.chapterKey),
        scene.name,
        scene.publicText ?? "",
        scene.hostText ?? "",
        JSON.stringify({ source: sourceTag, proposalKey: scene.key, chapterKey: scene.chapterKey })
      ]
    );
    sceneIds.set(scene.key, created.rows[0].id);
  }

  for (const point of proposal.investigationPoints) {
    const existingId = await findExistingId("investigation_points", point.key);
    if (existingId) {
      pointIds.set(point.key, existingId);
      continue;
    }
    const created = await client.query(
      `INSERT INTO investigation_points (world_id, scene_id, name, description, result_text, clue_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
      [
        worldId,
        sceneIds.get(point.sceneKey),
        point.name,
        point.description ?? "",
        point.resultText ?? "",
        point.clueKey ? clueIds.get(point.clueKey) : null,
        JSON.stringify({ source: sourceTag, proposalKey: point.key })
      ]
    );
    pointIds.set(point.key, created.rows[0].id);
  }

  const ids = { scene: sceneIds, clue: clueIds, investigation_point: pointIds };
  let edgeCount = 0;
  for (const edge of proposal.edges) {
    const fromId = ids[edge.fromType]?.get(edge.fromKey);
    const toId = ids[edge.toType]?.get(edge.toKey);
    if (!fromId || !toId) continue;
    await client.query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (world_id, from_type, from_id, to_type, to_id, relation_type) DO NOTHING`,
      [worldId, edge.fromType, fromId, edge.toType, toId, edge.relationType, `DeepSeek 提案 · ${edge.label ?? ""}`]
    );
    edgeCount += 1;
  }
  return {
    chapterIds,
    summary: {
      chapters: chapterIds.size,
      scenes: sceneIds.size,
      clues: clueIds.size,
      investigationPoints: pointIds.size,
      edges: edgeCount
    }
  };
}

export async function importDeepseekProposal(worldId, rawProposal) {
  return transaction(async (client) => (await importDeepseekProposalWithClient(client, worldId, rawProposal)).summary);
}

export async function importDeepseekMysteryPackage(worldId, mystery) {
  try {
    return await transaction(async (client) => {
      const graph = await importDeepseekProposalWithClient(client, worldId, mystery.proposal);
      let sectionCount = 0;
      for (const [roleIndex, role] of mystery.package.roles.entries()) {
        const { roleSlotId, roleKey } = await resolveOrCreateDeepseekRoleSlot(client, worldId, { ...role, key: role.key || `mystery-role-${roleIndex}` }, roleIndex);
        const scriptId = await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
        if (!scriptId) continue;
        for (const [sectionIndex, section] of role.sections.entries()) {
          const chapterKey = section.chapterKey;
          const existingSection = await client.query(
            `SELECT id FROM script_sections
             WHERE role_slot_id = $1 AND metadata->>'chapterKey' = $2 AND metadata->>'roleKey' = $3
             LIMIT 1`,
            [roleSlotId, chapterKey, roleKey]
          );
          if (existingSection.rowCount) continue;
          await client.query(
            `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,'testing',$7::jsonb)`,
            [
              scriptId,
              roleSlotId,
              graph.chapterIds.get(chapterKey),
              section.title,
              section.body,
              sectionIndex + 1,
              JSON.stringify({ source: "deepseek_mystery_package", chapterKey, roleKey })
            ]
          );
          sectionCount += 1;
        }
      }
      await client.query(
        `UPDATE worlds SET name = $1, summary = $2, updated_at = now() WHERE id = $3`,
        [mystery.package.title, mystery.package.summary, worldId]
      );
      await client.query(
        `INSERT INTO story_manuscripts (world_id, body, last_sync_direction)
         VALUES ($1,$2,'manual')
         ON CONFLICT (world_id) DO UPDATE SET body = EXCLUDED.body, last_sync_direction = EXCLUDED.last_sync_direction, updated_at = now()`,
        [worldId, mystery.package.overallManuscript]
      );
      return { ...graph.summary, roles: mystery.package.roles.length, sections: sectionCount, manuscriptCharacters: mystery.package.overallManuscript.length };
    });
  } catch (error) {
    rethrowPipelineImportDbError(error);
  }
}

export async function importDeepseekPipelinePackage(worldId, pipeline) {
  const proposal = validateDeepseekProposal(pipeline.proposal);
  const roles = pipeline.roleMatrix?.roles || pipeline.package?.roles || [];
  if (!roles.length) throwErr("DEEPSEEK_PACKAGE_REQUIRED");
  const sectionsMap = pipeline.sections || {};
  try {
    return await transaction(async (client) => {
      const graph = await importDeepseekProposalWithClient(client, worldId, proposal);
      let sectionCount = 0;
      for (const [roleIndex, role] of roles.entries()) {
        const { roleSlotId, roleKey } = await resolveOrCreateDeepseekRoleSlot(client, worldId, role, roleIndex);
        const scriptId = await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
        if (!scriptId) continue;

        const roleSections = sectionsMap[role.key] || sectionsMap[roleKey] || {};
        const fromPackage = role.sections || [];
        for (const [sectionIndex, chapter] of proposal.chapters.entries()) {
          const mapped = roleSections[chapter.key];
          const packaged = fromPackage.find((item) => item.chapterKey === chapter.key);
          const body = mapped?.body || packaged?.body;
          if (!body) continue;

          const existingSection = await client.query(
            `SELECT id FROM script_sections
             WHERE role_slot_id = $1 AND metadata->>'chapterKey' = $2 AND metadata->>'roleKey' = $3
             LIMIT 1`,
            [roleSlotId, chapter.key, roleKey]
          );
          if (existingSection.rowCount) continue;

          await client.query(
            `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,'testing',$7::jsonb)`,
            [
              scriptId,
              roleSlotId,
              graph.chapterIds.get(chapter.key),
              mapped?.title || packaged?.title || `${chapter.title} · ${role.name}`,
              body,
              sectionIndex + 1,
              JSON.stringify({ source: "deepseek_pipeline", chapterKey: chapter.key, roleKey })
            ]
          );
          sectionCount += 1;
        }
      }
      const synopsis = pipeline.synopsis || pipeline.package;
      if (synopsis?.title || synopsis?.summary) {
        await client.query(
          `UPDATE worlds SET name = COALESCE($1, name), summary = COALESCE($2, summary), updated_at = now() WHERE id = $3`,
          [synopsis.title || null, synopsis.summary || null, worldId]
        );
      }
      const manuscript = synopsis?.overallManuscript;
      if (manuscript) {
        await client.query(
          `INSERT INTO story_manuscripts (world_id, body, last_sync_direction)
           VALUES ($1,$2,'manual')
           ON CONFLICT (world_id) DO UPDATE SET body = EXCLUDED.body, last_sync_direction = EXCLUDED.last_sync_direction, updated_at = now()`,
          [worldId, manuscript]
        );
      }
      return {
        ...graph.summary,
        roles: roles.length,
        sections: sectionCount,
        manuscriptCharacters: manuscript?.length || 0
      };
    });
  } catch (error) {
    rethrowPipelineImportDbError(error);
  }
}
