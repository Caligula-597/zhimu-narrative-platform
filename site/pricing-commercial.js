const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "https://app.getzhimu.com";

function applyExternalEntryBehavior() {
  document.querySelectorAll("[data-link-creator]").forEach((node) => {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTierCard(tier, { showPrice = true } = {}) {
  const price = tier.price;
  const priceHtml =
    showPrice && price
      ? `<p class="pricing-price">${price.monthly === 0 ? "免费" : `¥${price.monthly}<small>/月</small>`}${price.yearly ? `<span class="pricing-year">年付 ¥${price.yearly}</span>` : ""}</p><p class="pricing-price-note">${escapeHtml(price.billingNote || "")}</p>`
      : "";
  return `<article class="pricing-card ${tier.code === "creator" ? "pricing-card-featured" : ""}">
    <h3>${escapeHtml(tier.label)}</h3>
    ${priceHtml}
    <p class="pricing-desc">${escapeHtml(tier.description || "")}</p>
    <ul>
      <li>${escapeHtml(tier.limitsDisplay?.maxWorlds || "")}</li>
      <li>${escapeHtml(tier.limitsDisplay?.maxBytes || "")} 云存储</li>
      <li>单文件 ${escapeHtml(tier.limitsDisplay?.maxSingleFileBytes || "")}</li>
    </ul>
  </article>`;
}

async function bootstrap() {
  try {
    const response = await fetch(`${API_ORIGIN}/api/platform/site`);
    if (!response.ok) throw new Error("site bootstrap failed");
    const payload = await response.json();
    const pricing = payload.pricing?.commercial;
    const launch = payload.pricing?.launch;
    const support = payload.supportEmail || "support@getzhimu.com";

    document.querySelector("[data-pricing-headline]") &&
      (document.querySelector("[data-pricing-headline]").textContent =
        pricing?.headline || "工作室版定价（草案）");
    const disclaimer = document.querySelector("[data-pricing-disclaimer]");
    if (disclaimer) disclaimer.textContent = pricing?.disclaimer || "";

    const tiersEl = document.querySelector("[data-pricing-tiers]");
    if (tiersEl && pricing?.tiers?.length) {
      tiersEl.innerHTML = pricing.tiers.map((tier) => renderTierCard(tier)).join("");
    }

    const emailBtn = document.querySelector("[data-pricing-email]");
    if (emailBtn) {
      const subject = encodeURIComponent("织幕 · 套餐购买咨询");
      emailBtn.setAttribute("href", `mailto:${support}?subject=${subject}`);
    }

    const banner = document.querySelector("[data-pricing-banner]");
    if (banner && pricing?.public) {
      banner.innerHTML = `<strong>标价已公开</strong> · 在线支付仍筹备中，请邮件 ${escapeHtml(support)} 人工开通。`;
    }

    if (payload.links?.creatorApp) {
      document.querySelectorAll("[data-link-creator]").forEach((node) => {
        node.setAttribute("href", payload.links.creatorApp);
      });
      applyExternalEntryBehavior();
    }

    if (launch?.cta?.inAppUrl) {
      /* no-op on commercial page */
    }
  } catch {
    const tiersEl = document.querySelector("[data-pricing-tiers]");
    if (tiersEl) {
      tiersEl.innerHTML = `<p class="muted">暂时无法加载标价数据，请稍后刷新或联系 support@getzhimu.com。</p>`;
    }
  }
}

applyExternalEntryBehavior();
bootstrap();
