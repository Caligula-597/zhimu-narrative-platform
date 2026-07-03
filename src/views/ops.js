/** Internal operations console. */
import * as api from "../api/index.js";
import { showToast } from "../components/toast.js";
import { registerView } from "../runtime/view-registry.js";
import { uiStore } from "../state/index.js";
import * as F from "../utils/format.js";
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || ((v) => v || "");

  function featureStatus(features = {}) {
    const rows = [
      ["Email", features.email?.configured],
      ["OAuth", features.oauth?.enabledProviders?.length],
      ["Stripe", features.stripe?.configured],
      ["Upload scan", features.uploadScan?.enabled],
      ["Telemetry", features.telemetry?.enabled],
      ["Alerts", features.alerts?.configured],
      ["Room events", features.roomEventsBus]
    ];
    return rows.map(([label, value]) => `<div class="check-result ${value ? "ok" : "warn"}"><b>${escapeHtml(label)}</b><span>${escapeHtml(value === true ? "已启用" : value || "未配置")}</span></div>`).join("");
  }

  function upgradeRows(items = []) {
    return items.map((item) => `<div class="checkpoint-row"><strong>${escapeHtml(item.email || item.user_email || "未知用户")} · ${escapeHtml(item.requested_plan_code || item.plan_code || "")}</strong><p>${escapeHtml(item.status || "pending")} · ${formatTime(item.created_at)}</p></div>`).join("") || `<div class="empty-state">暂无待处理套餐申请。</div>`;
  }

  function auditRows(items = []) {
    return items.map((item) => `<div class="checkpoint-row"><strong>${escapeHtml(item.action || "")}</strong><p>${escapeHtml(item.room_id || "")} · ${escapeHtml(item.actor_name || item.actor_user_id || "")} · ${formatTime(item.created_at)}</p></div>`).join("") || `<div class="empty-state">暂无审计记录。</div>`;
  }

  function safeFeedbackUrl(value = "") {
    const url = String(value || "").trim();
    if (!url) return "";
    return /^(https?:\/\/|\/)/i.test(url) ? url : "";
  }

  function feedbackRows(items = []) {
    const label = { feedback: "反馈", bug: "Bug", feature: "建议" };
    const nextAction = { new: ["seen", "标记已看"], seen: ["resolved", "标记解决"], resolved: ["new", "重新打开"] };
    const statusLabel = { new: "待看", seen: "已看", resolved: "已解决" };
    const statusTone = { new: "testing", seen: "draft", resolved: "published" };
    return items.map((item) => {
      const [status, button] = nextAction[item.status] || nextAction.new;
      const reporter = item.user_email || item.user_name || "匿名用户";
      const pageUrl = safeFeedbackUrl(item.page_url);
      return `<div class="checkpoint-row feedback-row">
        <div class="feedback-row-head"><strong>${escapeHtml(label[item.kind] || item.kind || "反馈")} · ${escapeHtml(item.subject || "")}</strong><span class="status-chip ${escapeHtml(statusTone[item.status] || "draft")}">${escapeHtml(statusLabel[item.status] || item.status || "待看")}</span></div>
        <p>${escapeHtml(reporter)} · ${formatTime(item.created_at)}</p>
        <p class="feedback-row-body">${escapeHtml(item.body || "")}</p>
        ${pageUrl ? `<p class="muted-note feedback-row-url"><a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pageUrl)}</a></p>` : ""}
        <div class="row"><button class="secondary-btn" data-action="ops-feedback-status" data-feedback-id="${escapeHtml(item.id)}" data-feedback-status="${escapeHtml(status)}" aria-label="${escapeHtml(button)}：${escapeHtml(item.subject || "用户反馈")}">${escapeHtml(button)}</button></div>
      </div>`;
    }).join("") || `<div class="empty-state">暂无待处理反馈。</div>`;
  }

  function trustGates(trust) {
    const gates = trust?.gates || [];
    return gates.map((gate) => `<div class="check-result ${gate.ok ? "ok" : "warn"}"><b>${escapeHtml(gate.label)}</b><span>${escapeHtml(gate.detail || "")}</span></div>`).join("") || `<div class="empty-state">暂无生产可信门禁数据。</div>`;
  }

export function ops() {
    if (!api.hasOpsToken?.()) {
      return `<section class="rules-layout"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><p class="section-kicker">OPS</p><h3>运营控制台</h3><p>输入内部 Ops Token 后查看生产状态、审计日志与套餐申请。</p></div></div><div class="form-group"><label>Ops Token</label><input class="field" type="password" data-ops-token placeholder="OPS_API_TOKEN"><button class="primary-btn" style="margin-top:12px" data-action="ops-save-token">进入 OPS</button></div></article></section>`;
    }
    const ui = uiStore.get();
    const status = ui.opsStatus;
    const upgrades = ui.opsPlanRequests?.items || ui.opsPlanRequests?.requests || [];
    const audit = ui.opsAuditLog?.items || [];
    const feedback = ui.opsFeedback?.items || [];
    const feedbackTotal = ui.opsFeedback?.total ?? feedback.length;
    const feedbackStats = ui.opsFeedbackStats || [];
    const feedbackNewCount = feedbackStats.find((row) => row.status === "new")?.count ?? feedback.filter((item) => item.status === "new").length;
    return `<section class="rules-layout ops-page"><article class="card" style="grid-column:1/-1"><div class="section-head"><div><p class="section-kicker">OPS</p><h3>运营控制台</h3><p>${status ? `环境 ${escapeHtml(status.nodeEnv)} · uptime ${escapeHtml(status.uptimeSeconds)}s` : "读取内部运营状态。"}</p></div><div class="row"><button class="secondary-btn" data-action="ops-refresh">刷新</button><button class="secondary-btn" data-action="ops-test-alert">测试告警</button><button class="text-btn" data-action="ops-clear-token">退出</button></div></div></article>
    <article class="card"><div class="section-head"><div><h3>生产状态</h3><p>数据库、SSE、特性配置。</p></div><span class="status-chip ${status?.ok ? "published" : "draft"}">${status?.ok ? "READY" : "CHECK"}</span></div>${status ? featureStatus(status.features) : `<div class="empty-state">点击刷新读取状态。</div>`}</article>
    <article class="card"><div class="section-head"><div><h3>生产可信七项</h3><p>当前 ${status?.productionTrust?.passed ?? 0} / ${status?.productionTrust?.total ?? 7} 项通过。</p></div><span class="status-chip ${status?.productionTrust?.ready ? "published" : "testing"}">${status?.productionTrust?.ready ? "TRUSTED" : "ACTION"}</span></div>${trustGates(status?.productionTrust)}</article>
    <article class="card ops-feedback-card"><div class="section-head"><div><h3>用户反馈</h3><p>${feedbackTotal} 条记录 · ${feedbackNewCount} 条待看 · 显示最近 20 条。</p></div><span class="status-chip ${feedbackNewCount ? "testing" : "published"}">${feedbackNewCount ? "ACTION" : "CLEAR"}</span></div><div class="host-detail-list">${feedbackRows(feedback)}</div></article>
    <article class="card"><div class="section-head"><div><h3>套餐申请</h3><p>待人工确认的升级请求。</p></div></div><div class="host-detail-list">${upgradeRows(upgrades)}</div><div class="form-group" style="margin-top:12px"><label>手动分配套餐</label><input class="field" data-ops-plan-email placeholder="用户邮箱"><select class="field" data-ops-plan-code><option value="creator">creator</option><option value="studio">studio</option><option value="beta">beta</option><option value="free">free</option></select><button class="primary-btn" data-action="ops-assign-plan">保存套餐</button></div></article>
    <article class="card" style="grid-column:1/-1"><div class="section-head"><div><h3>审计流</h3><p>最近主持敏感操作与后台行为。</p></div></div><div class="host-detail-list">${auditRows(audit)}</div></article></section>`;
  }

export async function loadOpsData() {
    const [status, plans, audit, feedback, feedbackStats] = await Promise.all([
      api.getOpsStatus(),
      api.getOpsPlanUpgradeRequests({ status: "pending", limit: 20 }),
      api.getOpsAuditLog({ limit: 50 }),
      api.getOpsFeedback({ limit: 20 }),
      api.getOpsFeedbackStats()
    ]);
    uiStore.set({ opsStatus: status, opsPlanRequests: plans, opsAuditLog: audit, opsFeedback: feedback, opsFeedbackStats: feedbackStats });
  }

export const opsViewApi = { ops, loadOpsData };
registerView("ops", opsViewApi);
