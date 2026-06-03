import { query, transaction } from "./db.js";
import { evaluateRoomRules, executeActions } from "./rule-engine.js";
import { validateUpload } from "./asset-policy.js";
import { getObjectStorage } from "./storage/index.js";
import { randomUUID } from "node:crypto";
import { createDeepseekMysteryPackage, createDeepseekStoryProposal, deepseekConfig, validateDeepseekProposal } from "./deepseek.js";
import { parseCreatorDocument } from "./document-parser.js";
import { requireActor } from "./request-actor.js";

async function requireRoomRole(actorId, roomId) {
  const result = await query(
    `SELECT rm.role_slot_id, rm.member_type
     FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [roomId, actorId]
  );
  if (!result.rowCount) {
    const error = new Error("Room membership required");
    error.statusCode = 403;
    throw error;
  }
  return result.rows[0];
}

async function requireWorldRole(actorId, worldId, allowedRoles = ["owner", "editor"]) {
  const result = await query(
    `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [worldId, actorId]
  );
  if (!result.rowCount || !allowedRoles.includes(result.rows[0].role)) {
    const error = new Error("World editor permission required");
    error.statusCode = 403;
    throw error;
  }
  return result.rows[0];
}

async function requireVoiceRoomAccess(actorId, voiceRoomId) {
  const result = await query(
    `SELECT vr.id, vr.room_id, vr.name, vr.room_type
     FROM voice_rooms vr
     JOIN room_members rm ON rm.room_id = vr.room_id AND rm.user_id = $2 AND rm.status = 'active'
     WHERE vr.id = $1 AND vr.status = 'active'
       AND (
         vr.room_type = 'public'
         OR EXISTS (
           SELECT 1 FROM voice_room_members vrm
           WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
         )
       )`,
    [voiceRoomId, actorId]
  );
  if (!result.rowCount) throw Object.assign(new Error("Voice room membership required"), { statusCode: 403 });
  return result.rows[0];
}

async function storageUsage(userId) {
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

async function requireAssetRead(actorId, assetId) {
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
  if (!result.rowCount) throw Object.assign(new Error("Asset not found or permission denied"), { statusCode: 404 });
  return result.rows[0];
}

async function buildWorldSnapshot(worldId, client = { query }) {
  const [world, chapters, roles, sections, scenes, clues, points, edges, rules, rooms] = await Promise.all([
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
    client.query(`SELECT * FROM story_graph_edges WHERE world_id = $1 ORDER BY created_at`, [worldId]),
    client.query(`SELECT * FROM automation_rules WHERE world_id = $1 ORDER BY priority, created_at`, [worldId]),
    client.query(`SELECT id, name, status, invite_code FROM rooms WHERE world_id = $1 ORDER BY created_at DESC`, [worldId])
  ]);
  return {
    world: world.rows[0], chapters: chapters.rows, roles: roles.rows, sections: sections.rows,
    scenes: scenes.rows, clues: clues.rows, investigationPoints: points.rows, edges: edges.rows,
    rules: rules.rows, rooms: rooms.rows
  };
}

function creatorChecks(snapshot) {
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

function classifyStoryDraft(text) {
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

function storyDraftEdges(nodes) {
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

function storyDraftSuggestions(nodes) {
  const suggestions = [];
  if (!nodes.some((node) => node.type === "scene")) suggestions.push("至少补充一个场景，让玩家知道剧情发生在哪里。");
  if (!nodes.some((node) => node.type === "investigation_point")) suggestions.push("建议补充调查点，明确玩家可以主动搜查什么。");
  if (!nodes.some((node) => node.type === "clue")) suggestions.push("建议补充至少一条线索，形成可被玩家获得的信息。");
  if (nodes.length < 3) suggestions.push("当前剧情片段较少，可以继续补充后续变化或新的可探索地点。");
  if (!suggestions.length) suggestions.push("结构已经包含场景、调查点和线索，可以写入剧情编排后继续调整关系。");
  return suggestions;
}

function renderStoryManuscript(snapshot) {
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

async function syncManuscriptToGraph(worldId, text) {
  const drafts = classifyStoryDraft(text);
  if (!drafts.length) throw Object.assign(new Error("No story blocks detected"), { statusCode: 400 });
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

async function importDeepseekProposalWithClient(client, worldId, rawProposal) {
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

async function importDeepseekProposal(worldId, rawProposal) {
  return transaction(async (client) => (await importDeepseekProposalWithClient(client, worldId, rawProposal)).summary);
}

async function importDeepseekMysteryPackage(worldId, mystery) {
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

export async function registerRoutes(app) {
  app.get("/api/worlds", async (request) => {
    const actorId = requireActor(request);
    const result = await query(
      `SELECT w.id, w.name, w.summary, w.status, wm.role AS membership_role
       FROM worlds w
       JOIN world_members wm ON wm.world_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.updated_at DESC`,
      [actorId]
    );
    return result.rows;
  });

  app.post("/api/worlds", async (request, reply) => {
    const actorId = requireActor(request);
    const { name, summary = "", settings = {} } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const quota = await storageUsage(actorId);
    const worldCount = await query(`SELECT COUNT(*)::int AS count FROM worlds WHERE owner_user_id = $1 AND status <> 'archived'`, [actorId]);
    if (worldCount.rows[0].count >= quota.max_worlds) {
      return reply.code(403).send({ error: "World quota exceeded" });
    }
    const world = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO worlds (owner_user_id, name, summary, settings) VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
        [actorId, name, summary, JSON.stringify(settings)]
      );
      await client.query(
        `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [result.rows[0].id, actorId]
      );
      return result.rows[0];
    });
    return reply.code(201).send(world);
  });

  app.delete("/api/worlds/:worldId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const result = await query(`DELETE FROM worlds WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [worldId, actorId]);
    if (!result.rowCount) return reply.code(404).send({ error: "World not found" });
    return { ok: true };
  });

  app.get("/api/worlds/:worldId/members", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const result = await query(
      `SELECT wm.user_id, u.email, u.display_name, wm.role, wm.created_at
       FROM world_members wm JOIN users u ON u.id = wm.user_id
       WHERE wm.world_id = $1 ORDER BY wm.created_at`,
      [worldId]
    );
    return result.rows;
  });

  app.post("/api/worlds/:worldId/members", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const email = String(request.body?.email ?? "").trim().toLowerCase();
    const role = String(request.body?.role ?? "viewer");
    if (!["editor", "host", "viewer"].includes(role)) return reply.code(400).send({ error: "Unsupported collaboration role" });
    const user = await query(`SELECT id, email, display_name FROM users WHERE email = $1`, [email]);
    if (!user.rowCount) return reply.code(404).send({ error: "该邮箱尚未注册，请先让协作者完成注册。" });
    await query(
      `INSERT INTO world_members (world_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (world_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [worldId, user.rows[0].id, role]
    );
    return reply.code(201).send({ ...user.rows[0], role });
  });

  app.put("/api/worlds/:worldId/members/:userId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, userId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const role = String(request.body?.role ?? "");
    if (!["editor", "host", "viewer"].includes(role)) return reply.code(400).send({ error: "Unsupported collaboration role" });
    const result = await query(`UPDATE world_members SET role = $1 WHERE world_id = $2 AND user_id = $3 AND role <> 'owner' RETURNING user_id, role`, [role, worldId, userId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Collaboration member not found or owner cannot be changed" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/members/:userId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, userId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner"]);
    const result = await query(`DELETE FROM world_members WHERE world_id = $1 AND user_id = $2 AND role <> 'owner' RETURNING user_id`, [worldId, userId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Collaboration member not found or owner cannot be removed" });
    return { ok: true };
  });

  app.get("/api/worlds/:worldId/logs", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const roomId = String(request.query?.roomId ?? "");
    const eventType = String(request.query?.eventType ?? "");
    const keyword = String(request.query?.keyword ?? "").slice(0, 120);
    const limit = Math.max(1, Math.min(200, Number(request.query?.limit) || 80));
    const result = await query(
      `SELECT tl.id, tl.room_id, r.name AS room_name, tl.event_type, tl.message, tl.visibility,
              tl.metadata, tl.created_at, u.display_name AS actor_name
       FROM timeline_logs tl JOIN rooms r ON r.id = tl.room_id
       LEFT JOIN users u ON u.id = tl.actor_user_id
       WHERE r.world_id = $1 AND ($2::uuid IS NULL OR tl.room_id = $2::uuid)
         AND ($3 = '' OR tl.event_type = $3) AND ($4 = '' OR tl.message ILIKE '%' || $4 || '%')
       ORDER BY tl.created_at DESC LIMIT $5`,
      [worldId, roomId || null, eventType, keyword, limit]
    );
    return result.rows;
  });

  app.post("/api/worlds/:worldId/documents/parse", async (request) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId);
    return parseCreatorDocument(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/documents/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { target = "manuscript", roleSlotId = null, document } = request.body ?? {};
    if (!document?.text || !Array.isArray(document.sections)) return reply.code(400).send({ error: "Parsed document is required" });
    if (target === "manuscript") {
      await query(
        `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
         VALUES ($1,$2,'manual',$3) ON CONFLICT (world_id) DO UPDATE
         SET body = EXCLUDED.body, last_sync_direction = 'manual', updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
        [worldId, document.text, actorId]
      );
      return reply.code(201).send({ target, sections: document.sections.length });
    }
    const role = await query(`SELECT id FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, worldId]);
    if (!role.rowCount) return reply.code(400).send({ error: "Valid roleSlotId is required for role script import" });
    const imported = await transaction(async (client) => {
      const script = await client.query(`INSERT INTO character_scripts (role_slot_id, title) SELECT $1, '角色私人剧本' WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1) RETURNING id`, [roleSlotId]);
      const scriptId = script.rows[0]?.id ?? (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId])).rows[0].id;
      const max = await client.query(`SELECT COALESCE(MAX(sequence),0)::int AS value FROM script_sections WHERE character_script_id = $1`, [scriptId]);
      for (const [index, section] of document.sections.entries()) {
        await client.query(
          `INSERT INTO script_sections (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
           VALUES ($1,$2,$3,$4,$5,'draft',$6::jsonb)`,
          [scriptId, roleSlotId, section.title, section.body, max.rows[0].value + index + 1, JSON.stringify({ source: "document_import", filename: document.filename })]
        );
      }
      return document.sections.length;
    });
    return reply.code(201).send({ target: "role_script", sections: imported });
  });

  app.post("/api/worlds/:worldId/roles", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    if (!name || !sequence) return reply.code(400).send({ error: "name and sequence are required" });
    const result = await query(
      `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [worldId, name, publicProfile, privateProfile, sequence]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    if (!name || !sequence) return reply.code(400).send({ error: "name and sequence are required" });
    const result = await query(
      `UPDATE role_slots
       SET name = $1, public_profile = $2, private_profile = $3, sequence = $4
       WHERE id = $5 AND world_id = $6 RETURNING *`,
      [name, publicProfile, privateProfile, sequence, roleSlotId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Role slot not found" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM role_slots WHERE id = $1 AND world_id = $2 RETURNING id`, [roleSlotId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Role slot not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/chapters", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", sequence } = request.body ?? {};
    if (!title || !sequence) return reply.code(400).send({ error: "title and sequence are required" });
    const result = await query(
      `INSERT INTO chapters (world_id, title, summary, sequence)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [worldId, title, summary, sequence]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.put("/api/worlds/:worldId/chapters/:chapterId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, chapterId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", publicationStatus = "draft", unlockRules = {} } = request.body ?? {};
    if (!title) return reply.code(400).send({ error: "title is required" });
    if (!["draft", "testing", "published"].includes(publicationStatus)) return reply.code(400).send({ error: "Unsupported publicationStatus" });
    const result = await query(
      `UPDATE chapters SET title = $1, summary = $2, publication_status = $3, unlock_rules = $4::jsonb, updated_at = now()
       WHERE id = $5 AND world_id = $6 RETURNING *`,
      [title, summary, publicationStatus, JSON.stringify(unlockRules), chapterId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Chapter not found" });
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/roles/:roleSlotId/sections", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, sequence, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
    if (!title || !body || !sequence) return reply.code(400).send({ error: "title, body and sequence are required" });
    if (!["draft", "testing", "published"].includes(publicationStatus)) return reply.code(400).send({ error: "Unsupported publicationStatus" });
    const section = await transaction(async (client) => {
      const script = await client.query(
        `INSERT INTO character_scripts (role_slot_id, title)
         SELECT $1, '角色私人剧本'
         WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
         RETURNING id`,
        [roleSlotId]
      );
      const scriptId = script.rows[0]?.id ?? (
        await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId])
      ).rows[0].id;
      const result = await client.query(
        `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [scriptId, roleSlotId, chapterId, title, body, sequence, publicationStatus]
      );
      return result.rows[0];
    });
    return reply.code(201).send(section);
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
    if (!title || !body) return reply.code(400).send({ error: "title and body are required" });
    if (!["draft", "testing", "published"].includes(publicationStatus)) return reply.code(400).send({ error: "Unsupported publicationStatus" });
    const result = await query(
      `UPDATE script_sections ss SET title = $1, body = $2, chapter_id = $3, publication_status = $4, updated_at = now()
       FROM role_slots rs
       WHERE ss.id = $5 AND ss.role_slot_id = $6 AND rs.id = ss.role_slot_id AND rs.world_id = $7
       RETURNING ss.*`,
      [title, body, chapterId || null, publicationStatus, sectionId, roleSlotId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Script section not found" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `DELETE FROM script_sections ss USING role_slots rs
       WHERE ss.id = $1 AND ss.role_slot_id = $2 AND rs.id = ss.role_slot_id AND rs.world_id = $3
       RETURNING ss.id`,
      [sectionId, roleSlotId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Script section not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/rooms", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const { name, inviteCode } = request.body ?? {};
    if (!name || !inviteCode) return reply.code(400).send({ error: "name and inviteCode are required" });
    const room = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
         VALUES ($1, $2, $3, $4, 'testing') RETURNING *`,
        [worldId, actorId, name, inviteCode]
      );
      await client.query(
        `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')`,
        [result.rows[0].id, actorId]
      );
      await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, '公共讨论房', 'public', $2)`,
        [result.rows[0].id, actorId]
      );
      return result.rows[0];
    });
    return reply.code(201).send(room);
  });

  app.get("/api/worlds/:worldId/rooms", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const result = await query(
      `SELECT r.id, r.name, r.invite_code, r.status, r.created_at,
              COUNT(rm.user_id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.status = 'active'
       WHERE r.world_id = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [worldId]
    );
    return result.rows;
  });

  app.post("/api/worlds/:worldId/rules", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { roomId = null, name, mode = "automatic", priority = 100, enabled = true, conditions, actions } = request.body ?? {};
    if (!name || !conditions || !actions) return reply.code(400).send({ error: "name, conditions and actions are required" });
    if (!["automatic", "host_confirm", "manual"].includes(mode)) return reply.code(400).send({ error: "Unsupported rule mode" });
    if (roomId) {
      const room = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
      if (!room.rowCount) return reply.code(400).send({ error: "roomId does not belong to worldId" });
    }
    const result = await query(
      `INSERT INTO automation_rules (world_id, room_id, name, mode, priority, enabled, conditions, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb) RETURNING *`,
      [worldId, roomId, name, mode, priority, Boolean(enabled), JSON.stringify(conditions), JSON.stringify(actions)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/worlds/:worldId/rules", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `SELECT ar.*, r.name AS room_name
       FROM automation_rules ar
       LEFT JOIN rooms r ON r.id = ar.room_id
       WHERE ar.world_id = $1 ORDER BY ar.priority, ar.created_at`,
      [worldId]
    );
    return result.rows;
  });

  app.put("/api/worlds/:worldId/rules/:ruleId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { roomId = null, name, mode = "automatic", priority = 100, enabled = true, conditions, actions } = request.body ?? {};
    if (!name || !conditions || !actions) return reply.code(400).send({ error: "name, conditions and actions are required" });
    if (!["automatic", "host_confirm", "manual"].includes(mode)) return reply.code(400).send({ error: "Unsupported rule mode" });
    const result = await query(
      `UPDATE automation_rules
       SET room_id = $1, name = $2, mode = $3, priority = $4, enabled = $5,
           conditions = $6::jsonb, actions = $7::jsonb, updated_at = now()
       WHERE id = $8 AND world_id = $9 RETURNING *`,
      [roomId || null, name, mode, Number(priority) || 100, Boolean(enabled), JSON.stringify(conditions), JSON.stringify(actions), ruleId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Rule not found" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/rules/:ruleId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM automation_rules WHERE id = $1 AND world_id = $2 RETURNING id`, [ruleId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Rule not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/rules/validate", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const snapshot = await buildWorldSnapshot(worldId);
    return { checks: creatorChecks(snapshot), totalRules: snapshot.rules.length };
  });

  app.get("/api/worlds/:worldId/content-package", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { format: "zhimu-world-package", version: 1, exportedAt: new Date().toISOString(), data: await buildWorldSnapshot(worldId) };
  });

  app.post("/api/worlds/:worldId/content-package/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const payload = request.body?.data ?? request.body;
    if (!payload || !Array.isArray(payload.roles) || !Array.isArray(payload.chapters)) {
      return reply.code(400).send({ error: "A valid Zhimu JSON content package is required" });
    }
    const counts = await transaction(async (client) => {
      const chapterIds = new Map(), roleIds = new Map(), sectionIds = new Map(), sceneIds = new Map(), clueIds = new Map(), pointIds = new Map();
      for (const chapter of payload.chapters) {
        const result = await client.query(`INSERT INTO chapters (world_id, title, summary, sequence, publication_status, unlock_rules) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`, [worldId, chapter.title, chapter.summary ?? "", chapter.sequence ?? chapterIds.size + 1, chapter.publication_status ?? "draft", JSON.stringify(chapter.unlock_rules ?? {})]);
        chapterIds.set(chapter.id, result.rows[0].id);
      }
      for (const role of payload.roles) {
        const result = await client.query(`INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [worldId, role.name, role.public_profile ?? "", role.private_profile ?? "", role.sequence ?? roleIds.size + 1]);
        roleIds.set(role.id, result.rows[0].id);
      }
      for (const section of payload.sections ?? []) {
        const roleId = roleIds.get(section.role_slot_id); if (!roleId) continue;
        const script = await client.query(`INSERT INTO character_scripts (role_slot_id, title) SELECT $1, '角色私人剧本' WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1) RETURNING id`, [roleId]);
        const scriptId = script.rows[0]?.id ?? (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleId])).rows[0].id;
        const result = await client.query(`INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [scriptId, roleId, chapterIds.get(section.chapter_id) ?? null, section.title, section.body, section.sequence ?? 1, section.publication_status ?? "draft"]);
        sectionIds.set(section.id, result.rows[0].id);
      }
      for (const scene of payload.scenes ?? []) {
        const result = await client.query(`INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`, [worldId, chapterIds.get(scene.chapter_id) ?? null, scene.name, scene.public_text ?? "", scene.host_text ?? "", JSON.stringify(scene.metadata ?? {})]);
        sceneIds.set(scene.id, result.rows[0].id);
      }
      for (const clue of payload.clues ?? []) {
        const result = await client.query(`INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`, [worldId, clue.name, clue.public_text ?? "", clue.host_text ?? "", clue.visibility ?? "role", JSON.stringify(clue.metadata ?? {})]);
        clueIds.set(clue.id, result.rows[0].id);
      }
      for (const point of payload.investigationPoints ?? []) {
        const sceneId = sceneIds.get(point.scene_id); if (!sceneId) continue;
        const result = await client.query(`INSERT INTO investigation_points (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id`, [worldId, sceneId, point.name, point.description ?? "", point.interaction_text ?? "", point.result_text ?? "", clueIds.get(point.clue_id) ?? null, point.sequence ?? 0, JSON.stringify(point.metadata ?? {})]);
        pointIds.set(point.id, result.rows[0].id);
      }
      for (const edge of payload.edges ?? []) {
        const maps = { scene: sceneIds, clue: clueIds, investigation_point: pointIds };
        const fromId = maps[edge.from_type]?.get(edge.from_id), toId = maps[edge.to_type]?.get(edge.to_id);
        if (fromId && toId) await client.query(`INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [worldId, edge.from_type, fromId, edge.to_type, toId, edge.relation_type ?? "mainline", edge.label ?? ""]);
      }
      const remapRuleValue = (value) => {
        if (Array.isArray(value)) return value.map(remapRuleValue);
        if (!value || typeof value !== "object") return value;
        const next = { ...value };
        if (next.roleSlotId) next.roleSlotId = roleIds.get(next.roleSlotId) ?? next.roleSlotId;
        if (next.scriptSectionId) next.scriptSectionId = sectionIds.get(next.scriptSectionId) ?? next.scriptSectionId;
        if (next.sceneId) next.sceneId = sceneIds.get(next.sceneId) ?? next.sceneId;
        if (next.clueId) next.clueId = clueIds.get(next.clueId) ?? next.clueId;
        if (next.investigationPointId) next.investigationPointId = pointIds.get(next.investigationPointId) ?? next.investigationPointId;
        return Object.fromEntries(Object.entries(next).map(([key, item]) => [key, remapRuleValue(item)]));
      };
      for (const rule of payload.rules ?? []) {
        await client.query(`INSERT INTO automation_rules (world_id, name, mode, priority, enabled, conditions, actions) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`, [worldId, rule.name, rule.mode ?? "automatic", rule.priority ?? 100, rule.enabled !== false, JSON.stringify(remapRuleValue(rule.conditions ?? { all: [] })), JSON.stringify(remapRuleValue(rule.actions ?? []))]);
      }
      return { chapters: chapterIds.size, roles: roleIds.size, sections: payload.sections?.length ?? 0, scenes: sceneIds.size, clues: clueIds.size, points: pointIds.size, rules: payload.rules?.length ?? 0 };
    });
    return reply.code(201).send({ ok: true, imported: counts });
  });

  app.post("/api/worlds/:worldId/scenes", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", chapterId = null, metadata = {} } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const result = await query(
      `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
      [worldId, chapterId, name, publicText, hostText, JSON.stringify(metadata)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post("/api/worlds/:worldId/clues", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", visibility = "role", metadata = {} } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const result = await query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
      [worldId, name, publicText, hostText, visibility, JSON.stringify(metadata)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post("/api/worlds/:worldId/scenes/:sceneId/investigation-points", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    const scene = await query(`SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`, [sceneId, worldId]);
    if (!scene.rowCount) return reply.code(404).send({ error: "Scene not found" });
    const {
      name, description = "", interactionText = "", resultText = "", clueId = null,
      requiredItemId = null, requiredRoleSlotId = null, sequence = 0, metadata = {}
    } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const result = await query(
      `INSERT INTO investigation_points
        (world_id, scene_id, name, description, interaction_text, result_text, clue_id,
         required_item_id, required_role_slot_id, sequence, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING *`,
      [worldId, sceneId, name, description, interactionText, resultText, clueId,
       requiredItemId, requiredRoleSlotId, sequence, JSON.stringify(metadata)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/worlds/:worldId/studio", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const [world, chapters, roles, sections, scenes, clues, points, edges, versions, rooms] = await Promise.all([
      query(`SELECT id, name, summary, status, settings FROM worlds WHERE id = $1`, [worldId]),
      query(`SELECT id, title, summary, sequence, publication_status, unlock_rules FROM chapters WHERE world_id = $1 ORDER BY sequence`, [worldId]),
      query(`SELECT id, name, public_profile, private_profile, sequence FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId]),
      query(
        `SELECT ss.id, ss.role_slot_id, ss.chapter_id, ss.title, ss.body, ss.sequence, ss.publication_status, ss.updated_at
         FROM script_sections ss
         JOIN role_slots rs ON rs.id = ss.role_slot_id
         WHERE rs.world_id = $1
         ORDER BY rs.sequence, ss.sequence`,
        [worldId]
      ),
      query(`SELECT id, chapter_id, name, public_text, host_text, metadata FROM scenes WHERE world_id = $1 ORDER BY created_at`, [worldId]),
      query(`SELECT id, name, public_text, host_text, visibility, metadata FROM clues WHERE world_id = $1 ORDER BY created_at`, [worldId]),
      query(
        `SELECT ip.id, ip.scene_id, ip.name, ip.description, ip.interaction_text, ip.result_text, ip.clue_id, ip.sequence, ip.metadata
         FROM investigation_points ip
         WHERE ip.world_id = $1
         ORDER BY ip.scene_id, ip.sequence, ip.created_at`,
        [worldId]
      ),
      query(
        `SELECT id, from_type, from_id, to_type, to_id, relation_type, label
         FROM story_graph_edges
         WHERE world_id = $1
         ORDER BY created_at`,
        [worldId]
      ),
      query(
        `SELECT id, label, created_at FROM content_versions
         WHERE world_id = $1 ORDER BY created_at DESC LIMIT 12`,
        [worldId]
      ),
      query(`SELECT id, name, status, invite_code FROM rooms WHERE world_id = $1 ORDER BY created_at DESC`, [worldId])
    ]);
    return {
      world: world.rows[0],
      chapters: chapters.rows,
      roles: roles.rows,
      sections: sections.rows,
      scenes: scenes.rows,
      clues: clues.rows,
      investigationPoints: points.rows,
      edges: edges.rows,
      versions: versions.rows,
      rooms: rooms.rows
    };
  });

  app.get("/api/worlds/:worldId/creator-checks", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { checks: creatorChecks(await buildWorldSnapshot(worldId)) };
  });

  app.post("/api/worlds/:worldId/content-versions", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { label = "手动创作快照" } = request.body ?? {};
    const result = await query(
      `INSERT INTO content_versions (world_id, created_by_user_id, label, snapshot)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING id, label, created_at`,
      [worldId, actorId, label, JSON.stringify(await buildWorldSnapshot(worldId))]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post("/api/worlds/:worldId/content-versions/:versionId/restore", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const version = await query(`SELECT snapshot FROM content_versions WHERE id = $1 AND world_id = $2`, [versionId, worldId]);
    if (!version.rowCount) return reply.code(404).send({ error: "Content version not found" });
    const snapshot = version.rows[0].snapshot;
    await transaction(async (client) => {
      for (const chapter of snapshot.chapters ?? []) {
        await client.query(
          `UPDATE chapters SET title = $1, summary = $2, publication_status = $3, unlock_rules = $4::jsonb, updated_at = now()
           WHERE id = $5 AND world_id = $6`,
          [chapter.title, chapter.summary, chapter.publication_status, JSON.stringify(chapter.unlock_rules ?? {}), chapter.id, worldId]
        );
      }
      for (const section of snapshot.sections ?? []) {
        await client.query(
          `UPDATE script_sections ss SET title = $1, body = $2, chapter_id = $3, publication_status = $4, updated_at = now()
           FROM role_slots rs WHERE ss.id = $5 AND rs.id = ss.role_slot_id AND rs.world_id = $6`,
          [section.title, section.body, section.chapter_id, section.publication_status, section.id, worldId]
        );
      }
    });
    return { ok: true };
  });

  app.delete("/api/worlds/:worldId/content-versions/:versionId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM content_versions WHERE id = $1 AND world_id = $2 RETURNING id`, [versionId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Content version not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/story-edges", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { fromType, fromId, toType, toId, relationType = "mainline", label = "" } = request.body ?? {};
    const nodeTypes = ["chapter", "scene", "clue", "investigation_point"];
    if (!nodeTypes.includes(fromType) || !nodeTypes.includes(toType) || !fromId || !toId) {
      return reply.code(400).send({ error: "Valid fromType, fromId, toType and toId are required" });
    }
    if (!["mainline", "parallel", "extension"].includes(relationType)) {
      return reply.code(400).send({ error: "Unsupported relationType" });
    }
    const result = await query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [worldId, fromType, fromId, toType, toId, relationType, label]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post("/api/worlds/:worldId/story-assistant/analyze", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const text = String(request.body?.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "Story draft text is required" });
    const nodes = classifyStoryDraft(text);
    return { nodes, edges: storyDraftEdges(nodes), suggestions: storyDraftSuggestions(nodes) };
  });

  app.get("/api/worlds/:worldId/story-assistant/deepseek/status", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const config = deepseekConfig();
    return { configured: config.configured, model: config.model };
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/propose", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekStoryProposal(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await importDeepseekProposal(worldId, request.body?.proposal);
    return reply.code(201).send(result);
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/propose", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createDeepseekMysteryPackage(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/story-assistant/deepseek/full-mystery/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const mystery = request.body?.mystery;
    if (!mystery?.proposal || !mystery?.package) return reply.code(400).send({ error: "DeepSeek mystery package is required" });
    const result = await importDeepseekMysteryPackage(worldId, mystery);
    return reply.code(201).send(result);
  });

  app.get("/api/worlds/:worldId/story-manuscript", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const [manuscript, snapshot] = await Promise.all([
      query(`SELECT body, last_sync_direction, updated_at FROM story_manuscripts WHERE world_id = $1`, [worldId]),
      buildWorldSnapshot(worldId)
    ]);
    const generatedBody = renderStoryManuscript(snapshot);
    return {
      body: manuscript.rows[0]?.body || generatedBody,
      generatedBody,
      lastSyncDirection: manuscript.rows[0]?.last_sync_direction || "graph_to_manuscript",
      updatedAt: manuscript.rows[0]?.updated_at || null
    };
  });

  app.put("/api/worlds/:worldId/story-manuscript", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return reply.code(400).send({ error: "Story manuscript body is required" });
    const result = await query(
      `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
       VALUES ($1,$2,'manual',$3)
       ON CONFLICT (world_id) DO UPDATE
       SET body = EXCLUDED.body, last_sync_direction = 'manual',
           updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
       RETURNING body, last_sync_direction, updated_at`,
      [worldId, body, actorId]
    );
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-from-graph", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = renderStoryManuscript(await buildWorldSnapshot(worldId));
    const result = await query(
      `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
       VALUES ($1,$2,'graph_to_manuscript',$3)
       ON CONFLICT (world_id) DO UPDATE
       SET body = EXCLUDED.body, last_sync_direction = 'graph_to_manuscript',
           updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()
       RETURNING body, last_sync_direction, updated_at`,
      [worldId, body, actorId]
    );
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/story-manuscript/sync-to-graph", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = String(request.body?.body ?? "").trim();
    if (!body) return reply.code(400).send({ error: "Story manuscript body is required" });
    const synced = await syncManuscriptToGraph(worldId, body);
    await query(
      `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
       VALUES ($1,$2,'manuscript_to_graph',$3)
       ON CONFLICT (world_id) DO UPDATE
       SET body = EXCLUDED.body, last_sync_direction = 'manuscript_to_graph',
           updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
      [worldId, body, actorId]
    );
    return reply.code(201).send(synced);
  });

  app.post("/api/worlds/:worldId/story-assistant/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const text = String(request.body?.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "Story draft text is required" });
    const drafts = classifyStoryDraft(text);
    if (!drafts.length) return reply.code(400).send({ error: "No story blocks detected" });
    const result = await transaction(async (client) => {
      const nodes = [], ids = new Map();
      let currentSceneId = null;
      for (const draft of drafts) {
        if (draft.type === "scene") {
          const created = await client.query(
            `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
             VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
            [worldId, draft.name, draft.text, "剧情助手自动分类，等待创作者复核。", JSON.stringify({ source: "story_assistant" })]
          );
          currentSceneId = created.rows[0].id;
          ids.set(draft.key, { type: "scene", id: currentSceneId });
        } else if (draft.type === "clue") {
          const created = await client.query(
            `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
             VALUES ($1, $2, $3, $4, 'role', $5::jsonb) RETURNING id`,
            [worldId, draft.name, draft.text, "剧情助手自动分类，等待创作者复核。", JSON.stringify({ source: "story_assistant" })]
          );
          ids.set(draft.key, { type: "clue", id: created.rows[0].id });
        } else {
          if (!currentSceneId) {
            const fallback = await client.query(
              `INSERT INTO scenes (world_id, name, public_text, host_text, metadata)
               VALUES ($1, '待整理场景', '剧情助手为未归属调查点建立的临时场景。', $2, $3::jsonb) RETURNING id`,
              [worldId, "请在剧情编排中调整归属。", JSON.stringify({ source: "story_assistant", fallback: true })]
            );
            currentSceneId = fallback.rows[0].id;
          }
          const created = await client.query(
            `INSERT INTO investigation_points (world_id, scene_id, name, description, result_text, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
            [worldId, currentSceneId, draft.name, draft.text, draft.text, JSON.stringify({ source: "story_assistant" })]
          );
          ids.set(draft.key, { type: "investigation_point", id: created.rows[0].id });
        }
        nodes.push({ ...draft, ...ids.get(draft.key) });
      }
      for (let index = 1; index < drafts.length; index += 1) {
        const clue = ids.get(drafts[index].key), point = ids.get(drafts[index - 1].key);
        if (drafts[index].type === "clue" && drafts[index - 1].type === "investigation_point" && clue && point) {
          await client.query(`UPDATE investigation_points SET clue_id = $1 WHERE id = $2 AND world_id = $3`, [clue.id, point.id, worldId]);
        }
      }
      const edges = [];
      for (const edge of storyDraftEdges(drafts)) {
        const from = ids.get(edge.fromKey), to = ids.get(edge.toKey);
        if (!from || !to) continue;
        const created = await client.query(
          `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (world_id, from_type, from_id, to_type, to_id, relation_type) DO NOTHING
           RETURNING id`,
          [worldId, from.type, from.id, to.type, to.id, edge.relationType, edge.label]
        );
        if (created.rowCount) edges.push({ ...edge, id: created.rows[0].id });
      }
      return { nodes, edges, suggestions: storyDraftSuggestions(drafts) };
    });
    return reply.code(201).send(result);
  });

  app.delete("/api/worlds/:worldId/story-edges/:edgeId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, edgeId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM story_graph_edges WHERE id = $1 AND world_id = $2 RETURNING id`, [edgeId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Story edge not found" });
    return { ok: true };
  });

  app.delete("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldRole(actorId, worldId);
    const tables = { chapter: "chapters", scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    const table = tables[nodeType];
    if (!table) return reply.code(400).send({ error: "Unsupported nodeType" });
    const result = await transaction(async (client) => {
      await client.query(
        `DELETE FROM story_graph_edges
         WHERE world_id = $1 AND ((from_type = $2 AND from_id = $3) OR (to_type = $2 AND to_id = $3))`,
        [worldId, nodeType, nodeId]
      );
      return client.query(`DELETE FROM ${table} WHERE id = $1 AND world_id = $2 RETURNING id`, [nodeId, worldId]);
    });
    if (!result.rowCount) return reply.code(404).send({ error: "Studio node not found" });
    return { ok: true };
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/position", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    const { x, y } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    const table = tables[nodeType];
    if (!table) return reply.code(400).send({ error: "Unsupported draggable nodeType" });
    if (!Number.isFinite(x) || !Number.isFinite(y)) return reply.code(400).send({ error: "Finite x and y are required" });
    const result = await query(
      `UPDATE ${table}
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphPosition}', $1::jsonb, true)
       WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
      [JSON.stringify({ x: Math.round(x), y: Math.round(y) }), nodeId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Studio node not found" });
    return result.rows[0];
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/anchors", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    const { anchors = [] } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    const table = tables[nodeType];
    if (!table) return reply.code(400).send({ error: "Unsupported draggable nodeType" });
    if (!Array.isArray(anchors) || anchors.length < 1 || anchors.length > 8) {
      return reply.code(400).send({ error: "anchors must contain between 1 and 8 connection points" });
    }
    const normalized = anchors.map((anchor) => {
      if (!anchor?.id || typeof anchor.id !== "string" || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        throw Object.assign(new Error("Each anchor requires id, x and y"), { statusCode: 400 });
      }
      return { id: anchor.id.slice(0, 80), x: Math.round(Math.max(0, Math.min(156, anchor.x))), y: Math.round(Math.max(0, Math.min(124, anchor.y))) };
    });
    const result = await query(
      `UPDATE ${table}
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphAnchors}', $1::jsonb, true)
       WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
      [JSON.stringify(normalized), nodeId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Studio node not found" });
    return result.rows[0];
  });

  app.put("/api/worlds/:worldId/story-layout", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const { positions = [] } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    if (!Array.isArray(positions) || positions.length > 300) return reply.code(400).send({ error: "positions must be an array of up to 300 nodes" });
    await transaction(async (client) => {
      for (const position of positions) {
        const table = tables[position.type];
        if (!table || !position.id || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          throw Object.assign(new Error("Each position requires a valid type, id, x and y"), { statusCode: 400 });
        }
        await client.query(
          `UPDATE ${table}
           SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphPosition}', $1::jsonb, true)
           WHERE id = $2 AND world_id = $3`,
          [JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) }), position.id, worldId]
        );
      }
    });
    return { ok: true, updated: positions.length };
  });

  app.post("/api/rooms/:roomId/scenes/:sceneId/unlock", async (request) => {
    const actorId = requireActor(request);
    const { roomId, sceneId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!["host", "cohost"].includes(membership.member_type)) {
      throw Object.assign(new Error("Host role required"), { statusCode: 403 });
    }
    const scene = await query(
      `SELECT 1 FROM scenes s JOIN rooms r ON r.world_id = s.world_id
       WHERE s.id = $1 AND r.id = $2`,
      [sceneId, roomId]
    );
    if (!scene.rowCount) throw Object.assign(new Error("Scene not found in room world"), { statusCode: 404 });
    await query(
      `INSERT INTO room_content_unlocks (room_id, content_type, content_id)
       VALUES ($1, 'scene', $2)
       ON CONFLICT (room_id, content_type, content_id) DO NOTHING`,
      [roomId, sceneId]
    );
    return { ok: true };
  });

  app.get("/api/rooms/invite/:inviteCode", async (request, reply) => {
    const actorId = requireActor(request);
    const room = await query(
      `SELECT r.id, r.name, r.status, w.id AS world_id, w.name AS world_name
       FROM rooms r JOIN worlds w ON w.id = r.world_id
       WHERE r.invite_code = $1`,
      [request.params.inviteCode]
    );
    if (!room.rowCount) return reply.code(404).send({ error: "Room not found" });
    const roles = await query(
      `SELECT rs.id, rs.name, rs.public_profile,
              EXISTS (
                SELECT 1 FROM room_members rm
                WHERE rm.room_id = $1 AND rm.role_slot_id = rs.id AND rm.status = 'active'
              ) AS occupied,
              EXISTS (
                SELECT 1 FROM room_members rm
                WHERE rm.room_id = $1 AND rm.role_slot_id = rs.id
                  AND rm.user_id = $3 AND rm.status = 'active'
              ) AS occupied_by_current
       FROM role_slots rs
       WHERE rs.world_id = $2
       ORDER BY rs.sequence`,
      [room.rows[0].id, room.rows[0].world_id, actorId]
    );
    return {
      room: { id: room.rows[0].id, name: room.rows[0].name, status: room.rows[0].status },
      world: { id: room.rows[0].world_id, name: room.rows[0].world_name },
      roles: roles.rows
    };
  });

  app.post("/api/rooms/join", async (request, reply) => {
    const actorId = requireActor(request);
    const { inviteCode, roleSlotId } = request.body ?? {};
    if (!inviteCode || !roleSlotId) return reply.code(400).send({ error: "inviteCode and roleSlotId are required" });
    const room = await query(`SELECT id, world_id FROM rooms WHERE invite_code = $1`, [inviteCode]);
    if (!room.rowCount) return reply.code(404).send({ error: "Room not found" });
    const role = await query(`SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, room.rows[0].world_id]);
    if (!role.rowCount) return reply.code(400).send({ error: "Role slot not found in room world" });
    const occupied = await query(
      `SELECT 1 FROM room_members
       WHERE room_id = $1 AND role_slot_id = $2 AND user_id <> $3 AND status = 'active'`,
      [room.rows[0].id, roleSlotId, actorId]
    );
    if (occupied.rowCount) return reply.code(409).send({ error: "Role slot already occupied" });
    await query(
      `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
       VALUES ($1, $2, 'player', $3)
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
      [room.rows[0].id, actorId, roleSlotId]
    );
    return { ok: true, roomId: room.rows[0].id };
  });

  app.get("/api/rooms/:roomId/player-home", async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) {
      const error = new Error("Player role selection required");
      error.statusCode = 409;
      throw error;
    }

    const [role, sections, notes, clues, rooms, members] = await Promise.all([
      query(`SELECT id, name, public_profile, private_profile FROM role_slots WHERE id = $1`, [membership.role_slot_id]),
      query(
        `SELECT ss.id, ss.title, ss.body, ss.sequence,
                rp.started_at, rp.completed_at,
                (rp.completed_at IS NOT NULL) AS completed
         FROM script_sections ss
         JOIN rooms room ON room.id = $1
         LEFT JOIN reading_progress rp
           ON rp.script_section_id = ss.id AND rp.room_id = $1 AND rp.role_slot_id = $2
         WHERE ss.role_slot_id = $2
           AND (
             ss.publication_status = 'published'
             OR (room.status = 'testing' AND ss.publication_status = 'testing')
           )
           AND (
             ss.sequence = 1 OR EXISTS (
               SELECT 1 FROM room_content_unlocks rcu
               WHERE rcu.room_id = $1 AND rcu.content_type = 'script_section' AND rcu.content_id = ss.id
             )
           )
         ORDER BY ss.sequence`,
        [roomId, membership.role_slot_id]
      ),
      query(
        `SELECT id, source_type, source_id, title, body, created_at
         FROM notebook_entries
         WHERE room_id = $1 AND role_slot_id = $2
         ORDER BY created_at DESC`,
        [roomId, membership.role_slot_id]
      ),
      query(
        `SELECT c.id, c.name, c.public_text, co.acquired_at, co.read_at
         FROM clue_ownership co JOIN clues c ON c.id = co.clue_id
         WHERE co.room_id = $1 AND co.role_slot_id = $2
         ORDER BY co.acquired_at DESC`,
        [roomId, membership.role_slot_id]
      ),
      query(
        `SELECT vr.id, vr.name, vr.room_type, vr.status
         FROM voice_rooms vr
         WHERE vr.room_id = $1 AND (
           vr.room_type = 'public' OR EXISTS (
             SELECT 1 FROM voice_room_members vrm
             WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
           )
         ) ORDER BY vr.created_at`,
        [roomId, actorId]
      ),
      query(
        `SELECT rs.id AS role_slot_id, rs.name AS role_name, rm.user_id, u.display_name,
                rm.member_type, (rm.user_id IS NOT NULL) AS online
         FROM rooms r
         JOIN role_slots rs ON rs.world_id = r.world_id
         LEFT JOIN room_members rm
           ON rm.room_id = r.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
         LEFT JOIN users u ON u.id = rm.user_id
         WHERE r.id = $1
         ORDER BY rs.sequence`,
        [roomId]
      )
    ]);

    return { role: role.rows[0], sections: sections.rows, notes: notes.rows, clues: clues.rows, voiceRooms: rooms.rows, roomMembers: members.rows };
  });

  app.get("/api/voice-rooms/:voiceRoomId/messages", async (request) => {
    const actorId = requireActor(request);
    const { voiceRoomId } = request.params;
    await requireVoiceRoomAccess(actorId, voiceRoomId);
    const result = await query(
      `SELECT vrm.id, vrm.body, vrm.created_at, u.display_name AS sender_name
       FROM voice_room_messages vrm
       JOIN users u ON u.id = vrm.sender_user_id
       WHERE vrm.voice_room_id = $1
       ORDER BY vrm.created_at DESC LIMIT 80`,
      [voiceRoomId]
    );
    return result.rows.reverse();
  });

  app.post("/api/rooms/:roomId/voice-rooms", async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireRoomRole(actorId, roomId);
    const { name, roomType = "invite_private", inviteUserIds = [] } = request.body ?? {};
    if (!name?.trim()) return reply.code(400).send({ error: "Voice room name is required" });
    if (!["public", "role_private", "invite_private"].includes(roomType)) return reply.code(400).send({ error: "Unsupported voice room type" });
    if (!Array.isArray(inviteUserIds) || inviteUserIds.length > 20) return reply.code(400).send({ error: "inviteUserIds must be an array of up to 20 members" });
    const room = await transaction(async (client) => {
      const created = await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, $2, $3, $4) RETURNING id, room_id, name, room_type, status`,
        [roomId, name.trim(), roomType, actorId]
      );
      if (roomType !== "public") {
        const invitees = [...new Set([actorId, ...inviteUserIds])];
        for (const userId of invitees) {
          const member = await client.query(`SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`, [roomId, userId]);
          if (!member.rowCount) throw Object.assign(new Error("Invited user must be an active room member"), { statusCode: 400 });
          await client.query(
            `INSERT INTO voice_room_members (voice_room_id, user_id, invited_by_user_id, joined_at)
             VALUES ($1, $2, $3, now()) ON CONFLICT (voice_room_id, user_id) DO NOTHING`,
            [created.rows[0].id, userId, actorId]
          );
        }
      }
      return created.rows[0];
    });
    return reply.code(201).send(room);
  });

  app.post("/api/voice-rooms/:voiceRoomId/messages", async (request, reply) => {
    const actorId = requireActor(request);
    const { voiceRoomId } = request.params;
    await requireVoiceRoomAccess(actorId, voiceRoomId);
    const body = String(request.body?.body ?? "").trim();
    if (!body || body.length > 1000) return reply.code(400).send({ error: "Message body must contain between 1 and 1000 characters" });
    const result = await query(
      `INSERT INTO voice_room_messages (voice_room_id, sender_user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [voiceRoomId, actorId, body]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post("/api/voice-rooms/:voiceRoomId/members", async (request, reply) => {
    const actorId = requireActor(request);
    const { voiceRoomId } = request.params;
    const access = await requireVoiceRoomAccess(actorId, voiceRoomId);
    const { inviteUserIds = [] } = request.body ?? {};
    if (!Array.isArray(inviteUserIds) || !inviteUserIds.length || inviteUserIds.length > 20) {
      return reply.code(400).send({ error: "inviteUserIds must contain between 1 and 20 members" });
    }
    if (access.room_type === "public") return reply.code(400).send({ error: "Public voice rooms do not require invitations" });
    const invitees = [...new Set(inviteUserIds)];
    await transaction(async (client) => {
      for (const userId of invitees) {
        const member = await client.query(
          `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
          [access.room_id, userId]
        );
        if (!member.rowCount) throw Object.assign(new Error("Invited user must be an active room member"), { statusCode: 400 });
      }
      for (const userId of invitees) {
        await client.query(
          `INSERT INTO voice_room_members (voice_room_id, user_id, invited_by_user_id, joined_at)
           VALUES ($1, $2, $3, now()) ON CONFLICT (voice_room_id, user_id) DO NOTHING`,
          [voiceRoomId, userId, actorId]
        );
      }
    });
    return reply.code(201).send({ ok: true, invited: invitees.length });
  });

  app.post("/api/rooms/:roomId/sections/:sectionId/complete", async (request) => {
    const actorId = requireActor(request);
    const { roomId, sectionId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at, completed_at)
         VALUES ($1, $2, $3, now(), now())
         ON CONFLICT (room_id, role_slot_id, script_section_id)
         DO UPDATE SET completed_at = COALESCE(reading_progress.completed_at, now())`,
        [roomId, membership.role_slot_id, sectionId]
      );
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'reading_completed', '玩家完成一段角色阅读', jsonb_build_object('sectionId', $3::text))`,
        [roomId, actorId, sectionId]
      );
    });
    const executedRules = await evaluateRoomRules(roomId);
    return { ok: true, executedRules };
  });

  app.post("/api/rooms/:roomId/notebook", async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const { sourceType, sourceId, title, body } = request.body ?? {};
    if (!sourceType || !title || !body) return reply.code(400).send({ error: "sourceType, title and body are required" });
    const result = await query(
      `INSERT INTO notebook_entries (room_id, role_slot_id, created_by_user_id, source_type, source_id, title, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [roomId, membership.role_slot_id, actorId, sourceType, sourceId ?? null, title, body]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/rooms/:roomId/exploration", async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const scenes = await query(
      `SELECT s.id, s.name, s.public_text,
              COALESCE(json_agg(
                json_build_object(
                  'id', ip.id, 'name', ip.name, 'description', ip.description,
                  'interactionText', ip.interaction_text, 'resultText', ip.result_text,
                  'investigated', (ir.investigated_at IS NOT NULL),
                  'investigatedAt', ir.investigated_at
                ) ORDER BY ip.sequence, ip.created_at
              ) FILTER (WHERE ip.id IS NOT NULL), '[]'::json) AS investigation_points
       FROM room_content_unlocks rcu
       JOIN scenes s ON s.id = rcu.content_id
       LEFT JOIN investigation_points ip ON ip.scene_id = s.id
         AND (ip.required_role_slot_id IS NULL OR ip.required_role_slot_id = $2)
       LEFT JOIN investigation_records ir ON ir.room_id = $1
         AND ir.investigation_point_id = ip.id AND ir.role_slot_id = $2
       WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
       GROUP BY s.id, s.name, s.public_text, rcu.unlocked_at
       ORDER BY rcu.unlocked_at, s.created_at`,
      [roomId, membership.role_slot_id]
    );
    return { scenes: scenes.rows };
  });

  app.post("/api/rooms/:roomId/investigation-points/:pointId/investigate", async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, pointId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const point = await query(
      `SELECT ip.*
       FROM investigation_points ip
       JOIN room_content_unlocks rcu ON rcu.content_id = ip.scene_id
        AND rcu.room_id = $1 AND rcu.content_type = 'scene'
       WHERE ip.id = $2
         AND (ip.required_role_slot_id IS NULL OR ip.required_role_slot_id = $3)`,
      [roomId, pointId, membership.role_slot_id]
    );
    if (!point.rowCount) return reply.code(404).send({ error: "Investigation point is locked or unavailable" });
    const target = point.rows[0];
    if (target.required_item_id) {
      const inventory = await query(
        `SELECT 1 FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity > 0`,
        [roomId, membership.role_slot_id, target.required_item_id]
      );
      if (!inventory.rowCount) return reply.code(409).send({ error: "Required item is missing" });
    }
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO investigation_records (room_id, investigation_point_id, role_slot_id, result)
         VALUES ($1, $2, $3, jsonb_build_object('resultText', $4::text))
         ON CONFLICT (room_id, investigation_point_id, role_slot_id) DO NOTHING`,
        [roomId, pointId, membership.role_slot_id, target.result_text]
      );
      if (target.clue_id) {
        await client.query(
          `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id, metadata)
           VALUES ($1, $2, $3, jsonb_build_object('source', 'investigation', 'pointId', $4::text))
           ON CONFLICT (room_id, role_slot_id, clue_id) DO NOTHING`,
          [roomId, membership.role_slot_id, target.clue_id, pointId]
        );
      }
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'investigation_completed', $3, jsonb_build_object('pointId', $4::text))`,
        [roomId, actorId, `玩家调查了「${target.name}」`, pointId]
      );
    });
    const executedRules = await evaluateRoomRules(roomId);
    const clue = target.clue_id
      ? (await query(`SELECT id, name, public_text FROM clues WHERE id = $1`, [target.clue_id])).rows[0]
      : null;
    return { ok: true, resultText: target.result_text, clue, executedRules };
  });

  app.post("/api/rooms/:roomId/clues/:clueId/read", async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, clueId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!membership.role_slot_id) throw Object.assign(new Error("Player role required"), { statusCode: 409 });
    const result = await query(
      `UPDATE clue_ownership SET read_at = COALESCE(read_at, now())
       WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
       RETURNING read_at`,
      [roomId, membership.role_slot_id, clueId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Clue not owned" });
    return { ok: true, readAt: result.rows[0].read_at };
  });

  app.get("/api/rooms/:roomId/host-events", async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!["host", "cohost"].includes(membership.member_type)) {
      throw Object.assign(new Error("Host role required"), { statusCode: 403 });
    }
    const result = await query(
      `SELECT id, event_key, title, description, status, created_at
       FROM pending_host_events
       WHERE room_id = $1 AND status IN ('pending', 'delayed')
       ORDER BY created_at`,
      [roomId]
    );
    return result.rows;
  });

  app.post("/api/rooms/:roomId/host-events/:eventId/execute", async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, eventId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!["host", "cohost"].includes(membership.member_type)) {
      throw Object.assign(new Error("Host role required"), { statusCode: 403 });
    }
    const event = await query(
      `SELECT * FROM pending_host_events WHERE id = $1 AND room_id = $2 AND status IN ('pending', 'delayed')`,
      [eventId, roomId]
    );
    if (!event.rowCount) return reply.code(404).send({ error: "Pending host event not found" });
    await executeActions(roomId, event.rows[0].actions);
    await transaction(async (client) => {
      await client.query(
        `UPDATE pending_host_events
         SET status = 'executed', resolved_at = now(), resolved_by_user_id = $1
         WHERE id = $2`,
        [actorId, eventId]
      );
      if (event.rows[0].rule_id) {
        await client.query(
          `INSERT INTO rule_executions (rule_id, room_id, result)
           VALUES ($1, $2, '{"status":"host_confirmed"}'::jsonb)
           ON CONFLICT (rule_id, room_id) DO NOTHING`,
          [event.rows[0].rule_id, roomId]
        );
      }
    });
    return { ok: true };
  });

  app.get("/api/rooms/:roomId/host-progress", async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomRole(actorId, roomId);
    if (!["host", "cohost"].includes(membership.member_type)) {
      throw Object.assign(new Error("Host role required"), { statusCode: 403 });
    }
    const result = await query(
      `SELECT rs.id AS role_slot_id, rs.name,
              COUNT(ss.id)::int AS total_sections,
              COUNT(rp.completed_at)::int AS completed_sections,
              ps.current_scene_id, ps.updated_at
       FROM role_slots rs
       JOIN rooms r ON r.world_id = rs.world_id
       LEFT JOIN script_sections ss ON ss.role_slot_id = rs.id
       LEFT JOIN reading_progress rp
         ON rp.script_section_id = ss.id AND rp.room_id = r.id AND rp.role_slot_id = rs.id
       LEFT JOIN player_states ps ON ps.room_id = r.id AND ps.role_slot_id = rs.id
       WHERE r.id = $1
       GROUP BY rs.id, ps.current_scene_id, ps.updated_at
       ORDER BY rs.created_at`,
      [roomId]
    );
    return result.rows;
  });

  app.get("/api/storage/usage", async (request) => {
    const actorId = requireActor(request);
    const usage = await storageUsage(actorId);
    return {
      maxBytes: Number(usage.max_bytes),
      maxWorlds: Number(usage.max_worlds),
      maxSingleFileBytes: Number(usage.max_single_file_bytes),
      usedBytes: Number(usage.used_bytes),
      remainingBytes: Number(usage.max_bytes) - Number(usage.used_bytes)
    };
  });

  app.get("/api/worlds/:worldId/assets", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `SELECT id, asset_kind, original_filename, content_type, byte_size, visibility, status, created_at
       FROM asset_files
       WHERE world_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [worldId]
    );
    return result.rows;
  });

  app.post("/api/assets/upload-url", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roomId = null, filename, contentType, byteSize, visibility = "author", roleSlotId = null } = request.body ?? {};
    if (!worldId || !filename || !contentType || !byteSize) {
      return reply.code(400).send({ error: "worldId, filename, contentType and byteSize are required" });
    }
    await requireWorldRole(actorId, worldId);
    const policy = validateUpload({ contentType, byteSize });
    const usage = await storageUsage(actorId);
    if (Number(byteSize) > Number(usage.max_single_file_bytes)) {
      return reply.code(413).send({ error: "File exceeds account single-file limit" });
    }
    if (Number(usage.used_bytes) + Number(byteSize) > Number(usage.max_bytes)) {
      return reply.code(413).send({ error: "Storage quota exceeded" });
    }
    if (!["author", "host", "role", "public"].includes(visibility)) {
      return reply.code(400).send({ error: "Unsupported visibility" });
    }
    if (visibility === "role" && !roleSlotId) {
      return reply.code(400).send({ error: "roleSlotId is required for role visibility" });
    }
    if (roomId) {
      const room = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
      if (!room.rowCount) return reply.code(400).send({ error: "roomId does not belong to worldId" });
    }
    if (roleSlotId) {
      const role = await query(`SELECT 1 FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, worldId]);
      if (!role.rowCount) return reply.code(400).send({ error: "roleSlotId does not belong to worldId" });
    }

    const objectKey = `users/${actorId}/worlds/${worldId}/assets/${randomUUID()}`;
    const ttl = Number(process.env.SIGNED_UPLOAD_TTL_SECONDS ?? 600);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const asset = await transaction(async (client) => {
      const file = await client.query(
        `INSERT INTO asset_files
          (owner_user_id, world_id, room_id, asset_kind, visibility, role_slot_id, object_key, original_filename, content_type, byte_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [actorId, worldId, roomId, policy.kind, visibility, roleSlotId, objectKey, filename, contentType, byteSize]
      );
      const session = await client.query(
        `INSERT INTO upload_sessions
          (asset_file_id, owner_user_id, object_key, expected_content_type, expected_byte_size, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [file.rows[0].id, actorId, objectKey, contentType, byteSize, expiresAt]
      );
      return { asset: file.rows[0], uploadSessionId: session.rows[0].id };
    });
    const uploadUrl = await getObjectStorage().createUploadUrl({ key: objectKey, contentType, expiresIn: ttl });
    return reply.code(201).send({
      assetId: asset.asset.id,
      uploadSessionId: asset.uploadSessionId,
      uploadUrl,
      expiresAt,
      requiredHeaders: { "Content-Type": contentType }
    });
  });

  app.post("/api/assets/:assetId/confirm", async (request) => {
    const actorId = requireActor(request);
    const { assetId } = request.params;
    const session = await query(
      `SELECT us.*, a.object_key FROM upload_sessions us
       JOIN asset_files a ON a.id = us.asset_file_id
       WHERE us.asset_file_id = $1 AND us.owner_user_id = $2 AND us.status = 'created' AND us.expires_at > now()`,
      [assetId, actorId]
    );
    if (!session.rowCount) throw Object.assign(new Error("Active upload session not found"), { statusCode: 404 });
    const stat = await getObjectStorage().statObject({ key: session.rows[0].object_key });
    if (stat.byteSize !== Number(session.rows[0].expected_byte_size)) {
      throw Object.assign(new Error("Uploaded file size does not match upload request"), { statusCode: 409 });
    }
    if (stat.contentType !== session.rows[0].expected_content_type) {
      throw Object.assign(new Error("Uploaded content type does not match upload request"), { statusCode: 409 });
    }
    await transaction(async (client) => {
      await client.query(`UPDATE asset_files SET status = 'active', updated_at = now() WHERE id = $1`, [assetId]);
      await client.query(`UPDATE upload_sessions SET status = 'confirmed', confirmed_at = now() WHERE id = $1`, [session.rows[0].id]);
      await client.query(
        `INSERT INTO asset_versions (asset_file_id, version_number, object_key, byte_size)
         VALUES ($1, 1, $2, $3)`,
        [assetId, session.rows[0].object_key, stat.byteSize]
      );
    });
    return { ok: true, assetId };
  });

  app.get("/api/assets/:assetId/download-url", async (request) => {
    const actorId = requireActor(request);
    const asset = await requireAssetRead(actorId, request.params.assetId);
    const ttl = Number(process.env.SIGNED_DOWNLOAD_TTL_SECONDS ?? 300);
    const downloadUrl = await getObjectStorage().createDownloadUrl({ key: asset.object_key, expiresIn: ttl });
    return { downloadUrl, expiresIn: ttl };
  });

  app.delete("/api/assets/:assetId", async (request) => {
    const actorId = requireActor(request);
    const asset = await query(`SELECT id FROM asset_files WHERE id = $1 AND owner_user_id = $2 AND status <> 'deleted'`, [request.params.assetId, actorId]);
    if (!asset.rowCount) throw Object.assign(new Error("Asset not found"), { statusCode: 404 });
    const recycleDays = Number(process.env.RECYCLE_BIN_DAYS ?? 14);
    await transaction(async (client) => {
      await client.query(`UPDATE asset_files SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = $1`, [request.params.assetId]);
      await client.query(
        `INSERT INTO deleted_assets (asset_file_id, deleted_by_user_id, purge_after)
         VALUES ($1, $2, now() + ($3 || ' days')::interval)
         ON CONFLICT (asset_file_id) DO UPDATE SET purge_after = EXCLUDED.purge_after`,
        [request.params.assetId, actorId, recycleDays]
      );
    });
    return { ok: true, purgeAfterDays: recycleDays };
  });
}
