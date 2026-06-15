/** Account quota display — shared by auth modal and account settings page. */
(function (window) {
  const F = window.zhimuFormat || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatBytes = F.formatBytes || (() => "");

  function renderQuotaSection(usage) {
    if (!usage) {
      return `<section class="form-group"><h3>套餐与配额</h3><p class="muted-note">配额信息加载中…</p></section>`;
    }
    const storagePct = usage.storagePercent ?? (usage.maxBytes ? Math.min(100, Math.round((usage.usedBytes || 0) / usage.maxBytes * 100)) : 0);
    const worldsPct = usage.worldsPercent ?? (usage.maxWorlds ? Math.min(100, Math.round((usage.usedWorlds || 0) / usage.maxWorlds * 100)) : 0);
    const betaNote = usage.isInternalBeta ? `<span class="cloud-pill" style="margin-left:6px">内测</span>` : "";
    const betaFreeNote = `<p class="muted-note" style="margin-top:12px">内测期间免费使用，暂无订阅或充值入口。配额不足请联系 <a href="mailto:support@getzhimu.com">support@getzhimu.com</a>。</p>`;
    return `<section class="form-group"><h3>套餐与配额</h3><div class="row" style="align-items:center;gap:8px;margin-bottom:10px"><span class="cloud-pill">${escapeHtml(usage.planLabel || usage.planCode || "免费版")}</span>${betaNote}</div>${usage.planDescription ? `<p class="muted-note" style="margin-bottom:10px">${escapeHtml(usage.planDescription)}</p>` : ""}<p class="muted-note" style="margin-bottom:6px">云存储 · ${formatBytes(usage.usedBytes || 0)} / ${formatBytes(usage.maxBytes || 0)}</p><div class="usage-bar"><i style="width:${storagePct}%"></i></div><div class="status-meta"><span>已用 ${storagePct}%</span><span>剩余 ${formatBytes(usage.remainingBytes ?? 0)}</span></div><p class="muted-note" style="margin-top:14px;margin-bottom:6px">可创建剧本 · ${usage.usedWorlds ?? 0} / ${usage.maxWorlds ?? 0}</p><div class="usage-bar"><i style="width:${worldsPct}%"></i></div><div class="status-meta"><span>已用 ${worldsPct}%</span><span>剩余 ${usage.remainingWorlds ?? 0} 个</span></div><p class="muted-note" style="margin-top:10px">单文件上限 ${formatBytes(usage.maxSingleFileBytes || 0)}</p>${betaFreeNote}</section>`;
  }

  window.zhimuAccountQuota = { renderQuotaSection };
})(window);
export {};
