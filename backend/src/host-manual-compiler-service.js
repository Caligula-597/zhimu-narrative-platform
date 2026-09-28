// Host Manual Compiler — service layer (缺口6).
// Deterministically aggregates every preceding locked内容 module into a
// 主持手册整册, persisted as versioned rows plus editable sections.

import { createHash } from "node:crypto";
import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { buildWorldArchiveSnapshot } from "./world-snapshot-service.js";

const VERSIONS = "world_host_manual_versions";
const SECTIONS = "world_host_manual_sections";

const VERSION_COLS = [
  "id", "world_id", "version", "title", "source_fingerprint",
  "compiled_by", "created_at", "updated_at"
].join(", ");

const SECTION_COLS = [
  "id", "manual_id", "world_id", "section_key", "title", "body",
  "locked", "sort_order", "created_at", "updated_at"
].join(", ");

function clampText(value, max) {
  return String(value ?? "").slice(0, max);
}

function rowToVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    version: row.version,
    title: row.title,
    sourceFingerprint: row.source_fingerprint || "",
    compiledBy: row.compiled_by,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

function rowToSection(row) {
  if (!row) return null;
  return {
    id: row.id,
    manualId: row.manual_id,
    worldId: row.world_id,
    sectionKey: row.section_key,
    title: row.title,
    body: row.body,
    locked: row.locked,
    sortOrder: row.sort_order,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

async function loadSectionsByManualId(manualId) {
  const result = await query(
    `SELECT ${SECTION_COLS} FROM ${SECTIONS}
     WHERE manual_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [manualId]
  );
  return (result.rows || []).map(rowToSection);
}

async function attachSections(version) {
  if (!version) return null;
  version.sections = await loadSectionsByManualId(version.id);
  return version;
}

export async function getLatestManual(worldId) {
  const result = await query(
    `SELECT ${VERSION_COLS} FROM ${VERSIONS}
     WHERE world_id = $1 ORDER BY version DESC LIMIT 1`,
    [worldId]
  );
  return attachSections(rowToVersion(result.rows[0]));
}

export async function getManual(worldId, version = null) {
  if (!version) return getLatestManual(worldId);
  const result = await query(
    `SELECT ${VERSION_COLS} FROM ${VERSIONS}
     WHERE world_id = $1 AND version = $2 LIMIT 1`,
    [worldId, version]
  );
  return attachSections(rowToVersion(result.rows[0]));
}

export async function listManualVersions(worldId) {
  const result = await query(
    `SELECT ${VERSION_COLS} FROM ${VERSIONS}
     WHERE world_id = $1 ORDER BY version DESC`,
    [worldId]
  );
  return (result.rows || []).map(rowToVersion);
}

/* ─────────────────────────────────────────────────────────────
 * Deterministic aggregation of all source content.
 * ───────────────────────────────────────────────────────────── */

function indexBy(list, keyFn) {
  const map = new Map();
  for (const item of list || []) map.set(keyFn(item), item);
  return map;
}

function nameForReference(map, id, fallback = "") {
  if (!id || !map) return fallback;
  return map.get(id)?.name || fallback;
}

function md(value = "") {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim();
}

function jsonInline(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? "");
  }
}

async function loadCompileSource(worldId) {
  const snapshot = await buildWorldArchiveSnapshot(worldId);
  const [timeline, misids, arcs, endings] = await Promise.all([
    query(
      `SELECT id, act_id, timestamp, sort_order, parallel_line, actor_id,
              action, impact, cognitions
       FROM world_timeline_entries WHERE world_id = $1
       ORDER BY act_id, parallel_line, sort_order, created_at`,
      [worldId]
    ),
    query(
      `SELECT id, act_id, timestamp, sort_order, holder_id, holder_label,
              title, content, truth, refuted_by_clue_id, refuted_by_item_id,
              refuted_at, duration, is_active
       FROM world_misidentifications WHERE world_id = $1
       ORDER BY act_id, sort_order, created_at`,
      [worldId]
    ),
    query(
      `SELECT id, title, char_a_id, char_a_label, char_b_id, char_b_label,
              summary, stages
       FROM world_relationship_arcs WHERE world_id = $1
       ORDER BY created_at`,
      [worldId]
    ),
    query(
      `SELECT id, title, trigger, result, reveal_text, reveal_clue_ids,
              reveal_item_ids, is_good, sort_order
       FROM world_endings WHERE world_id = $1
       ORDER BY sort_order, created_at`,
      [worldId]
    )
  ]);

  return {
    world: snapshot.world || {},
    chapters: snapshot.chapters || [],
    roles: snapshot.roles || [],
    sections: snapshot.sections || [],
    scenes: snapshot.scenes || [],
    clues: snapshot.clues || [],
    items: snapshot.items || [],
    rules: snapshot.rules || [],
    segments: snapshot.segments || [],
    timeline: timeline.rows || [],
    misidentifications: misids.rows || [],
    relationshipArcs: arcs.rows || [],
    endings: endings.rows || []
  };
}

/* Section renderers — all deterministic, no hard-coded content. */

function renderOverview(src) {
  const w = src.world;
  const out = [`## ${md(w.name) || "（未命名作品）"}`, ""];
  const summary = md(w.summary);
  if (summary) out.push(summary, "");
  out.push("### 已锁定内容规模", "", `- 幕次：${src.chapters.length}`);
  out.push(`- 角色：${src.roles.length}`);
  out.push(`- 分幕文本：${src.sections.length}`);
  out.push(`- 场景：${src.scenes.length}`);
  out.push(`- 线索：${src.clues.length}`);
  out.push(`- 物件：${src.items.length}`);
  out.push(`- 规则：${src.rules.length}`);
  out.push(`- 主持阶段：${src.segments.length}`);
  out.push(`- 时间线动作：${src.timeline.length}`);
  out.push(`- 误认登记：${src.misidentifications.length}`);
  out.push(`- 关系过程：${src.relationshipArcs.length}`);
  out.push(`- 结局分支：${src.endings.length}`, "");
  const settings = w.settings;
  if (settings && typeof settings === "object" && Object.keys(settings).length) {
    out.push("### 项目配置", "");
    for (const [key, value] of Object.entries(settings)) {
      out.push(`- **${key}**：${typeof value === "object" && value !== null ? jsonInline(value) : value}`);
    }
    out.push("");
  }
  if (w.status) out.push(`- 状态：${w.status}`);
  if (w.content_revision) out.push(`- 内容修订：${w.content_revision}`, "");
  return out.join("\n");
}

function renderActs(src) {
  if (!src.chapters.length) return "（暂无幕次定义）";
  const out = [];
  for (const ch of src.chapters) {
    const head = `### ${ch.sequence}. ${md(ch.title)}`;
    out.push(head);
    const summary = md(ch.summary);
    if (summary) out.push(summary);
    out.push("");
  }
  return out.join("\n");
}

function renderCharacters(src) {
  if (!src.roles.length) return "（暂无角色）";
  const out = [];
  for (const role of src.roles) {
    out.push(`### ${md(role.name)}`);
    const publicProfile = md(role.public_profile);
    if (publicProfile) out.push(`- 公开身份：${publicProfile}`);
    const privateProfile = md(role.private_profile);
    if (privateProfile) out.push(`- 私人真相：${privateProfile}`);
    if (role.faction_key) out.push(`- 阵营：${role.faction_key}`);
    const sectionCount = src.sections.filter((s) => s.role_slot_id === role.id).length;
    out.push(`- 私人剧本分幕：${sectionCount}`, "");
  }
  return out.join("\n");
}

function renderCharacterScripts(src) {
  if (!src.sections.length) return "（暂无角色私人剧本）";
  const chapters = indexBy(src.chapters, (c) => c.id);
  const roles = indexBy(src.roles, (r) => r.id);
  const out = ["本段按角色×幕次汇总全体私人剧本文本。", ""];
  const byRole = new Map();
  for (const section of src.sections) {
    const roleId = section.role_slot_id;
    const role = roles.get(roleId);
    const roleKey = role?.name || roleId;
    if (!byRole.has(roleKey)) byRole.set(roleKey, []);
    byRole.get(roleKey).push(section);
  }
  for (const [roleName, sections] of byRole.entries()) {
    out.push(`## ${md(roleName)}`, "");
    const sorted = [...sections].sort(
      (a, b) => (chapters.get(a.chapter_id)?.sequence || 0) - (chapters.get(b.chapter_id)?.sequence || 0) || a.sequence - b.sequence
    );
    for (const section of sorted) {
      const chapter = chapters.get(section.chapter_id);
      const actLabel = chapter ? `第${chapter.sequence}幕 · ${md(chapter.title)}` : "未归幕";
      out.push(`### ${actLabel} — ${md(section.title)}`, "");
      const body = md(section.body);
      if (body) out.push(body, "");
    }
  }
  return out.join("\n");
}

function renderTimeline(src) {
  if (!src.timeline.length) return "（暂无行动时间线）";
  const chapters = indexBy(src.chapters, (c) => c.id);
  const roles = indexBy(src.roles, (r) => r.id);
  const out = [];
  const byAct = new Map();
  for (const entry of src.timeline) {
    const actKey = entry.act_id;
    if (!byAct.has(actKey)) byAct.set(actKey, []);
    byAct.get(actKey).push(entry);
  }
  for (const [actId, entries] of byAct.entries()) {
    const chapter = chapters.get(actId);
    out.push(chapter ? `## 第${chapter.sequence}幕 · ${md(chapter.title)}` : "## 未归幕", "");
    const byLine = new Map();
    for (const entry of entries) {
      if (!byLine.has(entry.parallel_line)) byLine.set(entry.parallel_line, []);
      byLine.get(entry.parallel_line).push(entry);
    }
    for (const [line, lineEntries] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
      if (lineEntries.length > 1 || line > 0) out.push(`#### 并行线 ${line + 1}`, "");
      for (const entry of lineEntries) {
        const actorName = roles.get(entry.actor_id)?.name || "环境事件";
        const stamp = md(entry.timestamp) || "（未定时间）";
        const action = md(entry.action);
        out.push(`- **[${stamp}] ${md(actorName)}** — ${action || "（无动作）"}`);
        const impact = md(entry.impact);
        if (impact) out.push(`  - 影响：${impact}`);
        for (const cog of entry.cognitions || []) {
          const cname = roles.get(cog.characterId)?.name || "角色";
          const marker = cog.isMisleading ? "（误导）" : "";
          if (md(cog.content)) out.push(`  - ${md(cname)}认知${marker}：${md(cog.content)}`);
        }
      }
      out.push("");
    }
  }
  return out.join("\n");
}

function renderScenes(src) {
  if (!src.scenes.length) return "（暂无场景）";
  const out = [];
  for (const scene of src.scenes) {
    out.push(`### ${md(scene.name)}`);
    const hostText = md(scene.host_text);
    if (hostText) out.push(`- 主持向：${hostText}`);
    const publicText = md(scene.public_text);
    if (publicText) out.push(`- 玩家向：${publicText}`);
    out.push("");
  }
  return out.join("\n");
}

function renderClues(src) {
  if (!src.clues.length) return "（暂无线索）";
  const out = [];
  for (const clue of src.clues) {
    out.push(`### ${md(clue.name)}`);
    const hostText = md(clue.host_text);
    if (hostText) out.push(hostText);
    const publicText = md(clue.public_text);
    if (publicText) out.push(`- 玩家可见：${publicText}`);
    out.push("");
  }
  return out.join("\n");
}

function renderItems(src) {
  if (!src.items.length) return "（暂无物件）";
  const out = [];
  for (const item of src.items) {
    out.push(`### ${md(item.name)}`);
    const hostText = md(item.host_text);
    if (hostText) out.push(hostText);
    const publicText = md(item.public_text);
    if (publicText) out.push(`- 玩家可见：${publicText}`);
    out.push("");
  }
  return out.join("\n");
}

function renderRules(src) {
  const enabled = src.rules.filter((r) => r.enabled);
  if (!enabled.length) return "（暂无启用的世界规则）";
  const out = [];
  for (const rule of enabled) {
    out.push(`### ${md(rule.name)}`);
    out.push(`- 模式：${rule.mode}${rule.priority != null ? ` · 优先级 ${rule.priority}` : ""}`);
    out.push("```json");
    out.push(jsonInline({ conditions: rule.conditions, actions: rule.actions }));
    out.push("```", "");
  }
  return out.join("\n");
}

function renderRunbook(src) {
  const runnable = src.segments.filter((seg) => {
    const op = seg.operations || {};
    return op.flow || op.hostTruth || (op.clueGrants || []).length || (op.fallbacks || []).length;
  });
  if (!runnable.length) return "（暂无主持阶段脚本 — 请在主持阶段/世界段中补充）";
  const clueIndex = indexBy(src.clues, (c) => c.id);
  const itemIndex = indexBy(src.items, (i) => i.id);
  const out = [];
  for (const seg of runnable) {
    const op = seg.operations || {};
    out.push(`### ${md(op.title || seg.title || seg.segment_key)}`);
    if (md(op.flow)) out.push(`- 流程：${md(op.flow)}`);
    if (md(op.hostTruth)) out.push(`- 主持真相：${md(op.hostTruth)}`);
    for (const grant of op.clueGrants || []) {
      const clueName = clueIndex.get(grant.clueId)?.name || grant.clueId;
      const when = md(grant.when);
      const roleKey = md(grant.roleKey);
      out.push(`- 发放线索：**${clueName}**${when ? `（${when}）` : ""}${roleKey ? ` → ${roleKey}` : ""}`);
    }
    for (const fb of op.fallbacks || []) {
      if (md(fb)) out.push(`- 兜底：${md(fb)}`);
    }
    for (const tip of op.playerTips || []) {
      if (md(tip)) out.push(`- 玩家提示：${md(tip)}`);
    }
    out.push("");
  }
  return out.join("\n");
}

function renderMisidentifications(src) {
  if (!src.misidentifications.length) return "（暂无误认登记）";
  const chapters = indexBy(src.chapters, (c) => c.id);
  const clueIndex = indexBy(src.clues, (c) => c.id);
  const itemIndex = indexBy(src.items, (i) => i.id);
  const out = [];
  const byAct = new Map();
  for (const m of src.misidentifications) {
    if (!byAct.has(m.act_id)) byAct.set(m.act_id, []);
    byAct.get(m.act_id).push(m);
  }
  for (const [actId, list] of byAct.entries()) {
    const chapter = chapters.get(actId);
    out.push(chapter ? `## 第${chapter.sequence}幕 · ${md(chapter.title)}` : "## 未归幕", "");
    for (const m of list) {
      const holder = md(m.holder_label) || (m.holder_id ? "角色" : "（未知）");
      const state = m.is_active ? "仍成立" : "已被推翻";
      out.push(`### ${md(m.title) || "误认"} — ${holder}（${state}）`);
      if (md(m.timestamp)) out.push(`- 形成于：${md(m.timestamp)}`);
      if (md(m.content)) out.push(`- 误认为：${md(m.content)}`);
      if (md(m.truth)) out.push(`- 真相：${md(m.truth)}`);
      const refuter = m.refuted_by_clue_id
        ? clueIndex.get(m.refuted_by_clue_id)?.name || "线索"
        : m.refuted_by_item_id
          ? itemIndex.get(m.refuted_by_item_id)?.name || "物证"
          : "";
      if (refuter) out.push(`- 推翻证据：${refuter}`);
      if (md(m.refuted_at)) out.push(`- 推翻于：${md(m.refuted_at)}`);
      if (md(m.duration)) out.push(`- 持续：${md(m.duration)}`);
      out.push("");
    }
  }
  return out.join("\n");
}

function renderRelationships(src) {
  if (!src.relationshipArcs.length) return "（暂无关系过程）";
  const roles = indexBy(src.roles, (r) => r.id);
  const out = [];
  for (const arc of src.relationshipArcs) {
    const a = md(arc.char_a_label) || (arc.char_a_id ? roles.get(arc.char_a_id)?.name : "甲");
    const b = md(arc.char_b_label) || (arc.char_b_id ? roles.get(arc.char_b_id)?.name : "乙");
    out.push(`### ${md(arc.title) || "关系弧"} — ${a} ↔ ${b}`);
    if (md(arc.summary)) out.push(`- 概览：${md(arc.summary)}`);
    const stages = Array.isArray(arc.stages) ? arc.stages : [];
    for (let i = 0; i < stages.length; i += 1) {
      const stage = stages[i] || {};
      out.push(`  - 第${i + 1}阶段「${md(stage.label)}」`);
      if (md(stage.description)) out.push(`    - 描述：${md(stage.description)}`);
      if (md(stage.trigger)) out.push(`    - 触发：${md(stage.trigger)}`);
      if (md(stage.change)) out.push(`    - 关系变化：${md(stage.change)}`);
    }
    out.push("");
  }
  return out.join("\n");
}

function renderEndings(src) {
  if (!src.endings.length) return "（暂无结局分支）";
  const clueIndex = indexBy(src.clues, (c) => c.id);
  const itemIndex = indexBy(src.items, (i) => i.id);
  const out = [];
  for (const ending of src.endings) {
    const kind = ending.is_good ? "好结局" : "坏结局";
    out.push(`### ${md(ending.title) || "结局"} — ${kind}`);
    if (md(ending.trigger)) out.push(`- 触发：${md(ending.trigger)}`);
    if (md(ending.result)) out.push(`- 结果：${md(ending.result)}`);
    if (md(ending.reveal_text)) out.push(`- 揭示：${md(ending.reveal_text)}`);
    const reveals = [
      ...(ending.reveal_clue_ids || []).map((id) => clueIndex.get(id)?.name || "线索"),
      ...(ending.reveal_item_ids || []).map((id) => itemIndex.get(id)?.name || "物证")
    ];
    if (reveals.length) out.push(`- 达成揭示：${reveals.join("、")}`);
    out.push("");
  }
  return out.join("\n");
}

function renderSections(src) {
  return [
    { key: "overview", title: "作品概览", body: renderOverview(src) },
    { key: "acts", title: "剧情幕次", body: renderActs(src) },
    { key: "characters", title: "角色总览", body: renderCharacters(src) },
    { key: "character_scripts", title: "角色私人剧本", body: renderCharacterScripts(src) },
    { key: "timeline", title: "行动时间线", body: renderTimeline(src) },
    { key: "scenes", title: "场景总览", body: renderScenes(src) },
    { key: "clues", title: "线索清单", body: renderClues(src) },
    { key: "items", title: "物件总览", body: renderItems(src) },
    { key: "rules", title: "世界规则", body: renderRules(src) },
    { key: "runbook", title: "主持阶段脚本", body: renderRunbook(src) },
    { key: "misidentifications", title: "误认登记", body: renderMisidentifications(src) },
    { key: "relationships", title: "关系过程", body: renderRelationships(src) },
    { key: "endings", title: "结局分支", body: renderEndings(src) }
  ];
}

function toCanonicalJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(toCanonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${toCanonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/* ─────────────────────────────────────────────────────────────
 * Compiled manual construction.
 * ───────────────────────────────────────────────────────────── */

export async function compileManual(worldId) {
  const source = await loadCompileSource(worldId);
  if (!source.world?.id) throwErr("WORLD_NOT_FOUND");
  const sections = renderSections(source);
  const fingerprint = createHash("sha1")
    .update(toCanonicalJson(source))
    .digest("hex")
    .slice(0, 16);

  const versionRow = await transaction(async (client) => {
    const maxResult = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS max_version FROM ${VERSIONS} WHERE world_id = $1`,
      [worldId]
    );
    const version = Number(maxResult.rows[0]?.max_version || 0) + 1;
    const title = `${md(source.world.name) || "未命名作品"} · 主持手册`;
    const inserted = await client.query(
      `INSERT INTO ${VERSIONS}
         (world_id, version, title, source_fingerprint, compiled_by)
       VALUES ($1, $2, $3, $4, 'system')
       RETURNING ${VERSION_COLS}`,
      [worldId, version, title, fingerprint]
    );
    const row = inserted.rows[0];
    const manualId = row.id;
    for (let i = 0; i < sections.length; i += 1) {
      await client.query(
        `INSERT INTO ${SECTIONS}
           (manual_id, world_id, section_key, title, body, locked, sort_order)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
        [manualId, worldId, sections[i].key, sections[i].title, sections[i].body, i]
      );
    }
    return rowToVersion(row);
  });

  return attachSections(versionRow);
}

export async function updateSection(worldId, sectionId, body) {
  const current = await query(
    `SELECT ${SECTION_COLS} FROM ${SECTIONS}
     WHERE id = $1 AND world_id = $2`,
    [sectionId, worldId]
  );
  const existing = rowToSection(current.rows[0]);
  if (!existing) throwErr("MANUAL_SECTION_NOT_FOUND");

  const title = body.title !== undefined ? clampText(body.title, 300) : existing.title;
  const text = body.body !== undefined ? String(body.body ?? "") : existing.body;

  const result = await query(
    `UPDATE ${SECTIONS}
     SET title = $1, body = $2, locked = FALSE, updated_at = now()
     WHERE id = $3 AND world_id = $4
     RETURNING ${SECTION_COLS}`,
    [title, text, sectionId, worldId]
  );
  return rowToSection(result.rows[0]);
}

export async function addSection(worldId, body) {
  const latest = await getLatestManual(worldId);
  if (!latest) throwErr("MANUAL_NOT_FOUND", "请先编译生成主持手册，再添加章节");

  const title = clampText(body.title || "自定义章节", 300);
  const keyBase = clampText(body.sectionKey || "", 120);
  const maxResult = await query(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM ${SECTIONS} WHERE manual_id = $1`,
    [latest.id]
  );
  const sortOrder = Number(maxResult.rows[0]?.max_order ?? -1) + 1;

  let sectionKey = keyBase || `custom_${Date.now().toString(36)}`;
  const conflict = await query(
    `SELECT 1 FROM ${SECTIONS} WHERE manual_id = $1 AND section_key = $2 LIMIT 1`,
    [latest.id, sectionKey]
  );
  if (conflict.rows.length) sectionKey = `${sectionKey}_${Date.now().toString(36)}`;

  const result = await query(
    `INSERT INTO ${SECTIONS}
       (manual_id, world_id, section_key, title, body, locked, sort_order)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6)
     RETURNING ${SECTION_COLS}`,
    [latest.id, worldId, sectionKey, title, String(body.body ?? ""), sortOrder]
  );
  return rowToSection(result.rows[0]);
}

export async function deleteSection(worldId, sectionId) {
  const result = await query(
    `DELETE FROM ${SECTIONS} WHERE id = $1 AND world_id = $2 RETURNING id`,
    [sectionId, worldId]
  );
  if (!result.rows.length) throwErr("MANUAL_SECTION_NOT_FOUND");
  return { deleted: true };
}