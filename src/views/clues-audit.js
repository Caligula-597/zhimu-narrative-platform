import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as S from "../components/ui-semantics.js";

const escapeHtml = F.escapeHtml || ((value = "") => String(value));
const showError = S.showError;

let refreshSeq = 0;

export async function refreshClueAudit({ silent = false, withToast = false } = {}) {
  if (!zhimuApi.context.worldId) return;
  const seq = ++refreshSeq;
  worldStore.set({ cloudClueAuditLoading: true, cloudClueAuditError: "" });
  if (!silent) render();
  try {
    const audit = await zhimuApi.getClueAudit();
    if (seq !== refreshSeq) return;
    worldStore.set({
      cloudClueAudit: audit,
      cloudClueAuditLoading: false,
      cloudClueAuditError: ""
    });
    if (withToast) showToast("线索审稿报告已刷新");
    if (!silent) render();
  } catch (error) {
    if (seq !== refreshSeq) return;
    worldStore.set({
      cloudClueAuditLoading: false,
      cloudClueAuditError: error?.message || "线索审稿报告加载失败"
    });
    if (!silent) {
      showError(error);
      render();
    }
  }
}

export function renderClueAuditPanel() {
  const { cloudClueAudit: audit, cloudClueAuditLoading, cloudClueAuditError } = worldStore.get();
  if (!audit && cloudClueAuditLoading) {
    return `<section class="clue-audit-report">
      <div class="section-head"><div><p class="section-kicker">CLUE AUDIT</p><h3>线索审稿报告</h3><p>正在从服务端加载完整审稿结果…</p></div></div>
      <div class="empty-state">加载中…</div>
    </section>`;
  }
  if (!audit) {
    return `<section class="clue-audit-report">
      <div class="section-head">
        <div><p class="section-kicker">CLUE AUDIT</p><h3>线索审稿报告</h3><p>正文、调查关联、触发条件与关键线索标记，由服务端统一规则计算。</p></div>
        <button type="button" class="secondary-btn" data-action="load-clue-audit">加载审稿报告</button>
      </div>
      <div class="empty-state">${cloudClueAuditError ? escapeHtml(cloudClueAuditError) : "点击「加载审稿报告」从云端拉取当前世界的线索完整度检查。"}</div>
    </section>`;
  }
  const score = audit.score ?? 0;
  const cards = audit.cards || [];
  const issues = audit.issues || [];
  const issueRows = issues.length
    ? issues.map((issue) => `<div class="clue-audit-issue ${escapeHtml(issue.tone || "warn")}"><b>${escapeHtml(issue.title || "")}</b><p>${escapeHtml(issue.detail || "")}</p></div>`).join("")
    : `<div class="clue-audit-issue ok"><b>当前列表无明显审稿问题</b><p>可以进入编排图谱检查章节节奏和真实依赖关系。</p></div>`;
  return `<section class="clue-audit-report">
    <div class="section-head">
      <div><p class="section-kicker">CLUE AUDIT</p><h3>线索审稿报告</h3><p>共 ${audit.total ?? 0} 条线索 · 服务端规则与系统检查一致。</p></div>
      <div class="row">
        <div class="clue-audit-score"><strong>${score}%</strong><span>审稿完整度</span></div>
        <button type="button" class="secondary-btn" data-action="load-clue-audit"${cloudClueAuditLoading ? " disabled" : ""}>${cloudClueAuditLoading ? "刷新中…" : "刷新"}</button>
      </div>
    </div>
    <div class="clue-audit-grid">${cards.map((card) => `<article class="${card.ok ? "ok" : "warn"}"><span>${escapeHtml(card.icon || "")}</span><div><strong>${escapeHtml(card.label || "")}</strong><p>${escapeHtml(card.value || "")}</p></div><i>${card.ok ? "✓" : "!"}</i></article>`).join("")}</div>
    <div class="clue-audit-issues">${issueRows}</div>
  </section>`;
}
