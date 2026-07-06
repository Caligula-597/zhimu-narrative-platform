/* Creator UI for content platform runtime — segments, truth, relationships, analytics panels. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { modal, modalBackdrop } from "../dom.js";
import { render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import { closeModal } from "../components/modal.js";
import { normalizeError } from "../components/status-ui.js";

const escapeHtml = F.escapeHtml || ((v = "") => String(v));
const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));

function roleOptions(roles = []) {
  return roles.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
}

export async function loadCreatorAnalytics() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  try {
    const data = await zhimuApi.getCreatorAnalytics(worldId);
    worldStore.set({ cloudCreatorAnalytics: data });
    render();
    showToast("玩后洞察已刷新");
  } catch (error) {
    showError(error);
  }
}

export async function loadQualityReports() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  try {
    const data = await zhimuApi.getQualityReports(worldId);
    worldStore.set({ cloudQualityReports: data?.reports || [] });
    render();
    showToast("质量报告已刷新");
  } catch (error) {
    showError(error);
  }
}

export function renderCreatorAnalyticsPanel() {
  const data = worldStore.get().cloudCreatorAnalytics;
  if (!data) {
    return `<section class="creator-analytics-panel">
      <div class="section-head">
        <div><p class="section-kicker">PLAYTEST INSIGHTS</p><h3>玩后洞察</h3><p>分幕完成、线索获取与满意度反馈聚合，辅助定位卡关与冷门线索。</p></div>
        <button class="secondary-btn" data-action="load-creator-analytics">加载洞察</button>
      </div>
      <div class="empty-state">点击「加载洞察」从运行数据生成建议。</div>
    </section>`;
  }
  const suggestions = (data.suggestions || []).slice(0, 8);
  const suggestionRows = suggestions.length
    ? suggestions.map((s) => `<div class="insight-row ${s.severity === "high" ? "risk-error" : "risk-warning"}"><strong>${escapeHtml(s.title)}</strong><p>${escapeHtml(s.detail || "")}</p></div>`).join("")
    : `<div class="empty-state">暂无自动建议，说明当前分幕与线索获取较均衡。</div>`;
  const feedbackRows = (data.feedback || []).length
    ? data.feedback.map((f) => `<span class="status-chip">${escapeHtml(f.kind)} · ${escapeHtml(f.status)} × ${f.count}</span>`).join(" ")
    : `<span class="muted-note">尚无满意度/反馈记录</span>`;
  return `<section class="creator-analytics-panel">
    <div class="section-head">
      <div><p class="section-kicker">PLAYTEST INSIGHTS</p><h3>玩后洞察</h3><p>基于全剧本运行房聚合；选中单个运行房时段落完成率见上方卡片。</p></div>
      <button class="secondary-btn" data-action="load-creator-analytics">刷新</button>
    </div>
    <div class="insight-feedback-row">${feedbackRows}</div>
    <div class="insight-list">${suggestionRows}</div>
  </section>`;
}

export function renderQualityReportsPanel() {
  const reports = worldStore.get().cloudQualityReports;
  if (!reports) {
    return `<section class="quality-reports-panel">
      <div class="section-head">
        <div><p class="section-kicker">QUALITY REPORTS</p><h3>质量报告</h3><p>Matrix 评判、发布就绪检查或人工 QA 的结构化报告存档。</p></div>
        <button class="secondary-btn" data-action="load-quality-reports">加载报告</button>
      </div>
      <div class="empty-state">点击「加载报告」查看最近 50 条质量报告。</div>
    </section>`;
  }
  const rows = reports.length
    ? reports.map((r) => {
        const score = r.score != null ? `${Math.round(Number(r.score))} 分` : "—";
        return `<article class="quality-report-row"><div class="quality-report-head"><strong>${escapeHtml(r.source)}</strong><span class="status-chip">${score}</span><span class="muted-note">${escapeHtml(r.createdAt ? new Date(r.createdAt).toLocaleString("zh-CN") : "")}</span></div><p class="muted-note">${r.issueCount ?? 0} 项问题 · ${escapeHtml(r.promptVersion || "无版本号")}</p></article>`;
      }).join("")
    : `<div class="empty-state">尚无质量报告。Matrix 评判或手动 QA 后可在此存档。</div>`;
  return `<section class="quality-reports-panel">
    <div class="section-head">
      <div><p class="section-kicker">QUALITY REPORTS</p><h3>质量报告</h3><p>Matrix 评判、发布就绪检查或人工 QA 的结构化报告存档。</p></div>
      <div class="row"><button class="secondary-btn" data-action="record-quality-report">记录快照</button><button class="secondary-btn" data-action="load-quality-reports">刷新</button></div>
    </div>
    <div class="quality-report-list">${rows}</div>
  </section>`;
}

export async function recordQualityReportSnapshot() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  try {
    const checks = await zhimuApi.getCreatorChecks();
    const issues = (checks || []).filter((c) => c.level === "error" || c.level === "warning");
    await zhimuApi.createQualityReport({
      source: "publish_readiness",
      report: { issues, capturedAt: new Date().toISOString() },
      issueCount: issues.length,
      score: issues.length ? Math.max(0, 100 - issues.length * 8) : 100
    }, worldId);
    await loadQualityReports();
    showToast("已存档当前发布检查结果");
  } catch (error) {
    showError(error);
  }
}

export async function openWorldSegmentsModal() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  const draw = async () => {
    const payload = await zhimuApi.getWorldSegments(worldId);
    const items = payload?.segments || [];
    const list = items.length
      ? items.map((s) => `<article class="checkpoint-row"><strong>${escapeHtml(s.segmentKey)} · ${escapeHtml(s.title)}</strong><p class="muted-note">顺序 ${s.sequence}${s.chapterId ? " · 已绑章节" : ""}</p></article>`).join("")
      : `<div class="empty-state">尚无运行态段落。可下方添加，或与 Matrix 编译链对接。</div>`;
    modal.querySelector("[data-segment-list]").innerHTML = list;
  };
  try {
    modal.className = "modal world-segments-modal";
    modal.innerHTML = `<h2>运行态段落</h2><p class="wizard-intro">Segment 是章节/分幕/任务的聚合层，不替换 script_sections。</p><div class="host-detail-list" data-segment-list><div class="empty-state">正在加载…</div></div><div class="form-group" style="margin-top:14px;border-top:1px solid var(--line,#ece7df);padding-top:14px"><label>新增段落</label><input class="field" data-seg-field="segmentKey" placeholder="键 ch1"><input class="field" data-seg-field="title" placeholder="标题"><input class="field" data-seg-field="sequence" type="number" min="1" value="1" placeholder="顺序"></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-add-segment>添加</button></div>`;
    modalBackdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-add-segment]").onclick = async () => {
      const val = (k) => modal.querySelector(`[data-seg-field="${k}"]`)?.value?.trim() || "";
      const segmentKey = val("segmentKey");
      const title = val("title");
      const sequence = Number(val("sequence") || "1");
      if (!segmentKey || !title) return showToast("请填写段落键与标题");
      try {
        await zhimuApi.createWorldSegment({ segmentKey, title, sequence }, worldId);
        showToast("段落已添加");
        await draw();
      } catch (error) {
        showError(error);
      }
    };
    await draw();
  } catch (error) {
    showError(error);
  }
}

export async function openTruthClaimsModal() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  const draw = async () => {
    const payload = await zhimuApi.getTruthClaims(worldId);
    const items = payload?.claims || payload?.truthClaims || [];
    const list = items.length
      ? items.map((c) => `<article class="checkpoint-row"><strong>${escapeHtml(c.title)}</strong><span class="status-chip">${escapeHtml(c.confidence || "canon")}</span><p>${escapeHtml((c.claim || "").slice(0, 160))}${(c.claim || "").length > 160 ? "…" : ""}</p></article>`).join("")
      : `<div class="empty-state">尚无真相断言。添加后可对接复盘与 QA。</div>`;
    modal.querySelector("[data-claim-list]").innerHTML = list;
  };
  try {
    modal.className = "modal truth-claims-modal";
    modal.innerHTML = `<h2>真相链</h2><p class="wizard-intro">结构化真相断言，供 QA 与局后复盘引用（非玩家可见剧本文本）。</p><div class="host-detail-list" data-claim-list><div class="empty-state">正在加载…</div></div><div class="form-group" style="margin-top:14px;border-top:1px solid var(--line,#ece7df);padding-top:14px"><label>新增断言</label><input class="field" data-claim-field="title" placeholder="标题"><textarea class="field" data-claim-field="claim" rows="3" placeholder="断言内容"></textarea><select class="field" data-claim-field="confidence"><option value="canon">canon</option><option value="inferred">inferred</option><option value="misdirection">misdirection</option><option value="unknown">unknown</option></select></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-add-claim>添加</button></div>`;
    modalBackdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-add-claim]").onclick = async () => {
      const val = (k) => modal.querySelector(`[data-claim-field="${k}"]`)?.value?.trim() || "";
      const title = val("title");
      const claim = val("claim");
      if (!title || !claim) return showToast("请填写标题与断言");
      try {
        await zhimuApi.createTruthClaim({ title, claim, confidence: val("confidence") || "canon" }, worldId);
        showToast("断言已添加");
        await draw();
      } catch (error) {
        showError(error);
      }
    };
    await draw();
  } catch (error) {
    showError(error);
  }
}

function renderRelationshipGraph(roles, relationships) {
  if (!roles.length) return `<div class="empty-state">请先创建角色席位。</div>`;
  const n = roles.length;
  const nodes = roles.map((role, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(angle) * 38;
    const y = 50 + Math.sin(angle) * 38;
    return { role, x, y };
  });
  const byId = new Map(nodes.map((n) => [n.role.id, n]));
  const edges = (relationships || []).map((rel) => {
    const from = byId.get(rel.from_role_slot_id || rel.fromRoleSlotId);
    const to = byId.get(rel.to_role_slot_id || rel.toRoleSlotId);
    if (!from || !to) return "";
    const label = rel.label || rel.relation_type || rel.relationType || "";
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    return `<line class="rel-edge" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" /><text class="rel-label" x="${mx}" y="${my}" text-anchor="middle">${escapeHtml(label)}</text>`;
  }).join("");
  const nodeMarkup = nodes.map(({ role, x, y }) => `<g class="rel-node"><circle cx="${x}" cy="${y}" r="5.5" /><text x="${x}" y="${y + 9}" text-anchor="middle">${escapeHtml(role.name.slice(0, 4))}</text></g>`).join("");
  return `<svg class="relationship-graph" viewBox="0 0 100 100" aria-label="角色关系图">${edges}${nodeMarkup}</svg>`;
}

export async function openRoleRelationshipsModal() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  const roles = studioStore.get().cloudStudio?.roles || [];
  const draw = async () => {
    const payload = await zhimuApi.getRoleRelationships(worldId);
    const items = payload?.relationships || [];
    modal.querySelector("[data-rel-graph]").innerHTML = renderRelationshipGraph(roles, items);
    const list = items.length
      ? items.map((r) => `<article class="checkpoint-row"><strong>${escapeHtml(r.label || r.relation_type || "关系")}</strong><p class="muted-note">${escapeHtml(r.from_role_name || r.fromRoleSlotId || "")} → ${escapeHtml(r.to_role_name || r.toRoleSlotId || "")}${r.strength != null ? ` · 强度 ${r.strength}` : ""}</p></article>`).join("")
      : `<div class="empty-state">尚无关系边。可在下方添加。</div>`;
    modal.querySelector("[data-rel-list]").innerHTML = list;
  };
  try {
    modal.className = "modal role-relationships-modal";
    modal.innerHTML = `<h2>角色关系图</h2><p class="wizard-intro">主持 runbook 与 QA 用的结构化关系数据（非编排台连线）。</p><div class="rel-graph-wrap" data-rel-graph></div><div class="host-detail-list" data-rel-list style="margin-top:12px"><div class="empty-state">正在加载…</div></div><div class="form-group" style="margin-top:14px;border-top:1px solid var(--line,#ece7df);padding-top:14px"><label>新增关系</label><select class="field" data-rel-field="from">${roleOptions(roles)}</select><select class="field" data-rel-field="to">${roleOptions(roles)}</select><input class="field" data-rel-field="label" placeholder="关系标签，如 师生/仇敌"><input class="field" data-rel-field="strength" type="number" min="-10" max="10" placeholder="强度 -10～10（选填）"></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-add-rel>添加</button></div>`;
    modalBackdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-add-rel]").onclick = async () => {
      const from = modal.querySelector('[data-rel-field="from"]')?.value;
      const to = modal.querySelector('[data-rel-field="to"]')?.value;
      const label = modal.querySelector('[data-rel-field="label"]')?.value?.trim() || "";
      const strengthRaw = modal.querySelector('[data-rel-field="strength"]')?.value;
      if (!from || !to || from === to) return showToast("请选择两个不同角色");
      try {
        await zhimuApi.createRoleRelationship({
          fromRoleSlotId: from,
          toRoleSlotId: to,
          label,
          strength: strengthRaw === "" ? undefined : Number(strengthRaw)
        }, worldId);
        showToast("关系已添加");
        await draw();
      } catch (error) {
        showError(error);
      }
    };
    await draw();
  } catch (error) {
    showError(error);
  }
}

export const platformRuntimeViewApi = {
  loadCreatorAnalytics,
  loadQualityReports,
  recordQualityReportSnapshot,
  renderCreatorAnalyticsPanel,
  renderQualityReportsPanel,
  openWorldSegmentsModal,
  openTruthClaimsModal,
  openRoleRelationshipsModal
};

registerView("platformRuntime", platformRuntimeViewApi);
