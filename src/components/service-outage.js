/** Full-page service outage UI when API is unreachable. */
import { renderState } from "./status-ui.js";
import { formatCloudPanelError } from "../utils/user-messages.js";
import { escapeHtml } from "../../shared/security.js";
(function (window) {
  function isServiceOutage(apiError) {
    if (!apiError) return false;
    return /无法连接|响应格式异常|API_UNAVAILABLE|INVALID_API_RESPONSE|ECONNREFUSED|Failed to fetch|请求超时|502|503|504|UNAVAILABLE/i.test(apiError);
  }

  function renderServiceOutage(apiError) {
    if (!isServiceOutage(apiError)) return "";
    const detail = formatCloudPanelError(apiError, { hasStudio: false }) || apiError;
    const reportBody = `无法连接云端。\n错误信息：${apiError || "未知错误"}\n页面：${window.location.href}\n\n请补充你当时在做什么：`;
    const actions = `<button class="primary-btn" data-action="refresh-cloud">重新连接</button><button class="secondary-btn" data-action="open-error-guide">错误排查手册</button><button class="secondary-btn" data-action="report-issue" data-report-subject="云端连接故障" data-report-body="${escapeHtml(reportBody)}">上报故障</button><a class="text-btn" href="/errors/offline.html" target="_blank" rel="noopener">打开离线说明页</a>`;
    const body = renderState({
      tone: "error",
      kicker: "503",
      title: "暂时无法连接云端",
      message: detail,
      details: ["确认后端 /api/health 返回 200", "部署环境请查看 /api/health/ready", "本地开发：4180 后端 + 4173 前端"],
      actions
    });
    return `<section class="service-outage-page"><article class="service-outage-card">${body}</article></section>`;
  }

  function renderScopedOutageBanner(apiError) {
    if (!isServiceOutage(apiError)) return "";
    const detail = formatCloudPanelError(apiError, { hasStudio: false }) || apiError;
    return `<section class="service-outage-banner card" role="alert">
      <p class="section-kicker">SERVICE STATUS</p>
      <strong>云端连接异常</strong>
      <p class="muted-note">${escapeHtml(detail)}</p>
      <div class="row" style="margin-top:10px">
        <button class="secondary-btn" type="button" data-action="refresh-cloud">重新连接</button>
        <button class="secondary-btn" type="button" data-action="open-error-guide">错误排查手册</button>
      </div>
    </section>`;
  }

  window.zhimuServiceOutage = { isServiceOutage, renderServiceOutage, renderScopedOutageBanner };
})(window);
export {};
