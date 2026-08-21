/** Story diagnostics center — traceable causal, information and fairness checks. */
import "./story-diagnostics.css";
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { openStoryReference } from "../runtime/story-reference-navigation.js";
import { registerView } from "../runtime/view-registry.js";
import { worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { normalizeError } from "../components/status-ui.js";
import { creatorWorkspaceEmpty } from "../components/emptyState.js";

export const STORY_DIAGNOSTIC_STANDARD_OPTIONS = [
  ["classic", "本格公平"],
  ["emotional", "情感还原"],
  ["mechanism", "机制推理"],
  ["narrative", "叙事诡计"],
  ["open", "开放调查"]
];

const CATEGORY_META = {
  intent: { label: "创作意图", icon: "北", description: "体验承诺、项目护栏与角色高光" },
  causal: { label: "因果链", icon: "因", description: "事件前因、后果与可删除性" },
  information: { label: "信息链", icon: "知", description: "获得路径、角色知识与交流依赖" },
  fairness: { label: "公平推理", icon: "证", description: "真相证据、揭晓时机与关键线索" }
};
const STRUCTURAL_CATEGORIES = ["causal", "information", "fairness"];

const SEVERITY_META = {
  danger: { label: "高风险", icon: "!" },
  warning: { label: "待确认", icon: "?" },
  info: { label: "观察", icon: "i" }
};

function currentStandard() {
  return worldStore.get().cloudStoryDiagnosticsStandard || "classic";
}

function standardButtons(active) {
  return STORY_DIAGNOSTIC_STANDARD_OPTIONS.map(([id, label]) => `
    <button type="button" class="diagnostic-standard ${id === active ? "active" : ""}"
      data-action="diagnostics-standard" data-standard="${id}" aria-pressed="${id === active ? "true" : "false"}">
      ${escapeHtml(label)}
    </button>`).join("");
}

function statusLabel(status) {
  return ({
    blocked: "存在阻塞风险",
    review: "需要作者复核",
    ready: "结构检查通过"
  })[status] || "等待诊断";
}

function scoreCard(key, label, value, detail) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `<article class="diagnostic-score-card ${key}">
    <div class="diagnostic-score-ring" style="--score:${safe}"><strong>${safe}</strong><span>/ 100</span></div>
    <div><p class="section-kicker">${escapeHtml(key.toUpperCase())}</p><h3>${escapeHtml(label)}</h3><p>${escapeHtml(detail)}</p></div>
  </article>`;
}

function refButton(ref, label = "") {
  if (!ref?.id) return "";
  return `<button type="button" class="diagnostic-ref" data-action="diagnostics-open-ref"
    data-ref-type="${escapeHtml(ref.type)}" data-ref-id="${escapeHtml(ref.id)}"
    title="打开${escapeHtml(ref.label || "相关对象")}">
    <span>${escapeHtml(ref.label || label || "相关对象")}</span><i>↗</i>
  </button>`;
}

function refList(refs = []) {
  return refs.length
    ? `<div class="diagnostic-ref-list">${refs.slice(0, 8).map((ref) => refButton(ref)).join("")}</div>`
    : "";
}

function issueCard(issue) {
  const severity = SEVERITY_META[issue.severity] || SEVERITY_META.warning;
  const category = CATEGORY_META[issue.category] || CATEGORY_META.causal;
  const path = issue.path?.length > 1
    ? `<div class="diagnostic-inline-path">${issue.path.map((ref, index) => `
        ${index ? "<b>→</b>" : ""}${refButton(ref)}`).join("")}</div>`
    : "";
  return `<article class="diagnostic-issue ${escapeHtml(issue.severity)}">
    <div class="diagnostic-issue-marker">${escapeHtml(severity.icon)}</div>
    <div class="diagnostic-issue-body">
      <div class="diagnostic-issue-head">
        <span class="status-chip ${issue.severity === "danger" ? "draft" : issue.severity === "warning" ? "testing" : "neutral"}">${escapeHtml(severity.label)}</span>
        <span>${escapeHtml(category.label)}</span>
      </div>
      <h4>${escapeHtml(issue.title)}</h4>
      <p>${escapeHtml(issue.detail)}</p>
      ${issue.rationale ? `<small>${escapeHtml(issue.rationale)}</small>` : ""}
      ${path}
      ${refList(issue.refs)}
      ${issue.recommendation ? `<div class="diagnostic-recommendation"><b>建议</b><span>${escapeHtml(issue.recommendation)}</span></div>` : ""}
    </div>
  </article>`;
}

function renderIssues(report) {
  const groups = STRUCTURAL_CATEGORIES.map((category) => {
    const meta = CATEGORY_META[category];
    const issues = (report.issues || []).filter((issue) => issue.category === category);
    return `<section class="diagnostic-issue-group">
      <div class="section-head">
        <div><p class="section-kicker">${escapeHtml(category.toUpperCase())}</p><h3>${meta.icon} · ${escapeHtml(meta.label)}</h3><p>${escapeHtml(meta.description)}</p></div>
        <span class="status-chip neutral">${issues.length} 项</span>
      </div>
      <div class="diagnostic-issue-list">
        ${issues.length ? issues.map(issueCard).join("") : `<div class="diagnostic-clear"><span>✓</span><p>当前已建模结构未发现此类问题。</p></div>`}
      </div>
    </section>`;
  });
  return `<section class="diagnostic-section">
    <div class="diagnostic-section-title"><div><p class="section-kicker">PRIORITY FINDINGS</p><h2>优先处理</h2></div>
      <p>每条结论都附带创作对象引用；点击对象可回到编辑器定位。</p></div>
    <div class="diagnostic-issue-columns">${groups.join("")}</div>
  </section>`;
}

function renderConstitution(report) {
  const constitution = report.constitution || {};
  const issues = (report.issues || []).filter((issue) => issue.category === "intent");
  const missing = constitution.missing || [];
  const configured = Boolean(constitution.configured);
  return `<section class="diagnostic-constitution ${configured ? "configured" : "empty"}">
    <div class="diagnostic-constitution-score" style="--score:${Number(constitution.score) || 0}">
      <strong>${Number(constitution.score) || 0}</strong><span>%</span>
    </div>
    <div class="diagnostic-constitution-copy">
      <p class="section-kicker">CREATIVE CONSTITUTION</p>
      <h2>${configured ? escapeHtml(constitution.theme || "创作宪法已接入诊断") : "先定义作品想成为什么"}</h2>
      <p>${configured
        ? escapeHtml(constitution.experiencePromise || "已保存创作约束；继续补齐体验承诺可提高诊断针对性。")
        : "当前只能使用通用类型标准。写下体验承诺、不可破坏原则和角色高光后，诊断才知道什么不能被牺牲。"}</p>
      <div class="diagnostic-constitution-meta">
        <span>${constitution.filled || 0} / ${constitution.total || 0} 项约束</span>
        <span>${constitution.roleHighlights?.filled || 0} / ${constitution.roleHighlights?.total || 0} 角色高光</span>
        <span>证据下限 ${constitution.minimumEvidence || report.standard.minEvidence || 1} 条</span>
        ${constitution.requireIndependentPaths ? "<span>要求独立获得路径</span>" : ""}
      </div>
      ${missing.length ? `<small>待补：${missing.slice(0, 5).map((item) => escapeHtml(item.label)).join("、")}</small>` : ""}
    </div>
    <div class="diagnostic-constitution-action">
      <button type="button" class="secondary-btn" data-action="diagnostics-open-ref"
        data-ref-type="constitution" data-ref-id="creative-constitution">${configured ? "完善创作宪法" : "建立创作宪法"} →</button>
    </div>
    ${issues.length ? `<div class="diagnostic-constitution-issues">${issues.slice(0, 3).map(issueCard).join("")}</div>` : ""}
  </section>`;
}

function chainRow(chain) {
  const [from, to] = chain.path || [];
  if (!from || !to) return "";
  const kind = ({
    authored: "剧情边",
    acquisition: "获得路径",
    evidence: "证据链",
    rule: "规则链"
  })[chain.kind] || "关系";
  return `<div class="diagnostic-chain-row">
    ${refButton(from)}
    <span class="diagnostic-chain-arrow"><i>→</i><small>${escapeHtml(chain.relation || kind)}</small></span>
    ${refButton(to)}
    <span class="status-chip neutral">${escapeHtml(kind)}</span>
  </div>`;
}

function renderCausal(report) {
  const events = report.causal?.events || [];
  const chains = report.causal?.chains || [];
  const eventRows = events.length
    ? events.map((event) => `<tr>
        <td>${refButton(event.ref)}</td>
        <td>${event.inboundCount}</td><td>${event.outboundCount}</td><td>${event.downstreamCount}</td>
        <td>${event.inboundCount || events[0]?.ref?.id === event.ref.id ? '<span class="status-chip published">有前因</span>' : '<span class="status-chip draft">缺前因</span>'}</td>
      </tr>`).join("")
    : `<tr><td colspan="5">尚无事件节点。</td></tr>`;
  return `<section class="diagnostic-section diagnostic-structure-grid">
    <article class="card diagnostic-chain-card">
      <div class="section-head"><div><p class="section-kicker">CAUSAL MRI</p><h3>结构链路</h3><p>只展示显式剧情边、规则、调查获得与真相证据。</p></div><span class="status-chip neutral">${chains.length} 条</span></div>
      <div class="diagnostic-chain-list">
        ${chains.length ? chains.slice(0, 28).map(chainRow).join("") : `<div class="empty-state">尚未建立可展示的结构链路。</div>`}
      </div>
    </article>
    <article class="card">
      <div class="section-head"><div><p class="section-kicker">DELETE IMPACT</p><h3>事件影响半径</h3><p>用于回答“删除这个事件后，后续是否仍成立”。</p></div></div>
      <div class="diagnostic-table-wrap"><table class="diagnostic-table">
        <thead><tr><th>事件</th><th>入边</th><th>出边</th><th>下游</th><th>状态</th></tr></thead>
        <tbody>${eventRows}</tbody>
      </table></div>
    </article>
  </section>`;
}

function timelineCard(timeline) {
  const stages = timeline.stages || [];
  return `<article class="diagnostic-timeline-card">
    <div class="diagnostic-timeline-role">${refButton(timeline.role)}<span>${timeline.itemCount} 项已建模信息</span></div>
    <div class="diagnostic-timeline-stages">
      ${stages.length ? stages.map((stage) => `<div>
        <strong>${stage.sequence ? `阶段 ${stage.sequence}` : "初始"} · ${escapeHtml(stage.segmentTitle || "未绑定阶段")}</strong>
        <p>${stage.items.slice(0, 6).map((item) => escapeHtml(item.label)).join(" · ")}</p>
      </div>`).join("") : `<div class="diagnostic-timeline-empty">没有私人分幕、角色可见真相或角色专属线索分发。</div>`}
    </div>
  </article>`;
}

function communicationCard(item) {
  return `<article class="diagnostic-communication-card">
    <div><span class="status-chip testing">必须交流候选</span>${refButton(item.truth)}</div>
    <p>${escapeHtml(item.reason)}</p>
    <div class="diagnostic-communication-flow">
      <div>${item.roles.map((role) => refButton(role)).join("")}</div><b>⇄</b>
      <div>${item.evidence.map((ref) => refButton(ref)).join("")}</div>
    </div>
  </article>`;
}

function renderInformation(report) {
  const timelines = report.information?.knowledgeTimelines || [];
  const communication = report.information?.communicationNeeds || [];
  return `<section class="diagnostic-section">
    <div class="diagnostic-section-title"><div><p class="section-kicker">INFORMATION FLOW</p><h2>谁在什么时候知道什么</h2></div>
      <p>${communication.length ? `发现 ${communication.length} 个需要跨角色拼合信息的真相。` : "当前未识别到必须跨角色拼合的显式证据组。"}</p></div>
    <div class="diagnostic-information-grid">
      <article class="card">
        <div class="section-head"><div><h3>角色知识时间线</h3><p>来自私人分幕、角色可见真相、Segment 引用和 clueGrants。</p></div><span class="status-chip neutral">${timelines.length} 角色</span></div>
        <div class="diagnostic-timeline-list">${timelines.length ? timelines.map(timelineCard).join("") : `<div class="empty-state">尚无角色信息流可分析。</div>`}</div>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>必须交流矩阵</h3><p>只有证据明确分散且无人独占全部证据时才列出。</p></div><span class="status-chip neutral">${communication.length} 组</span></div>
        <div class="diagnostic-communication-list">${communication.length ? communication.map(communicationCard).join("") : `<div class="diagnostic-clear"><span>✓</span><p>未发现明确的跨角色单点依赖。</p></div>`}</div>
      </article>
    </div>
  </section>`;
}

function fairnessRow(claim) {
  const status = {
    supported: ["可支撑", "published"],
    weak: ["证据偏弱", "testing"],
    unsupported: ["无证据", "draft"]
  }[claim.status] || ["待检查", "neutral"];
  return `<tr>
    <td>${refButton(claim.truth)}</td>
    <td><span class="status-chip ${status[1]}">${status[0]}</span></td>
    <td>${claim.evidence.length} / ${claim.minimum}</td>
    <td><div class="diagnostic-cell-refs">${claim.evidence.length ? claim.evidence.map((ref) => refButton(ref)).join("") : "—"}</div></td>
    <td>${escapeHtml(claim.revealStage || "未设置")}</td>
  </tr>`;
}

function renderFairness(report) {
  const claims = report.fairness?.claims || [];
  const evidenceSource = report.standard?.constitutionOverride ? "创作宪法" : `「${report.standard.label}」`;
  return `<section class="diagnostic-section card">
    <div class="section-head"><div><p class="section-kicker">FAIRNESS</p><h2>真相可推理性</h2>
      <p>${escapeHtml(evidenceSource)}要求每条核心结论至少 ${report.fairness?.minimumEvidence || 1} 条显式证据。</p></div>
      <div class="row"><span class="status-chip published">${report.fairness?.supportedClaims || 0} 条可支撑</span><span class="status-chip testing">${report.fairness?.weakClaims || 0} 条偏弱</span></div>
    </div>
    <div class="diagnostic-table-wrap"><table class="diagnostic-table diagnostic-fairness-table">
      <thead><tr><th>真相</th><th>结论</th><th>证据数</th><th>证据对象</th><th>计划揭晓</th></tr></thead>
      <tbody>${claims.length ? claims.map(fairnessRow).join("") : `<tr><td colspan="5">尚未录入真相断言。</td></tr>`}</tbody>
    </table></div>
  </section>`;
}

function renderLimitations(report) {
  return `<details class="diagnostic-limitations card">
    <summary>这份报告能判断什么，不能判断什么</summary>
    <ul>${(report.limitations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </details>`;
}

function renderLoading(activeStandard) {
  return `<section class="diagnostic-page">
    <header class="diagnostic-hero">
      <div><p class="section-kicker">STORY MRI</p><h1>作品诊断中心</h1><p>正在读取结构化创作对象并重建因果、信息与证据链。</p></div>
    </header>
    <div class="diagnostic-standard-bar">${standardButtons(activeStandard)}</div>
    <div class="diagnostic-loading card"><span></span><h3>正在运行结构诊断</h3><p>大型剧本可能需要几秒钟。</p></div>
  </section>`;
}

function renderError(activeStandard, error) {
  return `<section class="diagnostic-page">
    <header class="diagnostic-hero"><div><p class="section-kicker">STORY MRI</p><h1>作品诊断中心</h1><p>因果链、信息链与公平推理检查。</p></div></header>
    <div class="diagnostic-standard-bar">${standardButtons(activeStandard)}</div>
    <div class="workspace-inline-error"><strong>诊断加载失败</strong><p>${escapeHtml(error || "请稍后重试。")}</p>
      <button type="button" class="primary-btn" data-action="diagnostics-refresh">重新诊断</button></div>
  </section>`;
}

export function storyDiagnostics() {
  if (!zhimuApi.context.worldId) {
    return creatorWorkspaceEmpty({
      kicker: "STORY MRI",
      title: "作品诊断中心",
      intro: "创建或选择剧本后，系统会读取因果链、信息链与证据链并生成结构诊断。",
      guideTitle: "诊断会检查什么",
      guideItems: [
        {
          label: "结构",
          title: "因果链与信息链",
          text: "定位缺少前因、不可达线索和跨角色信息单点。",
          bullets: ["关键事件前后因", "线索获得路径", "角色知识时间线"]
        },
        {
          label: "公平",
          title: "证据与揭晓",
          text: "检查核心结论是否拥有足够且独立的显式证据。",
          bullets: ["证据数量下限", "独立获得路径", "揭晓时机"]
        }
      ]
    });
  }
  const state = worldStore.get();
  const report = state.cloudStoryDiagnostics;
  const activeStandard = currentStandard();
  if (state.cloudStoryDiagnosticsLoading && !report) return renderLoading(activeStandard);
  if (state.cloudStoryDiagnosticsError && !report) return renderError(activeStandard, state.cloudStoryDiagnosticsError);
  if (!report) return renderLoading(activeStandard);

  const generated = report.generatedAt ? new Date(report.generatedAt).toLocaleString("zh-CN") : "刚刚";
  return `<section class="diagnostic-page">
    <header class="diagnostic-hero ${escapeHtml(report.status)}">
      <div>
        <p class="section-kicker">STORY MRI · ${escapeHtml(report.standard.label)}</p>
        <h1>作品诊断中心</h1>
        <p>${escapeHtml(report.standard.description)}</p>
        <div class="diagnostic-hero-meta">
          <span>${report.scope.events} 个事件</span><span>${report.scope.clues} 条线索</span>
          <span>${report.scope.truthClaims} 条真相</span><span>${report.scope.roles} 个角色</span>
          <span>宪法 ${report.constitution?.score || 0}%</span>
          <span>更新于 ${escapeHtml(generated)}</span>
        </div>
      </div>
      <div class="diagnostic-overall">
        <span>${escapeHtml(statusLabel(report.status))}</span><strong>${report.scores.overall}</strong><small>结构健康度</small>
        <button type="button" class="secondary-btn compact" data-action="diagnostics-refresh">重新诊断</button>
      </div>
    </header>
    <div class="diagnostic-standard-bar"><span>评价标准</span>${standardButtons(activeStandard)}</div>
    ${renderConstitution(report)}
    <section class="diagnostic-summary-grid">
      ${scoreCard("causal", "因果链", report.scores.causal, `${report.causal.orphanEvents.length} 个缺前因事件 · ${report.causal.removableCandidates.length} 个低影响候选`)}
      ${scoreCard("information", "信息链", report.scores.information, `${report.information.unreachableClues.length} 条不可达 · ${report.information.singlePointClues.length} 个单点线索`)}
      ${scoreCard("fairness", "公平推理", report.scores.fairness, `${report.fairness.supportedClaims} 条可支撑 · ${report.fairness.weakClaims} 条偏弱`)}
    </section>
    <div class="diagnostic-headline ${report.summary.danger ? "danger" : report.summary.warning ? "warning" : "ready"}">
      <strong>${escapeHtml(report.summary.headline)}</strong>
      <span>${report.summary.danger} 高风险 · ${report.summary.warning} 待确认 · 共 ${report.summary.issueCount} 项</span>
    </div>
    ${renderIssues(report)}
    ${renderCausal(report)}
    ${renderInformation(report)}
    ${renderFairness(report)}
    ${renderLimitations(report)}
  </section>`;
}

export async function loadStoryDiagnostics({ standard = currentStandard(), quiet = false } = {}) {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) {
    worldStore.set({
      cloudStoryDiagnostics: null,
      cloudStoryDiagnosticsLoading: false,
      cloudStoryDiagnosticsError: ""
    });
    return null;
  }
  worldStore.set({
    cloudStoryDiagnosticsStandard: standard,
    cloudStoryDiagnosticsLoading: true,
    cloudStoryDiagnosticsError: ""
  });
  render();
  try {
    const report = await zhimuApi.getStoryDiagnostics({ standard, worldId });
    if (zhimuApi.context.worldId !== worldId || currentStandard() !== standard) return null;
    worldStore.set({
      cloudStoryDiagnostics: report,
      cloudStoryDiagnosticsLoading: false,
      cloudStoryDiagnosticsError: ""
    });
    render();
    if (!quiet) showToast(`已按「${report.standard.label}」完成作品诊断`);
    return report;
  } catch (error) {
    if (zhimuApi.context.worldId !== worldId || currentStandard() !== standard) return null;
    const message = normalizeError(error, "作品诊断失败，请稍后重试");
    worldStore.set({
      cloudStoryDiagnostics: null,
      cloudStoryDiagnosticsLoading: false,
      cloudStoryDiagnosticsError: message
    });
    render();
    if (!quiet) showToast(message);
    return null;
  }
}

export function selectStoryDiagnosticStandard(standard) {
  if (!STORY_DIAGNOSTIC_STANDARD_OPTIONS.some(([id]) => id === standard)) return;
  if (standard === currentStandard() && worldStore.get().cloudStoryDiagnostics) return;
  worldStore.set({
    cloudStoryDiagnosticsStandard: standard,
    cloudStoryDiagnostics: null,
    cloudStoryDiagnosticsError: ""
  });
  void loadStoryDiagnostics({ standard, quiet: true });
}

export function openStoryDiagnosticReference(type, id) {
  openStoryReference(type, id);
}

export const storyDiagnosticsApi = {
  storyDiagnostics,
  loadStoryDiagnostics,
  selectStoryDiagnosticStandard,
  openStoryDiagnosticReference
};

registerView("storyDiagnostics", storyDiagnosticsApi);
