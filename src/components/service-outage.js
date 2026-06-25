/** Full-page service outage UI when API is unreachable. */
(function (window) {
  function isServiceOutage(apiError) {
    if (!apiError) return false;
    return /无法连接|API_UNAVAILABLE|ECONNREFUSED|Failed to fetch|请求超时|502|503|504|UNAVAILABLE/i.test(apiError);
  }

  function renderServiceOutage(apiError) {
    if (!isServiceOutage(apiError)) return "";
    const detail = window.zhimuUserMessages?.formatCloudPanelError?.(apiError, { hasStudio: false }) || apiError;
    const actions = `<button class="primary-btn" data-action="refresh-cloud">重新连接</button><button class="secondary-btn" data-action="open-error-guide">错误排查手册</button><a class="text-btn" href="/errors/offline.html" target="_blank" rel="noopener">打开离线说明页</a>`;
    const body = window.zhimuStatus?.renderState?.({
      tone: "error",
      kicker: "503",
      title: "暂时无法连接云端",
      message: detail,
      details: ["确认后端 /api/health 返回 200", "部署环境请查看 /api/health/ready", "本地开发：4180 后端 + 4173 前端"],
      actions
    }) || "";
    return `<section class="service-outage-page"><article class="service-outage-card">${body}</article></section>`;
  }

  window.zhimuServiceOutage = { isServiceOutage, renderServiceOutage };
})(window);
export {};
