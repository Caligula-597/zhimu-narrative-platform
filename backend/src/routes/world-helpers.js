import { query, transaction } from "../db.js";
import { throwErr } from "../api-errors.js";
import { validateDeepseekProposal } from "../deepseek.js";

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

export async function storageUsage(userId) {
  const result = await query(
    `SELECT q.max_bytes, q.max_worlds, q.max_single_file_bytes,
            COALESCE(SUM(a.byte_size) FILTER (WHERE a.status IN ('pending_upload', 'active')), 0)::bigint AS used_bytes
     FROM storage_quotas q
     LEFT JOIN asset_files a ON a.owner_user_id = q.user_id
     WHERE q.user_id = $1
     GROUP BY q.max_bytes, q.max_worlds, q.max_single_file_bytes`,
    [userId]
  );
  if (result.rowCount) return result.rows[0];
  const created = await query(
    `INSERT INTO storage_quotas (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = storage_quotas.updated_at
     RETURNING max_bytes, max_worlds, max_single_file_bytes, 0::bigint AS used_bytes`,
    [userId]
  );
  return created.rows[0];
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
       )`,
    [assetId, actorId]
  );
  if (!result.rowCount) throwErr("ASSET_NOT_FOUND");
  return result.rows[0];
}

export async function buildWorldSnapshot(worldId, client = { query }) {
  const [world, chapters, roles, sections, scenes, clues, points, items, edges, rules, rooms] = await Promise.all([
    client.query(`SELECT id, name, summary, status, settings FROM worlds WHERE id = $1`, [worldId]),
    client.query(`SELECT * FROM chapters WHERE world_id = $1 ORDER BY sequence`, [worldId]),
    client.query(`SELECT * FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId]),
    client.query(
      `SELECT ss.* FROM script_sections ss
       JOIN role_slots rs ON rs.id = ss.role_slot_id
       WHERE rs.world_id = $1 ORDER BY rs.sequence, ss.sequence`,
      [worldId]
    ),
    client.query(`SELECT * FROM scenes WHERE world_id = $1 ORDER BY created_at`, [worldId]),
    client.query(`SELECT * FROM clues WHERE world_id = $1 ORDER BY created_at`, [worldId]),
    client.query(`SELECT * FROM investigation_points WHERE world_id = $1 ORDER BY created_at`, [worldId]),
    client.query(`SELECT id, name FROM items WHERE world_id = $1 ORDER BY created_at`, [worldId]),
    client.query(`SELECT * FROM story_graph_edges WHERE world_id = $1 ORDER BY created_at`, [worldId]),
    client.query(`SELECT * FROM automation_rules WHERE world_id = $1 ORDER BY priority, created_at`, [worldId]),
    client.query(`SELECT id, name, status, invite_code FROM rooms WHERE world_id = $1 ORDER BY created_at DESC`, [worldId])
  ]);
  return {
    world: world.rows[0], chapters: chapters.rows, roles: roles.rows, sections: sections.rows,
    scenes: scenes.rows, clues: clues.rows, investigationPoints: points.rows, items: items.rows, edges: edges.rows,
    rules: rules.rows, rooms: rooms.rows
  };
}

export function creatorChecks(snapshot) {
  const checks = [];
  const add = (level, title, detail) => checks.push({ level, title, detail });
  if (!snapshot.roles.length) add("error", "尚未创建角色", "至少需要一个玩家角色。");
  for (const role of snapshot.roles) {
    const sections = snapshot.sections.filter((section) => section.role_slot_id === role.id);
    if (!sections.length) add("error", `${role.name} 没有私人剧本`, "请为该角色新增至少一幕正文。");
    if (!sections.some((section) => section.publication_status !== "draft")) {
      add("warning", `${role.name} 尚无可测试内容`, "将至少一幕切换为测试中或已发布。");
    }
  }
  if (!snapshot.chapters.length) add("error", "尚未创建公共章节", "请先建立故事章节。");
  if (!snapshot.scenes.length) add("warning", "尚未创建公共场景", "玩家进入房间后将没有可探索地点。");
  if (!snapshot.clues.length) add("warning", "尚未创建线索", "建议至少建立一条可发现线索。");
  for (const section of snapshot.sections) {
    if (!section.body?.trim()) add("error", `${section.title} 正文为空`, "玩家无法阅读空白分幕。");
  }
  for (const point of snapshot.investigationPoints) {
    if (!point.result_text?.trim()) add("warning", `${point.name} 没有调查结果`, "调查点需要告诉玩家搜证后发生了什么。");
  }
  const grantedClueIds = new Set([
    ...snapshot.investigationPoints.map((point) => point.clue_id).filter(Boolean),
    ...snapshot.rules.flatMap((rule) => rule.actions ?? []).filter((action) => action.type === "grant_clue").map((action) => action.clueId)
  ]);
  for (const clue of snapshot.clues) {
    if (!grantedClueIds.has(clue.id)) add("warning", `${clue.name} 没有搜证入口`, "请将线索绑定到调查点，或通过自动化规则发放。");
  }
  if (snapshot.scenes.length > 1 && !snapshot.edges.length) add("warning", "剧情节点尚未连线", "使用主线、并列或延伸关系组织剧情图谱。");
  const linked = new Set(snapshot.edges.flatMap((edge) => [`${edge.from_type}:${edge.from_id}`, `${edge.to_type}:${edge.to_id}`]));
  for (const scene of snapshot.scenes) {
    if (snapshot.scenes.length > 1 && !linked.has(`scene:${scene.id}`)) add("warning", `${scene.name} 尚未进入剧情线`, "该场景目前是孤立节点。");
  }
  for (const rule of snapshot.rules) {
    if (!rule.conditions?.all?.length) add("warning", `${rule.name} 没有检测条件`, "规则不会自动判断何时触发。");
    if (!rule.actions?.length) add("error", `${rule.name} 没有执行动作`, "规则触发后不会产生任何结果。");
    const ids = {
      roles: new Set(snapshot.roles.map((item) => item.id)),
      sections: new Set(snapshot.sections.map((item) => item.id)),
      scenes: new Set(snapshot.scenes.map((item) => item.id)),
      clues: new Set(snapshot.clues.map((item) => item.id)),
      points: new Set(snapshot.investigationPoints.map((item) => item.id))
    };
    for (const condition of rule.conditions?.all ?? []) {
      if (condition.roleSlotId && !ids.roles.has(condition.roleSlotId)) add("error", `${rule.name} 引用了不存在的角色`, condition.roleSlotId);
      if (condition.scriptSectionId && !ids.sections.has(condition.scriptSectionId)) add("error", `${rule.name} 引用了不存在的分幕`, condition.scriptSectionId);
      if (condition.clueId && !ids.clues.has(condition.clueId)) add("error", `${rule.name} 引用了不存在的线索`, condition.clueId);
      if (condition.investigationPointId && !ids.points.has(condition.investigationPointId)) add("error", `${rule.name} 引用了不存在的调查点`, condition.investigationPointId);
    }
    for (const action of rule.actions ?? []) {
      if (action.roleSlotId && !ids.roles.has(action.roleSlotId)) add("error", `${rule.name} 的动作引用了不存在的角色`, action.roleSlotId);
      if (action.scriptSectionId && !ids.sections.has(action.scriptSectionId)) add("error", `${rule.name} 的动作引用了不存在的分幕`, action.scriptSectionId);
      if (action.clueId && !ids.clues.has(action.clueId)) add("error", `${rule.name} 的动作引用了不存在的线索`, action.clueId);
      if (action.sceneId && !ids.scenes.has(action.sceneId)) add("error", `${rule.name} 的动作引用了不存在的场景`, action.sceneId);
    }
  }
  if (!checks.length) add("success", "剧本杀测试清单已通过", "角色、章节、场景与剧情关系均可进入测试。");
  return checks;
}

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

export async function syncManuscriptToGraph(worldId, text) {
  const drafts = classifyStoryDraft(text);
  if (!drafts.length) throwErr("STORY_BLOCKS_EMPTY");
  return transaction(async (client) => {
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
  });
}

export async function importDeepseekProposalWithClient(client, worldId, rawProposal) {
  const proposal = validateDeepseekProposal(rawProposal);
  const chapterIds = new Map(), sceneIds = new Map(), clueIds = new Map(), pointIds = new Map();
  const sequence = await client.query(`SELECT COALESCE(MAX(sequence), 0)::int AS value FROM chapters WHERE world_id = $1`, [worldId]);
  for (const [index, chapter] of proposal.chapters.entries()) {
    const created = await client.query(
      `INSERT INTO chapters (world_id, title, summary, sequence)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [worldId, chapter.title, chapter.summary ?? "", sequence.rows[0].value + index + 1]
    );
    chapterIds.set(chapter.key, created.rows[0].id);
  }
  for (const clue of proposal.clues) {
    const created = await client.query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
       VALUES ($1,$2,$3,$4,'role',$5::jsonb) RETURNING id`,
      [worldId, clue.name, clue.publicText ?? "", clue.hostText ?? "", JSON.stringify({ source: "deepseek_proposal", proposalKey: clue.key })]
    );
    clueIds.set(clue.key, created.rows[0].id);
  }
  for (const scene of proposal.scenes) {
    const created = await client.query(
      `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [worldId, chapterIds.get(scene.chapterKey), scene.name, scene.publicText ?? "", scene.hostText ?? "", JSON.stringify({ source: "deepseek_proposal", proposalKey: scene.key })]
    );
    sceneIds.set(scene.key, created.rows[0].id);
  }
  for (const point of proposal.investigationPoints) {
    const created = await client.query(
      `INSERT INTO investigation_points (world_id, scene_id, name, description, result_text, clue_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
      [worldId, sceneIds.get(point.sceneKey), point.name, point.description ?? "", point.resultText ?? "", point.clueKey ? clueIds.get(point.clueKey) : null, JSON.stringify({ source: "deepseek_proposal", proposalKey: point.key })]
    );
    pointIds.set(point.key, created.rows[0].id);
  }
  const ids = { scene: sceneIds, clue: clueIds, investigation_point: pointIds };
  let edgeCount = 0;
  for (const edge of proposal.edges) {
    const fromId = ids[edge.fromType]?.get(edge.fromKey), toId = ids[edge.toType]?.get(edge.toKey);
    if (!fromId || !toId) continue;
    await client.query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (world_id, from_type, from_id, to_type, to_id, relation_type) DO NOTHING`,
      [worldId, edge.fromType, fromId, edge.toType, toId, edge.relationType, `DeepSeek 提案 · ${edge.label ?? ""}`]
    );
    edgeCount += 1;
  }
  return { chapterIds, summary: { chapters: chapterIds.size, scenes: sceneIds.size, clues: clueIds.size, investigationPoints: pointIds.size, edges: edgeCount } };
}

export async function importDeepseekProposal(worldId, rawProposal) {
  return transaction(async (client) => (await importDeepseekProposalWithClient(client, worldId, rawProposal)).summary);
}

export async function importDeepseekMysteryPackage(worldId, mystery) {
  return transaction(async (client) => {
    const graph = await importDeepseekProposalWithClient(client, worldId, mystery.proposal);
    let sectionCount = 0;
    for (const [roleIndex, role] of mystery.package.roles.entries()) {
      const createdRole = await client.query(
        `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [worldId, role.name, role.publicProfile, role.privateProfile, roleIndex + 1]
      );
      const script = await client.query(
        `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1,$2) RETURNING id`,
        [createdRole.rows[0].id, `${role.name} · 私人剧本`]
      );
      for (const [sectionIndex, section] of role.sections.entries()) {
        await client.query(
          `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,'testing',$7::jsonb)`,
          [script.rows[0].id, createdRole.rows[0].id, graph.chapterIds.get(section.chapterKey), section.title, section.body, sectionIndex + 1, JSON.stringify({ source: "deepseek_mystery_package", chapterKey: section.chapterKey })]
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
}

export async function importDeepseekPipelinePackage(worldId, pipeline) {
  const proposal = validateDeepseekProposal(pipeline.proposal);
  const roles = pipeline.roleMatrix?.roles || pipeline.package?.roles || [];
  if (!roles.length) throwErr("DEEPSEEK_PACKAGE_REQUIRED");
  const sectionsMap = pipeline.sections || {};
  return transaction(async (client) => {
    const graph = await importDeepseekProposalWithClient(client, worldId, proposal);
    let sectionCount = 0;
    for (const [roleIndex, role] of roles.entries()) {
      const createdRole = await client.query(
        `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [worldId, role.name, role.publicProfile || "", role.privateProfile || "", roleIndex + 1]
      );
      const script = await client.query(
        `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1,$2) RETURNING id`,
        [createdRole.rows[0].id, `${role.name} · 私人剧本`]
      );
      const roleSections = sectionsMap[role.key] || {};
      const fromPackage = role.sections || [];
      for (const [sectionIndex, chapter] of proposal.chapters.entries()) {
        const mapped = roleSections[chapter.key];
        const packaged = fromPackage.find((item) => item.chapterKey === chapter.key);
        const body = mapped?.body || packaged?.body;
        if (!body) continue;
        await client.query(
          `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,'testing',$7::jsonb)`,
          [
            script.rows[0].id,
            createdRole.rows[0].id,
            graph.chapterIds.get(chapter.key),
            mapped?.title || packaged?.title || `${chapter.title} · ${role.name}`,
            body,
            sectionIndex + 1,
            JSON.stringify({ source: "deepseek_pipeline", chapterKey: chapter.key, roleKey: role.key })
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
}
