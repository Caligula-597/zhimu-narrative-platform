import * as F from "../utils/format.js";
/** Account quota display — shared by auth modal and account settings page. */
(function (window) {
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatBytes = F.formatBytes || (() => "");

  function renderPlanComparison(publicPlans, currentPlanCode, pricing) {
    if (!publicPlans?.length) return "";
    const showPrices = pricing?.commercial?.public;
    const prices = pricing?.commercial?.tierPricesByCode || {};
    const rows = publicPlans
      .map((plan) => {
        const isCurrent = plan.code === currentPlanCode;
        const limits = plan.limits || {};
        const price = prices[plan.code];
        const priceCell =
          showPrices && price
            ? `<br><span class="muted-note">${price.monthly ? `¥${price.monthly}/月` : ""}${price.yearly ? ` · 年付 ¥${price.yearly}` : ""}</span>`
            : "";
        return `<tr class="${isCurrent ? "plan-row-current" : ""}">
          <td><strong>${escapeHtml(plan.label)}</strong>${isCurrent ? ` <span class="cloud-pill">当前</span>` : ""}${priceCell}<br><span class="muted-note">${escapeHtml(plan.description || "")}</span></td>
          <td>${limits.maxWorlds ?? "—"} 个</td>
          <td>${formatBytes(limits.maxBytes || 0)}</td>
          <td>${formatBytes(limits.maxSingleFileBytes || 0)}</td>
        </tr>`;
      })
      .join("");
    return `<div class="plan-compare-wrap"><table class="plan-compare"><thead><tr><th>档位</th><th>剧本数</th><th>云存储</th><th>单文件</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderLaunchPricingCta(pricing, upgrade) {
    const launch = pricing?.launch;
    if (!launch?.active) return "";
    const support = escapeHtml(upgrade?.supportEmail || pricing?.supportEmail || "support@getzhimu.com");
    const inApp = launch.cta?.inAppUrl
      ? `<a class="secondary-btn" href="${escapeHtml(launch.cta.inAppUrl)}" target="_blank" rel="noopener">${escapeHtml(launch.cta.inAppLabel || "登录后申请")}</a>`
      : "";
    const email = launch.cta?.emailUrl
      ? `<a class="secondary-btn" href="${escapeHtml(launch.cta.emailUrl)}">${escapeHtml(launch.cta.emailLabel || "邮件申请")}</a>`
      : "";
    return `<div class="plan-launch-cta" style="margin-top:14px;padding:12px 14px;background:#f8f5ee;border-radius:8px"><p class="muted-note" style="margin:0 0 8px"><strong>${escapeHtml(launch.headline || "内测期免费")}</strong> · ${escapeHtml(launch.subline || "")}</p><div class="row" style="gap:8px;flex-wrap:wrap">${inApp}${email}</div><p class="muted-note" style="margin:8px 0 0">也可在上方点击「申请 XX」提交表单，由 ${support} 人工审核（1～3 个工作日）。</p></div>`;
  }

  function renderCommercialPricingNote(pricing) {
    const commercial = pricing?.commercial;
    if (!commercial?.public) return "";
    return `<p class="muted-note" style="margin-top:12px">标价页已公开（草案）。在线支付尚未开放，购买仍请联系 ${escapeHtml(pricing?.supportEmail || "support@getzhimu.com")}。</p>`;
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

  function renderCreditsSection(credits) {
    if (!credits?.uiVisible) return "";
    const balance = Number(credits.balance ?? 0);
    const monthly = Number(credits.monthlyGrant ?? 0);
    const pct = monthly > 0 ? Math.min(100, Math.round((balance / (monthly * 2)) * 100)) : 0;
    const packs = (credits.packs || [])
      .map(
        (pack) =>
          `<div class="credit-pack-card"><strong>${escapeHtml(pack.label)}</strong><p>${pack.credits} 积分 · ¥${pack.priceCny}</p><span class="muted-note">${escapeHtml(pack.note || "")}</span></div>`
      )
      .join("");
    return `<section class="form-group account-credits-section"><h3>织幕积分</h3><p class="muted-note">${escapeHtml(credits.note || "")}</p><div class="row" style="align-items:center;gap:8px;margin:10px 0"><span class="cloud-pill">${balance} 积分</span><span class="muted-note">每月赠送 ${monthly} · AI 单次约 ${credits.aiCost ?? 5} 积分</span></div><div class="usage-bar"><i style="width:${pct}%"></i></div><div class="credit-pack-grid">${packs}</div><p class="muted-note" style="margin-top:10px">完成首场复盘、持续创作等行为可获得额外积分奖励。在线充值筹备中，请联系 support 人工开通套餐。</p></section>`;
  }

  function renderQuotaSection(usage, entitlements) {
    if (!usage) {
      return `<section class="form-group"><h3>套餐与配额</h3><p class="muted-note">配额信息暂时不可用，不影响账号资料与其他功能。</p><button type="button" class="text-btn" data-action="retry-account-view">重新加载配额</button></section>`;
    }
    const upgrade = entitlements?.upgrade;
    const publicPlans = entitlements?.publicPlans;
    const pricing = entitlements?.pricing;
    const credits = entitlements?.credits;
    const storagePct = usage.storagePercent ?? (usage.maxBytes ? Math.min(100, Math.round((usage.usedBytes || 0) / usage.maxBytes * 100)) : 0);
    const worldsPct = usage.worldsPercent ?? (usage.maxWorlds ? Math.min(100, Math.round((usage.usedWorlds || 0) / usage.maxWorlds * 100)) : 0);
    const betaNote = usage.isInternalBeta ? `<span class="cloud-pill" style="margin-left:6px">内测</span>` : "";
    const policyNote =
      pricing?.mode === "commercial" && pricing?.commercial?.public
        ? `<p class="muted-note" style="margin-top:12px">在线支付筹备中。配额升级仍请<strong>申请升级</strong>或邮件 ${escapeHtml(upgrade?.supportEmail || pricing?.supportEmail || "support@getzhimu.com")}。</p>`
        : `<p class="muted-note" style="margin-top:12px">暂无订阅或充值入口。配额不足可<strong>申请升级</strong>，由 ${escapeHtml(upgrade?.supportEmail || pricing?.supportEmail || "support@getzhimu.com")} 人工审核开通。</p>`;
    return `<section class="form-group account-quota-section"><h3>套餐与配额</h3><div class="row" style="align-items:center;gap:8px;margin-bottom:10px"><span class="cloud-pill">${escapeHtml(usage.planLabel || usage.planCode || "免费版")}</span>${betaNote}</div>${usage.planDescription ? `<p class="muted-note" style="margin-bottom:10px">${escapeHtml(usage.planDescription)}</p>` : ""}<p class="muted-note" style="margin-bottom:6px">云存储 · ${formatBytes(usage.usedBytes || 0)} / ${formatBytes(usage.maxBytes || 0)}</p><div class="usage-bar"><i style="width:${storagePct}%"></i></div><div class="status-meta"><span>已用 ${storagePct}%</span><span>剩余 ${formatBytes(usage.remainingBytes ?? 0)}</span></div><p class="muted-note" style="margin-top:14px;margin-bottom:6px">可创建剧本 · ${usage.usedWorlds ?? 0} / ${usage.maxWorlds ?? 0}</p><div class="usage-bar"><i style="width:${worldsPct}%"></i></div><div class="status-meta"><span>已用 ${worldsPct}%</span><span>剩余 ${usage.remainingWorlds ?? 0} 个</span></div><p class="muted-note" style="margin-top:10px">单文件上限 ${formatBytes(usage.maxSingleFileBytes || 0)}</p>${renderCreditsSection(credits)}${renderPlanComparison(publicPlans, usage.planCode, pricing)}${renderUpgradeActions(upgrade, usage.planCode)}${renderLaunchPricingCta(pricing, upgrade)}${renderCommercialPricingNote(pricing)}${policyNote}</section>`;
  }

  window.zhimuAccountQuota = { renderQuotaSection, renderCreditsSection };
})(window);
export {};
