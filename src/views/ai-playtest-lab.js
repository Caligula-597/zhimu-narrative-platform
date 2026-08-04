/** Multi-agent AI playtest lab — isolated player contexts plus observer synthesis. */
import "./ai-playtest-lab.css";
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { render } from "../runtime/runtime-facade.js";
import { openStoryReference } from "../runtime/story-reference-navigation.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { AI_PLAYER_ARCHETYPES } from "../../shared/ai-playtest.js";

const DEFAULT_ARCHETYPES = new Set(["logical", "emotional", "social", "silent"]);
const SEVERITY_META = {
  danger: { label: "阻塞风险", mark: "!" },
  warning: { label: "需要改稿", mark: "?" },
  info: { label: "观察项", mark: "i" }
};
const CATEGORY_LABELS = {
  comprehension: "理解",
  information: "信息",
  fairness: "公平",
  pacing: "节奏",
  agency: "主动性",
  communication: "交流",
  intent: "创作意图"
};
const METRIC_LABELS = {
  clarity: "目标清晰",
  fairness: "推理公平",
  agency: "角色主动",
  pacing: "节奏推进",
  communication: "信息交流",
  intentAlignment: "宪法一致"
};

function roles() {
  return studioStore.get().cloudStudio?.roles
    || worldStore.get().cloudWorkspacePreview?.roles
    || [];
}

function playtestRuns() {
  return worldStore.get().cloudAiPlaytestRuns || [];
}

function activeRun() {
  return worldStore.get().cloudAiPlaytestActive || playtestRuns()[0] || null;
}

function reportOf(run) {
  return run?.report || run || null;
}

function configFromRun(run) {
  const report = reportOf(run);
  const profiles = (report?.players || []).map((player, index) => ({
    seatId: player.seatId || `seat-${index + 1}`,
    roleSlotId: player.role?.id,
    archetype: player.archetype
  })).filter((profile) => profile.roleSlotId && profile.archetype);
  if (!profiles.length) return null;
  return {
    depth: report.depth === "deep" ? "deep" : "quick",
    focus: report.focus || "",
    profiles
  };
}

function formattedTime(value) {
  if (!value) return "刚刚";
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "刚刚";
  }
}

function referenceButton(ref) {
  if (!ref?.id || !ref?.type) return "";
  return `<button type="button" class="diagnostic-ref" data-action="ai-playtest-open-ref"
    data-ref-type="${escapeHtml(ref.type)}" data-ref-id="${escapeHtml(ref.id)}">
    <span>${escapeHtml(ref.label || ref.id)}</span><i>↗</i>
  </button>`;
}

function referenceList(refs = []) {
  return refs.length
    ? `<div class="diagnostic-ref-list">${refs.slice(0, 8).map(referenceButton).join("")}</div>`
    : "";
}

function roleOptions(selectedId) {
  return roles().map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === selectedId ? "selected" : ""}>
    ${escapeHtml(role.name || "未命名角色")}
  </option>`).join("");
}

function archetypeCards(config) {
  const authoredRoles = roles();
  const configuredProfiles = new Map((config?.profiles || []).map((profile) => [profile.archetype, profile]));
  const selectedArchetypes = config?.profiles?.length
    ? new Set(config.profiles.map((profile) => profile.archetype))
    : DEFAULT_ARCHETYPES;
  return Object.entries(AI_PLAYER_ARCHETYPES).map(([id, meta], index) => {
    const checked = selectedArchetypes.has(id);
    const configuredRoleId = configuredProfiles.get(id)?.roleSlotId;
    const role = authoredRoles.find((item) => item.id === configuredRoleId)
      || authoredRoles[index % Math.max(1, authoredRoles.length)];
    return `<label class="playtest-archetype ${checked ? "selected" : ""}">
      <input type="checkbox" data-playtest-archetype="${escapeHtml(id)}" ${checked ? "checked" : ""}>
      <span class="playtest-archetype-mark">${escapeHtml(meta.short)}</span>
      <span class="playtest-archetype-copy">
        <strong>${escapeHtml(meta.label)}</strong>
        <small>${escapeHtml(meta.description)}</small>
        ${authoredRoles.length ? `<select class="field" data-playtest-role="${escapeHtml(id)}"
          aria-label="${escapeHtml(meta.label)}扮演角色">${roleOptions(role?.id)}</select>` : ""}
      </span>
    </label>`;
  }).join("");
}

function renderConfiguration() {
  const state = worldStore.get();
  const llm = state.cloudAiPlaytestLlmStatus;
  const config = state.cloudAiPlaytestDraftConfig;
  const configured = llm?.configured !== false;
  const roleCount = roles().length;
  return `<section class="card playtest-config-card">
    <div class="section-head">
      <div>
        <p class="section-kicker">TEST CAST</p>
        <h2>组建虚拟玩家桌</h2>
        <p>每个席位拥有独立上下文，不能读取作者真相；角色可重复，用于比较不同玩家类型。</p>
      </div>
      <span class="status-chip ${configured ? "published" : "draft"}">
        ${configured ? escapeHtml(llm?.model || "AI 已就绪") : "尚未配置模型"}
      </span>
    </div>
    ${roleCount ? `
      <div class="playtest-depth-switch" role="radiogroup" aria-label="试跑深度">
        <label><input type="radio" name="playtest-depth" value="quick" ${config?.depth !== "deep" ? "checked" : ""}><span><b>快速试跑</b><small>主流程压力测试</small></span></label>
        <label><input type="radio" name="playtest-depth" value="deep" ${config?.depth === "deep" ? "checked" : ""}><span><b>深度试跑</b><small>更长回放与宪法复核</small></span></label>
      </div>
      <div class="playtest-archetype-grid">${archetypeCards(config)}</div>
      <label class="playtest-focus">
        <span>本轮特别关注</span>
        <textarea class="field" rows="3" data-playtest-focus
          placeholder="例如：时间线反转是否过早暴露；沉默玩家不分享线索时会不会卡死。">${escapeHtml(config?.focus || "")}</textarea>
      </label>
      <div class="playtest-run-row">
        <p><strong>隔离规则</strong><span>玩家只读自身剧本、公开场景和可见线索；观察员最后才读取作者真相。</span></p>
        <button type="button" class="primary-btn playtest-run-btn" data-action="ai-playtest-run"
          ${state.cloudAiPlaytestRunning || !configured ? "disabled" : ""}>
          ${state.cloudAiPlaytestRunning ? "玩家正在推演…" : "▶ 开始多 AI 试跑"}
        </button>
      </div>
      ${configured ? "" : `<div class="workspace-inline-error"><strong>需要先连接模型</strong><p>可以使用平台模型，或在账号中心连接自己的兼容模型。</p><button type="button" class="secondary-btn" data-go="account">打开模型设置</button></div>`}
    ` : `<div class="empty-state"><strong>还没有可分配的角色</strong><p>先创建至少一个角色和私人剧本，再组建测试席位。</p><button type="button" class="primary-btn" data-go="writer">创建角色</button></div>`}
  </section>`;
}

function renderHistory() {
  const runs = playtestRuns();
  const current = activeRun();
  return `<aside class="card playtest-history">
    <div class="section-head"><div><p class="section-kicker">RUN HISTORY</p><h3>最近试跑</h3></div><button type="button" class="icon-btn" data-action="ai-playtest-refresh" title="刷新">↻</button></div>
    <div class="playtest-history-list">
      ${runs.length ? runs.slice(0, 8).map((run, index) => {
        const report = reportOf(run);
        return `<button type="button" class="playtest-history-item ${run.id === current?.id ? "active" : ""}"
          data-action="ai-playtest-select-run" data-run-id="${escapeHtml(run.id || String(index))}">
          <span><strong>${escapeHtml(report?.headline || "多 AI 试跑")}</strong><small>${formattedTime(run.createdAt || report?.generatedAt)}</small></span>
          <b>${Number(run.score ?? report?.score) || 0}</b>
        </button>`;
      }).join("") : `<div class="empty-state compact"><p>完成第一轮后，这里会保留可比较的试跑报告。</p></div>`}
    </div>
    <p class="muted-note">报告保存在质量档案中，后续可与真实试跑和版本复盘并列比较。</p>
  </aside>`;
}

function metricCards(report) {
  return Object.entries(METRIC_LABELS).map(([key, label]) => {
    const score = Math.max(0, Math.min(100, Number(report.metrics?.[key]) || 0));
    return `<article class="playtest-metric">
      <span>${escapeHtml(label)}</span><strong>${score}</strong>
      <div><i style="width:${score}%"></i></div>
    </article>`;
  }).join("");
}

function renderGroupTimeline(report) {
  const timeline = report.groupTimeline || [];
  return `<section class="card playtest-group-timeline">
    <div class="section-head"><div><p class="section-kicker">GROUP BELIEF</p><h2>全桌判断如何变化</h2><p>只记录玩家公开表达的判断、分歧和推进状态。</p></div><span class="status-chip neutral">${timeline.length} 个阶段</span></div>
    <div class="playtest-stage-list">
      ${timeline.length ? timeline.map((stage, index) => `<article class="playtest-stage">
        <div class="playtest-stage-index">${String(index + 1).padStart(2, "0")}</div>
        <div>
          <h4>${escapeHtml(stage.stageLabel || `阶段 ${index + 1}`)}</h4>
          <p><b>共识</b>${escapeHtml(stage.consensus || "尚未形成共识")}</p>
          ${stage.split ? `<p><b>分歧</b>${escapeHtml(stage.split)}</p>` : ""}
          ${stage.momentum ? `<small>${escapeHtml(stage.momentum)}</small>` : ""}
        </div>
      </article>`).join("") : `<div class="empty-state">本次模型没有返回分阶段共识；可在“本轮特别关注”中要求细化时间线。</div>`}
    </div>
  </section>`;
}

function issueCard(issue) {
  const severity = SEVERITY_META[issue.severity] || SEVERITY_META.warning;
  return `<article class="playtest-issue ${escapeHtml(issue.severity || "warning")}">
    <span class="playtest-issue-mark">${escapeHtml(severity.mark)}</span>
    <div>
      <div class="playtest-issue-meta">
        <span class="status-chip ${issue.severity === "danger" ? "draft" : issue.severity === "info" ? "neutral" : "testing"}">${escapeHtml(severity.label)}</span>
        <span>${escapeHtml(CATEGORY_LABELS[issue.category] || "体验")}</span>
        ${issue.seatIds?.length ? `<span>${issue.seatIds.length} 个席位</span>` : ""}
      </div>
      <h4>${escapeHtml(issue.title || "待作者复核")}</h4>
      <p>${escapeHtml(issue.detail || "")}</p>
      ${referenceList(issue.refs)}
      ${issue.recommendation ? `<div class="diagnostic-recommendation"><b>改稿建议</b><span>${escapeHtml(issue.recommendation)}</span></div>` : ""}
    </div>
  </article>`;
}

function renderIssues(report) {
  const issues = report.issues || [];
  return `<section class="card playtest-issues">
    <div class="section-head"><div><p class="section-kicker">ACTIONABLE FINDINGS</p><h2>可定位的试跑问题</h2><p>结论必须绑定真实创作对象；点击引用可直接返回编辑器。</p></div><span class="status-chip neutral">${issues.length} 项</span></div>
    <div class="playtest-issue-list">
      ${issues.length ? issues.map(issueCard).join("") : `<div class="diagnostic-clear"><span>✓</span><p>本次试跑没有输出需要定位的结构问题。</p></div>`}
    </div>
  </section>`;
}

function playerTimeline(player) {
  return (player.timeline || []).map((stage) => `<li>
    <span>${escapeHtml(stage.stageLabel || "阶段")}</span>
    <div><strong>${escapeHtml(stage.belief || "尚未形成判断")}</strong>
      <p>${escapeHtml(stage.action || "")}</p>
      ${stage.communication ? `<small>${escapeHtml(stage.communication)}</small>` : ""}
      ${stage.confusion ? `<em>${escapeHtml(stage.confusion)}</em>` : ""}
      ${referenceList([...(stage.evidenceUsed || []), ...(stage.evidenceIgnored || [])])}
    </div>
    <b>${Number(stage.confidence) || 0}%</b>
  </li>`).join("");
}

function playerCard(player, index) {
  return `<details class="playtest-player" ${index === 0 ? "open" : ""}>
    <summary>
      <span class="playtest-player-avatar">${escapeHtml((player.archetypeLabel || "测").slice(0, 1))}</span>
      <span><strong>${escapeHtml(player.role?.label || "未命名角色")}</strong><small>${escapeHtml(player.archetypeLabel || player.archetype || "测试玩家")}</small></span>
      <span class="playtest-player-result">
        ${player.stalledAt ? `<i>卡在 ${escapeHtml(player.stalledAt)}</i>` : "<i>完成主流程</i>"}
        <b>${Number(player.truthConfidence) || 0}%</b>
      </span>
    </summary>
    <div class="playtest-player-body">
      <div class="playtest-player-brief">
        <p><b>目标理解</b>${escapeHtml(player.objectiveUnderstanding || "未记录")}</p>
        <p><b>最终判断</b>${escapeHtml(player.finalBelief || "未形成")}</p>
        <p><b>高光</b>${escapeHtml(player.highlight || "未识别")}</p>
        <p><b>困惑</b>${escapeHtml(player.frustration || "未记录")}</p>
      </div>
      <ol class="playtest-player-timeline">${playerTimeline(player)}</ol>
      <div class="playtest-player-footer">
        <span>主持干预 ${Number(player.hostInterventions) || 0} 次</span>
        ${player.earlySolve ? '<span class="status-chip testing">提前猜中真相</span>' : ""}
        ${referenceList(player.missedRefs || [])}
      </div>
    </div>
  </details>`;
}

function renderPlayers(report) {
  const players = report.players || [];
  return `<section class="playtest-player-section">
    <div class="playtest-section-heading"><div><p class="section-kicker">PLAYER REPLAY</p><h2>逐席位回放</h2></div><p>查看每类玩家何时改变判断、忽略了什么，以及哪里开始卡住。</p></div>
    <div class="playtest-player-list">${players.map(playerCard).join("")}</div>
  </section>`;
}

function renderConstitutionChecks(report) {
  const checks = report.constitutionChecks || [];
  if (!checks.length && !report.constitutionConfigured) {
    return `<section class="playtest-constitution-callout">
      <div><p class="section-kicker">CREATIVE CONSTITUTION</p><h3>这轮试跑没有作者意图基线</h3><p>建立体验承诺与不可破坏原则后，观察员才能判断“玩通了”是否等于“作品达成了目标”。</p></div>
      <button type="button" class="secondary-btn" data-go="constitution">建立创作宪法 →</button>
    </section>`;
  }
  if (!checks.length) return "";
  return `<section class="card playtest-constitution-checks">
    <div class="section-head"><div><p class="section-kicker">CONSTITUTION CHECK</p><h2>作者意图验收</h2></div><button type="button" class="secondary-btn compact" data-go="constitution">查看创作宪法</button></div>
    <div>${checks.map((check) => `<article class="${escapeHtml(check.status)}">
      <span>${check.status === "pass" ? "✓" : check.status === "fail" ? "!" : "?"}</span>
      <div><strong>${escapeHtml(check.principle)}</strong><p>${escapeHtml(check.evidence || "等待更多试跑证据")}</p></div>
    </article>`).join("")}</div>
  </section>`;
}

function renderReport(run) {
  const report = reportOf(run);
  if (!report) {
    return `<section class="playtest-empty-report">
      <span>AI × 4</span>
      <div><p class="section-kicker">READY TO SIMULATE</p><h2>看见玩家会怎样误解，而不只看见他们能看什么</h2>
        <p>选择测试人格后，系统会分别模拟阅读、分享、怀疑、卡关和主持求助，再把问题定位回具体角色、线索与章节。</p></div>
    </section>`;
  }
  const counts = report.summaryCounts || {};
  return `<div class="playtest-report">
    <header class="playtest-report-hero">
      <div>
        <p class="section-kicker">OBSERVER VERDICT · ${escapeHtml(report.depth === "deep" ? "DEEP RUN" : "QUICK RUN")}</p>
        <h1>${escapeHtml(report.headline || "多 AI 玩家试跑已完成")}</h1>
        <p>${escapeHtml(report.summary || "")}</p>
        <div class="playtest-report-meta">
          <span>${counts.players || report.players?.length || 0} 个隔离席位</span>
          <span>${counts.stalledPlayers || 0} 人卡住</span>
          <span>${counts.earlySolves || 0} 人提前猜中</span>
          <span>主持干预 ${Number(report.hostInterventions) || 0} 次</span>
          <span>${formattedTime(run?.createdAt || report.generatedAt)}</span>
        </div>
      </div>
      <div class="playtest-score"><span>体验可信度</span><strong>${Number(report.score) || 0}</strong><small>/ 100</small></div>
    </header>
    <div class="playtest-metric-grid">${metricCards(report)}</div>
    ${renderGroupTimeline(report)}
    ${renderIssues(report)}
    ${renderPlayers(report)}
    ${renderConstitutionChecks(report)}
    <details class="diagnostic-limitations card"><summary>如何解读这份报告</summary>
      <ul>${(report.limitations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </details>
  </div>`;
}

function renderLoading() {
  return `<section class="ai-playtest-page" data-ai-playtest-page>
    <header class="playtest-lab-hero"><div><p class="section-kicker">MULTI-AGENT PLAYTEST</p><h1>AI 玩家试跑实验室</h1><p>正在读取模型状态与历史试跑档案。</p></div></header>
    <div class="diagnostic-loading card"><span></span><h3>准备测试桌</h3><p>正在装载角色、报告和创作宪法。</p></div>
  </section>`;
}

export function aiPlaytestLab() {
  const state = worldStore.get();
  if (state.cloudAiPlaytestLoading && state.cloudAiPlaytestRuns == null) return renderLoading();
  return `<section class="ai-playtest-page" data-ai-playtest-page>
    <header class="playtest-lab-hero">
      <div>
        <p class="section-kicker">MULTI-AGENT PLAYTEST</p>
        <h1>AI 玩家试跑实验室</h1>
        <p>让逻辑型、情感型、沉默型和偏航型玩家分别经历作品，再由观察员把误解、卡点和角色失衡定位回创作对象。</p>
      </div>
      <div class="playtest-lab-hero-actions">
        <button type="button" class="secondary-btn" data-go="diagnostics">查看结构诊断</button>
        <span>独立上下文</span><span>作者真相隔离</span><span>报告可追溯</span>
      </div>
    </header>
    ${state.cloudAiPlaytestError ? `<div class="workspace-inline-error"><strong>试跑暂时不可用</strong><p>${escapeHtml(state.cloudAiPlaytestError)}</p><button type="button" class="secondary-btn" data-action="ai-playtest-refresh">重新载入</button></div>` : ""}
    <div class="playtest-setup-grid">${renderConfiguration()}${renderHistory()}</div>
    ${state.cloudAiPlaytestRunning ? `<section class="playtest-running card"><span></span><div><h2>玩家正在各自推演</h2><p>每个席位先独立阅读和行动；全部完成后，观察员才会读取作者真相并生成综合报告。</p></div></section>` : renderReport(activeRun())}
  </section>`;
}

function collectRunConfig(root) {
  const authoredRoles = roles();
  const checked = [...root.querySelectorAll("[data-playtest-archetype]:checked")];
  if (checked.length < 2) throw new Error("请至少选择两种测试人格");
  if (!authoredRoles.length) throw new Error("请先创建角色");
  return {
    depth: root.querySelector('input[name="playtest-depth"]:checked')?.value || "quick",
    focus: root.querySelector("[data-playtest-focus]")?.value?.trim() || "",
    profiles: checked.slice(0, 8).map((input, index) => {
      const archetype = input.dataset.playtestArchetype;
      const roleSlotId = root.querySelector(`[data-playtest-role="${archetype}"]`)?.value || authoredRoles[index % authoredRoles.length].id;
      return { seatId: `seat-${index + 1}`, roleSlotId, archetype };
    })
  };
}

export async function loadAiPlaytestLab({ quiet = false } = {}) {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return null;
  worldStore.set({ cloudAiPlaytestLoading: true, cloudAiPlaytestError: "" });
  render();
  const [historyResult, statusResult] = await Promise.allSettled([
    zhimuApi.getQualityReports(worldId),
    zhimuApi.getDeepseekStatus()
  ]);
  if (zhimuApi.context.worldId !== worldId) return null;
  const allReports = historyResult.status === "fulfilled" ? historyResult.value?.reports || [] : [];
  const runs = allReports.filter((item) => item.source === "playtest");
  const error = historyResult.status === "rejected"
    ? normalizeError(historyResult.reason, "无法读取试跑历史")
    : "";
  worldStore.set({
    cloudAiPlaytestRuns: runs,
    cloudAiPlaytestActive: runs[0] || null,
    cloudAiPlaytestLlmStatus: statusResult.status === "fulfilled"
      ? statusResult.value
      : { configured: false },
    cloudAiPlaytestDraftConfig: worldStore.get().cloudAiPlaytestDraftConfig || configFromRun(runs[0]),
    cloudAiPlaytestLoading: false,
    cloudAiPlaytestError: error
  });
  render();
  if (error && !quiet) showToast(error);
  return runs;
}

export async function startAiPlaytest() {
  if (worldStore.get().cloudAiPlaytestRunning) return;
  const root = document.querySelector("[data-ai-playtest-page]");
  let config;
  try {
    config = collectRunConfig(root);
  } catch (error) {
    showToast(error.message);
    return;
  }
  const worldId = zhimuApi.context.worldId;
  worldStore.set({
    cloudAiPlaytestRunning: true,
    cloudAiPlaytestError: "",
    cloudAiPlaytestDraftConfig: config
  });
  render();
  try {
    const result = await zhimuApi.runAiPlaytest(config, worldId);
    if (zhimuApi.context.worldId !== worldId) return;
    const run = result?.report;
    const runs = [run, ...playtestRuns().filter((item) => item.id !== run?.id)].filter(Boolean);
    worldStore.set({
      cloudAiPlaytestRuns: runs,
      cloudAiPlaytestActive: run,
      cloudAiPlaytestRunning: false,
      cloudAiPlaytestError: ""
    });
    render();
    showToast(`试跑完成：发现 ${run?.report?.issues?.length || 0} 个可定位问题`);
  } catch (error) {
    if (zhimuApi.context.worldId !== worldId) return;
    const message = normalizeError(error, "AI 玩家试跑失败，请稍后重试");
    worldStore.set({ cloudAiPlaytestRunning: false, cloudAiPlaytestError: message });
    render();
    showToast(message);
  }
}

export function selectAiPlaytestRun(runId) {
  const run = playtestRuns().find((item, index) => String(item.id || index) === String(runId));
  if (!run) return;
  worldStore.set({ cloudAiPlaytestActive: run });
  render();
}

export function openAiPlaytestReference(type, id) {
  openStoryReference(type, id);
}

export function bindAiPlaytestForm() {
  const root = document.querySelector("[data-ai-playtest-page]");
  if (!root || root.dataset.playtestBound === "true") return;
  root.dataset.playtestBound = "true";
  root.addEventListener("change", (event) => {
    const input = event.target.closest("[data-playtest-archetype]");
    if (!input) return;
    input.closest(".playtest-archetype")?.classList.toggle("selected", input.checked);
  });
}

registerView("aiPlaytestLab", {
  aiPlaytestLab,
  loadAiPlaytestLab,
  startAiPlaytest,
  selectAiPlaytestRun,
  openAiPlaytestReference,
  bindAiPlaytestForm
});
