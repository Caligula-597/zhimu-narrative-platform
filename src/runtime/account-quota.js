/** Account quota display — shared by auth modal and account settings page. */
(function (window) {
  const F = window.zhimuFormat || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatBytes = F.formatBytes || (() => "");

  function renderPlanComparison(publicPlans, currentPlanCode) {
    if (!publicPlans?.length) return "";
    const rows = publicPlans
      .map((plan) => {
        const isCurrent = plan.code === currentPlanCode;
        const limits = plan.limits || {};
        return `<tr class="${isCurrent ? "plan-row-current" : ""}">
          <td><strong>${escapeHtml(plan.label)}</strong>${isCurrent ? ` <span class="cloud-pill">当前</span>` : ""}<br><span class="muted-note">${escapeHtml(plan.description || "")}</span></td>
          <td>${limits.maxWorlds ?? "—"} 个</td>
          <td>${formatBytes(limits.maxBytes || 0)}</td>
          <td>${formatBytes(limits.maxSingleFileBytes || 0)}</td>
        </tr>`;
      })
      .join("");
    return `<div class="plan-compare-wrap"><table class="plan-compare"><thead><tr><th>档位</th><th>剧本数</th><th>云存储</th><th>单文件</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderUpgradeActions(upgrade, currentPlanCode) {
    if (!upgrade) return "";
    const support = escapeHtml(upgrade.supportEmail || "support@getzhimu.com");
    if (upgrade.pending) {
      const desired = upgrade.pending.desiredPlanCode || "";
      return `<div class="demo-strip" style="margin-top:14px"><div><span class="cloud-pill">审核中</span><strong>升级申请已提交</strong><p>目标档位：<code>${escapeHtml(desired)}</code>。我们将在 1～3 个工作日内邮件回复；处理邮箱 ${support}。</p></div></div>`;
    }
    if (!upgrade.canRequest || !upgrade.availableTargets?.length) {
      if (currentPlanCode === "beta") {
        return `<p class="muted-note" style="margin-top:12px">你当前为<strong>内测账号</strong>，已享有提升配额。如需进一步调整请联系 ${support}。</p>`;
      }
      if (currentPlanCode === "studio") {
        return `<p class="muted-note" style="margin-top:12px">你当前为<strong>工作室</strong>档位。如需定制配额请联系 ${support}。</p>`;
      }
      return "";
    }
    const buttons = upgrade.availableTargets
      .map(
        (plan) =>
          `<button type="button" class="secondary-btn" data-plan-upgrade="${escapeHtml(plan.code)}">申请 ${escapeHtml(plan.label)}</button>`
      )
      .join("");
    return `<div class="plan-upgrade-actions" style="margin-top:14px"><p class="muted-note">${escapeHtml(upgrade.note || "")}</p><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">${buttons}</div></div>`;
  }

  function renderQuotaSection(usage, entitlements) {
    if (!usage) {
      return `<section class="form-group"><h3>套餐与配额</h3><p class="muted-note">配额信息加载中…</p></section>`;
    }
    const upgrade = entitlements?.upgrade;
    const publicPlans = entitlements?.publicPlans;
    const storagePct = usage.storagePercent ?? (usage.maxBytes ? Math.min(100, Math.round((usage.usedBytes || 0) / usage.maxBytes * 100)) : 0);
    const worldsPct = usage.worldsPercent ?? (usage.maxWorlds ? Math.min(100, Math.round((usage.usedWorlds || 0) / usage.maxWorlds * 100)) : 0);
    const betaNote = usage.isInternalBeta ? `<span class="cloud-pill" style="margin-left:6px">内测</span>` : "";
    const policyNote = `<p class="muted-note" style="margin-top:12px">暂无在线支付。配额不足可<strong>申请升级</strong>，由 ${escapeHtml(upgrade?.supportEmail || "support@getzhimu.com")} 人工审核开通。</p>`;
    return `<section class="form-group account-quota-section"><h3>套餐与配额</h3><div class="row" style="align-items:center;gap:8px;margin-bottom:10px"><span class="cloud-pill">${escapeHtml(usage.planLabel || usage.planCode || "免费版")}</span>${betaNote}</div>${usage.planDescription ? `<p class="muted-note" style="margin-bottom:10px">${escapeHtml(usage.planDescription)}</p>` : ""}<p class="muted-note" style="margin-bottom:6px">云存储 · ${formatBytes(usage.usedBytes || 0)} / ${formatBytes(usage.maxBytes || 0)}</p><div class="usage-bar"><i style="width:${storagePct}%"></i></div><div class="status-meta"><span>已用 ${storagePct}%</span><span>剩余 ${formatBytes(usage.remainingBytes ?? 0)}</span></div><p class="muted-note" style="margin-top:14px;margin-bottom:6px">可创建剧本 · ${usage.usedWorlds ?? 0} / ${usage.maxWorlds ?? 0}</p><div class="usage-bar"><i style="width:${worldsPct}%"></i></div><div class="status-meta"><span>已用 ${worldsPct}%</span><span>剩余 ${usage.remainingWorlds ?? 0} 个</span></div><p class="muted-note" style="margin-top:10px">单文件上限 ${formatBytes(usage.maxSingleFileBytes || 0)}</p>${renderPlanComparison(publicPlans, usage.planCode)}${renderUpgradeActions(upgrade, usage.planCode)}${policyNote}</section>`;
  }

  window.zhimuAccountQuota = { renderQuotaSection };
})(window);
export {};
