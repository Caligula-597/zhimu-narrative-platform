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
import { ARC_STAGES, defaultRoleArc, MATERIAL_BOOKLET_KIND_LABELS } from "../../shared/creator-bible-contract.js";

const showError = (error, fallback = "操作失败") => showToast(normalizeError(error, fallback));

const TABS = [
  { id: "digest", label: "主持手册汇总" },
  { id: "claims", label: "核心事实" },
  { id: "core-trick", label: "核心谜底" },
  { id: "endings", label: "结局导向" },
  { id: "timeline", label: "案件时间线" },
  { id: "foreshadow", label: "伏笔" },
  { id: "materials", label: "平行物料册" },
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


function renderMaterialsPanel(booklets, roles) {
  const kindLabel = (kind) => MATERIAL_BOOKLET_KIND_LABELS[kind] || kind || "其他";
  const rows = booklets?.length
    ? booklets.map((b) => {
        const pageCount = Array.isArray(b.pages) ? b.pages.length : 0;
        const owner = roles.find((r) => r.id === b.ownerRoleSlotId);
        return `<article class="host-current-item" data-booklet-id="${escapeHtml(b.id)}">
          <strong>${escapeHtml(b.title || "未命名物料册")}</strong>
          <p class="muted-note">${escapeHtml(kindLabel(b.kind))}${owner ? ` · 归属 ${escapeHtml(owner.name)}` : ""}${b.phaseLabel ? ` · ${escapeHtml(b.phaseLabel)}` : ""} · ${pageCount} 页</p>
          <p>${escapeHtml(b.summary || "—")}</p>
          <button type="button" class="text-btn danger-text" data-action="delete-material-booklet" data-booklet-id="${escapeHtml(b.id)}">删除</button>
        </article>`;
      }).join("")
    : `<div class="empty-state">尚无平行物料册。日记、花草目录、镜目录等应建册，不要降级成线索。</div>`;
  const kindOptions = Object.entries(MATERIAL_BOOKLET_KIND_LABELS)
    .map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`)
    .join("");
  return `<article class="card">
    <div class="section-head"><div><h3>平行物料册</h3>
      <p>日记、目录、手册等完整册子；可挂归属角色与关联线索 ID，局内发放仍走线索/主持动作。</p></div></div>
    <div class="host-current-list">${rows}</div>
    <div class="form-group truth-add-form">
      <label>新增物料册</label>
      <select class="field" data-material-field="kind" aria-label="物料册类型">${kindOptions}</select>
      <input class="field" data-material-field="title" placeholder="标题，例如：镜目录 / 绿野日记">
      <select class="field" data-material-field="ownerRoleSlotId" aria-label="归属角色">
        <option value="">无固定归属</option>${roleOptions(roles)}
      </select>
      <input class="field" data-material-field="phaseLabel" placeholder="阶段（可选，如 D1 / 第二幕）">
      <textarea class="field" data-material-field="summary" rows="2" placeholder="册子用途说明"></textarea>
      <textarea class="field" data-material-field="pageBody" rows="4" placeholder="首页正文（可先写一页，之后再扩页）"></textarea>
      <button type="button" class="primary-btn" data-action="add-material-booklet">添加物料册</button>
    </div></article>`;
}

function renderDigestPanel(digest) {
  if (!digest) {
    return `<article class="card"><div class="empty-state">点击「刷新」或切到本页签，加载主持手册汇总。</div></article>`;
  }
  const ratio = Math.round((digest.completeness?.ratio || 0) * 100);
  const chain = (digest.chain || []).map((item) => {
    const statusLabel = item.status === "filled" ? "已填" : item.status === "partial" ? "部分" : "待补";
    const links = (item.links || [])
      .map((link) => {
        if (link.kind === "tab") {
          return `<button type="button" class="text-btn" data-truth-tab="${escapeHtml(link.id)}">${escapeHtml(link.label)}</button>`;
        }
        return `<button type="button" class="text-btn" data-go="${escapeHtml(link.id)}">${escapeHtml(link.label)}</button>`;
      })
      .join(" ");
    return `<article class="host-current-item handbook-chain-item is-${escapeHtml(item.status)}">
      <div class="row"><strong>${escapeHtml(item.title)}</strong><span class="status-chip">${escapeHtml(statusLabel)}</span></div>
      <p>${escapeHtml(item.detail || "")}</p>
      <div class="row">${links}</div>
    </article>`;
  }).join("");
  const pairs = (digest.pairPreview || []).length
    ? `<div class="host-current-list">${digest.pairPreview.map((pair) =>
      `<article class="host-current-item"><strong>${escapeHtml(pair.sceneName || "场景")} ↔ ${escapeHtml(pair.clueName || "线索")}</strong>
       <p class="muted-note">${escapeHtml(pair.trigger || "触发条件待补")}</p></article>`
    ).join("")}</div>`
    : `<p class="muted-note">尚无场景↔线索调查点配对预览。</p>`;
  return `<article class="card truth-digest-panel">
    <div class="section-head"><div><h3>主持手册汇总</h3>
      <p>自动把已填充的谜底、关系、场景线索、触发条件、结局与小游戏串成主持人可读链路。补写任一页签后点刷新即可更新。</p></div>
      <strong>${ratio}%</strong></div>
    <div class="assistant-guide"><b>当前作用</b><span>这是作者/主持人校对用的串联视图，不会直接展示给玩家。完整度 ${digest.completeness?.filled || 0}/${digest.completeness?.total || 0}。</span></div>
    <pre class="handbook-narrative">${escapeHtml(digest.narrative || "尚无已填充内容可串联。")}</pre>
    <h4>填充链路</h4>
    <div class="host-current-list">${chain || `<div class="empty-state">暂无链路。</div>`}</div>
    <h4>场景线索对应</h4>
    ${pairs}
  </article>`;
}

function renderEndingsPanel(endings, flowNotes) {
  const list = endings?.length
    ? endings.map((item, index) => `<article class="host-current-item" data-ending-index="${index}">
        <label class="cockpit-field"><span>结局标题</span>
          <input class="field" data-ending-field="title" data-ending-index="${index}" value="${escapeHtml(item.title || "")}"></label>
        <label class="cockpit-field"><span>导向条件 / 备注</span>
          <input class="field" data-ending-field="routeHint" data-ending-index="${index}" value="${escapeHtml(item.routeHint || "")}"></label>
        <label class="cockpit-field"><span>结局正文</span>
          <textarea class="field" data-ending-field="summary" data-ending-index="${index}" rows="4">${escapeHtml(item.summary || "")}</textarea></label>
        <button type="button" class="text-btn danger-text" data-action="delete-bible-ending" data-ending-index="${index}">删除</button>
      </article>`).join("")
    : `<div class="empty-state">尚无结局。导入主持手册后会预填，也可手工新增不同结局正文与导向。</div>`;
  const notes = (flowNotes || []).length
    ? `<ul class="muted-note">${flowNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
    : `<p class="muted-note">暂无开本流程摘录。</p>`;
  return `<article class="card">
    <div class="section-head"><div><h3>结局导向</h3>
      <p>把主持人手册里的结局分支、宣判口径写在这里；与核心谜底区分开，避免混在角色本里。</p></div>
      <div class="row">
        <button type="button" class="secondary-btn" data-action="add-bible-ending">＋ 新增结局</button>
        <button type="button" class="primary-btn" data-action="save-bible-endings">保存结局</button>
      </div></div>
    <div class="assistant-guide"><b>当前作用</b><span>写入剧本 settings.hostHandbook.endings，供主持校对与汇总串联；局内宣判仍可走机制结局或房间复盘。</span></div>
    <h4>开本流程摘录</h4>
    ${notes}
    <div class="host-current-list">${list}</div>
  </article>`;
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
  const tab = ws.truthBibleTab || "digest";
  const roles = studio?.roles || [];
  let body = "";
  if (tab === "digest") body = renderDigestPanel(ws.cloudHandbookDigest);
  else if (tab === "claims") body = renderClaimsPanel(ws.cloudTruthClaims);
  else if (tab === "core-trick") body = renderCoreTrickPanel(ws.cloudCoreTrick, roles);
  else if (tab === "endings") body = renderEndingsPanel(ws.cloudBibleEndings, ws.cloudBibleFlowNotes);
  else if (tab === "timeline") body = renderTimelinePanel(ws.cloudTimelineEvents);
  else if (tab === "foreshadow") body = renderForeshadowPanel(ws.cloudForeshadowBeats);
  else if (tab === "materials") body = renderMaterialsPanel(ws.cloudMaterialBooklets, roles);
  else body = renderRelationsPanel(roles, ws.cloudRoleRelationships);

  const loaded = ws.cloudHandbookDigest !== null || ws.cloudTruthClaims !== null;
  return `<section class="truth-bible-workspace">
    <header class="writer-hero compact"><div><p class="section-kicker">创作底稿 · 主持人手册</p><h2>谜底与人物关系</h2>
      <p>把主持手册里的谜底、关系、结局与场景线索口径集中维护；「主持手册汇总」会自动串联已填内容。</p></div>
      <button type="button" class="secondary-btn" data-action="refresh-truth-workspace">刷新</button></header>
    <nav class="truth-bible-tabs">${renderTabs(tab)}</nav>
    ${loaded || tab !== "digest" ? `<div class="truth-bible-panel">${body}</div>` : `<div class="empty-state">点击「刷新」加载数据，或切换 Tab 按需加载。</div>`}
  </section>`;
}

export async function loadTruthBibleTab(tab) {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return;
  worldStore.set({ truthBibleTab: tab });
  try {
    if (tab === "digest") {
      const digest = await zhimuApi.getHandbookDigest(worldId);
      worldStore.set({
        cloudHandbookDigest: digest || null,
        cloudBibleEndings: digest?.endings || [],
        cloudBibleFlowNotes: digest?.flowNotes || []
      });
    } else if (tab === "claims" || tab === "relations") {
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
    } else if (tab === "endings") {
      const payload = await zhimuApi.getBibleEndings(worldId);
      worldStore.set({
        cloudBibleEndings: payload?.endings || [],
        cloudBibleFlowNotes: payload?.flowNotes || []
      });
    } else if (tab === "timeline") {
      const payload = await zhimuApi.getTimelineEvents(worldId);
      worldStore.set({ cloudTimelineEvents: payload?.events || [] });
    } else if (tab === "foreshadow") {
      const payload = await zhimuApi.getForeshadowBeats(worldId);
      worldStore.set({ cloudForeshadowBeats: payload?.beats || [] });
    } else if (tab === "materials") {
      const payload = await zhimuApi.getMaterialBooklets(worldId);
      worldStore.set({ cloudMaterialBooklets: payload?.booklets || [] });
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
