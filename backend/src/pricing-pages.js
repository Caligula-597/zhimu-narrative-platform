/**
 * Two pricing page sets: launch (form/email upgrade) vs commercial (draft prices, hidden until public).
 * Controlled by PRICING_PAGE_MODE and COMMERCIAL_PRICING_PUBLIC.
 */
import { PLAN_CATALOG, PLAN_DEFAULTS } from "./plans.js";
import { enterpriseEmails } from "./enterprise-emails.js";

/** Draft RMB prices — not sold until COMMERCIAL_PRICING_PUBLIC + checkout enabled. */
export const COMMERCIAL_PRICE_DRAFT = {
  free: { monthly: 0, yearly: 0, currency: "CNY", billingNote: "永久免费" },
  creator: { monthly: 68, yearly: 688, currency: "CNY", billingNote: "草案标价 · 月付/年付" },
  studio: { monthly: 298, yearly: 2980, currency: "CNY", billingNote: "草案标价 · 月付/年付" }
};

const PUBLIC_TIER_CODES = ["free", "creator", "studio"];

function formatBytesShort(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getPricingPageMode() {
  return process.env.PRICING_PAGE_MODE?.trim() === "commercial" ? "commercial" : "launch";
}

export function isCommercialPricingPublic() {
  return process.env.COMMERCIAL_PRICING_PUBLIC === "true";
}

function buildTierCard(code, { includePrices = false } = {}) {
  const meta = PLAN_CATALOG[code] ?? PLAN_CATALOG.free;
  const limits = PLAN_DEFAULTS[code] ?? PLAN_DEFAULTS.free;
  const card = {
    code,
    label: meta.label,
    description: meta.description,
    limits: {
      maxWorlds: limits.max_worlds,
      maxBytes: limits.max_bytes,
      maxSingleFileBytes: limits.max_single_file_bytes
    },
    limitsDisplay: {
      maxWorlds: `${limits.max_worlds} 个剧本`,
      maxBytes: formatBytesShort(limits.max_bytes),
      maxSingleFileBytes: formatBytesShort(limits.max_single_file_bytes)
    }
  };
  if (includePrices) {
    card.price = COMMERCIAL_PRICE_DRAFT[code] ?? null;
  }
  return card;
}

export function buildPublicPricingTiers(includePrices = false) {
  return PUBLIC_TIER_CODES.map((code) => buildTierCard(code, { includePrices }));
}

export function buildPricingPayload({ appUrl, marketingUrl } = {}) {
  const supportEmail = enterpriseEmails().support;
  const mode = getPricingPageMode();
  const commercialPublic = isCommercialPricingPublic();
  const app = (appUrl || process.env.APP_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");
  const marketing = (marketingUrl || process.env.MARKETING_SITE_URL || "https://getzhimu.com").replace(
    /\/$/,
    ""
  );

  const upgradeMailSubject = encodeURIComponent("织幕 · 申请套餐升级");
  const upgradeMailBody = encodeURIComponent(
    "团队/称呼：\n当前账号邮箱：\n希望升级至（创作者/工作室）：\n简要说明创作规模与需求：\n"
  );

  return {
    mode,
    supportEmail,
    launch: {
      active: mode === "launch",
      headline: "内测期免费 · 配额人工开通",
      subline: "暂无在线支付。配额不足请在应用内提交申请，或邮件联系 support。",
      tiers: buildPublicPricingTiers(false),
      cta: {
        inAppLabel: "登录后申请升级",
        inAppUrl: `${app}/?view=account`,
        emailLabel: "邮件申请扩容",
        emailUrl: `mailto:${supportEmail}?subject=${upgradeMailSubject}&body=${upgradeMailBody}`,
        betaFormUrl: `${marketing}/#beta`
      }
    },
    commercial: {
      prepared: true,
      public: commercialPublic,
      draft: true,
      pagePath: "/pricing-commercial.html",
      headline: "工作室版定价（草案）",
      disclaimer:
        "以下为产品草案标价，实测与试点验证完成前不开放在线支付；开通仍由 support 人工确认。",
      tiers: buildPublicPricingTiers(true),
      tierPricesByCode: { ...COMMERCIAL_PRICE_DRAFT },
      checkout: {
        enabled: false,
        note: "Stripe 结账接入后将在此开放；国内支付另行公告。"
      }
    }
  };
}
