/**
 * Truth & Bible professional view — deep editing for core trick, claims, timeline, foreshadow, relations.
 */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore, worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { normalizeError } from "../components/status-ui.js";
import { renderRelationshipGraph } from "./creator-cockpit-graph.js";
import { ARC_STAGES, defaultRoleArc } from "../../shared/creator-bible-contract.js";

const showError = (error, fallback = "操作失败") => showToast(normalizeError(error, fallback));

const TABS = [
  { id: "claims", label: "核心事实" },
  { id: "core-trick", label: "核心谜底" },
  { id: "timeline", label: "案件时间线" },
  { id: "foreshadow", label: "伏笔" },
  { id: "relations", label: "角色关系" }
];

const CONFIDENCE_LABELS = {
  canon: "已确认",
  inferred: "推定",
  misdirection: "误导信息",
  unknown: "待确认"
};

function roleOptions(roles, selected = "") {
  return roles.map((r) => `<option value="${escapeHtml(r.id)}" ${r.id === selected ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
}

function renderTabs(active) {
  return TABS.map((t) => `
    <button type="button" class="truth-bible-tab ${t.id === active ? "active" : ""}" data-truth-tab="${t.id}">${escapeHtml(t.label)}</button>`).join("");
}

function renderClaimsPanel(claims) {
  const rows = claims?.length
    ? claims.map((c) => `<article class="truth-claim-row" data-claim-id="${escapeHtml(c.id)}">
        <div class="row"><strong>${escapeHtml(c.title)}</strong><span class="status-chip">${escapeHtml(CONFIDENCE_LABELS[c.confidence] || "已确认")}</span></div>
        <p>${escapeHtml(c.claim || "")}</p>
        <button type="button" class="text-btn danger-text" data-action="delete-truth-claim" data-claim-id="${escapeHtml(c.id)}">删除</button></article>`).join("")
    : `<div class="empty-state">尚未记录核心事实。先写下一个无论玩家如何选择都不会改变的事实。</div>`;
  return `<article class="card truth-claims-panel">
    <div class="section-head"><div><h3>核心事实</h3><p>作者内部的事实台账，用来统一谜底、证据和角色口径。</p></div></div>
    <div class="assistant-guide"><b>当前会影响什么？</b><span>核心事实会参与创作完整性统计，也可以在“运行段落”中作为关联资源；目前不会自动改写章节、主持手册或局后复盘。</span></div>
    <div class="truth-claim-list">${rows}</div>
    <div class="form-group truth-add-form">
      <label>新增核心事实</label>
      <input class="field" data-truth-field="title" placeholder="事实标题，例如：死者真正的死亡时间">
      <textarea class="field" data-truth-field="claim" rows="3" placeholder="写清楚事实本身，以及它为什么成立"></textarea>
      <select class="field" data-truth-field="confidence"><option value="canon">已确认</option><option value="inferred">推定</option><option value="misdirection">误导信息</option><option value="unknown">待确认</option></select>
      <button type="button" class="primary-btn" data-action="add-truth-claim-inline">添加核心事实</button>
    </div></article>`;
}

function renderCoreTrickPanel(coreTrick, roles) {
  const ct = coreTrick || {};
  return `<article class="card">
    <div class="section-head"><div><h3>核心谜底</h3><p>集中记录凶手、手法、动机和主持人口径，仅创作者与获授权的主持人使用。</p></div>
      <button type="button" class="primary-btn" data-action="save-core-trick">保存核心谜底</button></div>
    <div class="assistant-guide"><b>当前会影响什么？</b><span>这里是谜底的唯一结构化档案，目前用于创作完整性统计与作者校对；不会自动公开给玩家，也不会替代公共章节和角色私人剧情。</span></div>
    <label class="cockpit-field"><span>谜底概要</span><textarea data-bible-field="summary" rows="4">${escapeHtml(ct.summary || "")}</textarea></label>
    <label class="cockpit-field"><span>凶手角色</span><select data-bible-field="killerRoleSlotId"><option value="">未指定</option>${roleOptions(roles, ct.killerRoleSlotId || "")}</select></label>
    <label class="cockpit-field"><span>手法</span><textarea data-bible-field="method" rows="3">${escapeHtml(ct.method || "")}</textarea></label>
    <label class="cockpit-field"><span>动机</span><textarea data-bible-field="motive" rows="3">${escapeHtml(ct.motive || "")}</textarea></label>
    <label class="cockpit-field"><span>受害者</span><input class="field" data-bible-field="victim" value="${escapeHtml(ct.victim || "")}"></label>
    <label class="cockpit-field"><span>主持备注</span><textarea data-bible-field="hostNotes" rows="3">${escapeHtml(ct.hostNotes || "")}</textarea></label>
  </article>`;
}

function renderTimelinePanel(events) {
  const rows = events?.length
    ? events.map((ev) => `<article class="host-current-item" data-event-id="${escapeHtml(ev.id)}">
        <strong>${escapeHtml(ev.timeLabel || "—")} · ${escapeHtml(ev.eventSummary || "")}</strong>
        <p class="muted-note">${escapeHtml(ev.alibiNotes || "")}</p>
        <button type="button" class="text-btn danger-text" data-action="delete-timeline-event" data-event-id="${escapeHtml(ev.id)}">删除</button></article>`).join("")
    : `<div class="empty-state">尚无时间线事件。</div>`;
  return `<article class="card">
    <div class="section-head"><div><h3>案件时间线</h3><p>按时间顺序记录关键事件与不在场说明。</p></div></div>
    <div class="host-current-list">${rows}</div>
    <div class="form-group truth-add-form">
      <label>新增事件</label>
      <input class="field" data-timeline-field="timeLabel" placeholder="时间标签，如 22:15">
      <textarea class="field" data-timeline-field="eventSummary" rows="2" placeholder="发生了什么"></textarea>
      <textarea class="field" data-timeline-field="alibiNotes" rows="2" placeholder="不在场 / 目击备注（可选）"></textarea>
      <button type="button" class="primary-btn" data-action="add-timeline-event">添加事件</button>
    </div></article>`;
}

function renderForeshadowPanel(beats) {
  const rows = beats?.length
    ? beats.map((b) => `<article class="host-current-item" data-beat-id="${escapeHtml(b.id)}">
        <strong>${escapeHtml(b.title || "伏笔")}</strong>
        <p>埋：${escapeHtml(b.plantSummary || "—")}</p>
        <p>收：${escapeHtml(b.payoffSummary || "—")}</p>
        <button type="button" class="text-btn danger-text" data-action="delete-foreshadow-beat" data-beat-id="${escapeHtml(b.id)}">删除</button></article>`).join("")
    : `<div class="empty-state">尚无伏笔卡片。</div>`;
  return `<article class="card">
    <div class="section-head"><div><h3>伏笔</h3><p>埋设位置、表面含义与回收位置。</p></div></div>
    <div class="host-current-list">${rows}</div>
    <div class="form-group truth-add-form">
      <label>新增伏笔</label>
      <input class="field" data-foreshadow-field="title" placeholder="标题">
      <textarea class="field" data-foreshadow-field="plantSummary" rows="2" placeholder="埋设说明"></textarea>
      <textarea class="field" data-foreshadow-field="surfaceMeaning" rows="2" placeholder="表面含义"></textarea>
      <textarea class="field" data-foreshadow-field="trueMeaning" rows="2" placeholder="真实含义"></textarea>
      <textarea class="field" data-foreshadow-field="payoffSummary" rows="2" placeholder="回收说明"></textarea>
      <button type="button" class="primary-btn" data-action="add-foreshadow-beat">添加伏笔</button>
    </div></article>`;
}

function renderRelationsPanel(roles, relationships) {
  const relList = relationships?.length
    ? relationships.map((r) => `<article class="checkpoint-row" data-relationship-id="${escapeHtml(r.id)}"><div><strong>${escapeHtml(r.label || "未命名关系")}</strong><p class="muted-note">${escapeHtml(r.from_role_name || "")} → ${escapeHtml(r.to_role_name || "")}${Number.isInteger(r.strength) ? ` · 强度 ${r.strength}` : ""}</p></div><button type="button" class="text-btn danger-text" data-action="delete-relationship-inline" data-relationship-id="${escapeHtml(r.id)}">删除</button></article>`).join("")
    : `<div class="empty-state">尚未建立角色关系。关系默认只作为作者和主持人的结构化参考，不会自动展示给玩家。</div>`;
  return `<article class="card truth-relations-panel">
    <div class="section-head"><div><h3>角色关系</h3><p>明确人物之间的方向、性质和强弱；新增或删除后，下方关系图会同步刷新。</p></div></div>
    <div class="rel-graph-wrap">${relationships === null ? `<div class="empty-state">加载后显示</div>` : renderRelationshipGraph(roles, relationships)}</div>
    <div class="truth-rel-list">${relList}</div>
    ${roles.length ? `<div class="form-group truth-add-form">
      <label>新增关系</label>
      <select class="field" data-rel-field="from" aria-label="关系起点角色">${roleOptions(roles)}</select>
      <select class="field" data-rel-field="to" aria-label="关系终点角色">${roleOptions(roles)}</select>
      <input class="field" data-rel-field="label" placeholder="关系名称，例如：表面盟友、暗中怀疑">
      <input class="field" data-rel-field="strength" type="number" min="-10" max="10" placeholder="关系强度 -10 至 10（可选）">
      <button type="button" class="primary-btn" data-action="add-relationship-inline">添加关系</button>
    </div>` : `<p class="muted-note">请先在角色私人剧本创建角色席位。</p>`}
  </article>`;
}

export function renderTruthBiblePage() {
  const studio = studioStore.get().cloudStudio;
  const ws = worldStore.get();
  const tab = ws.truthBibleTab || "claims";
  const roles = studio?.roles || [];
  let body = "";
  if (tab === "claims") body = renderClaimsPanel(ws.cloudTruthClaims);
  else if (tab === "core-trick") body = renderCoreTrickPanel(ws.cloudCoreTrick, roles);
  else if (tab === "timeline") body = renderTimelinePanel(ws.cloudTimelineEvents);
  else if (tab === "foreshadow") body = renderForeshadowPanel(ws.cloudForeshadowBeats);
  else body = renderRelationsPanel(roles, ws.cloudRoleRelationships);

  const loaded = ws.cloudTruthClaims !== null;
  return `<section class="truth-bible-workspace">
    <header class="writer-hero compact"><div><p class="section-kicker">创作底稿</p><h2>谜底与人物关系</h2>
      <p>集中维护不会直接展示给玩家的核心事实、谜底、时间线、伏笔与人物关系。每个页签都会说明数据当前实际作用。</p></div>
      <button type="button" class="secondary-btn" data-action="refresh-truth-workspace">刷新</button></header>
    <nav class="truth-bible-tabs">${renderTabs(tab)}</nav>
    ${loaded || tab !== "claims" ? `<div class="truth-bible-panel">${body}</div>` : `<div class="empty-state">点击「刷新」加载数据，或切换 Tab 按需加载。</div>`}
  </section>`;
}

export async function loadTruthBibleTab(tab) {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return;
  worldStore.set({ truthBibleTab: tab });
  try {
    if (tab === "claims" || tab === "relations") {
      const [claimsPayload, relPayload] = await Promise.all([
        zhimuApi.getTruthClaims(worldId),
        zhimuApi.getRoleRelationships(worldId)
      ]);
      worldStore.set({
        cloudTruthClaims: claimsPayload?.claims || [],
        cloudRoleRelationships: relPayload?.relationships || []
      });
    } else if (tab === "core-trick") {
      const payload = await zhimuApi.getCoreTrick(worldId);
      worldStore.set({ cloudCoreTrick: payload?.coreTrick || {} });
    } else if (tab === "timeline") {
      const payload = await zhimuApi.getTimelineEvents(worldId);
      worldStore.set({ cloudTimelineEvents: payload?.events || [] });
    } else if (tab === "foreshadow") {
      const payload = await zhimuApi.getForeshadowBeats(worldId);
      worldStore.set({ cloudForeshadowBeats: payload?.beats || [] });
    }
    render();
  } catch (error) {
    showError(error);
  }
}

export function bibleField(name, attr = "data-bible-field") {
  return document.querySelector(`[${attr}="${name}"]`)?.value?.trim?.() ?? document.querySelector(`[${attr}="${name}"]`)?.value ?? "";
}

export function arcFields(prefix = "data-arc-field") {
  return Object.fromEntries(ARC_STAGES.map((key) => [key, document.querySelector(`[${prefix}="${key}"]`)?.value?.trim() || ""]));
}

export { defaultRoleArc, ARC_STAGES };
