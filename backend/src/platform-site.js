/**
 * Marketing site bootstrap payload — single GET for getzhimu.com.
 */
import { getBetaApplicationFormConfig } from "./beta-apply.js";
import { loadOfficialExampleSnapshot } from "./official-example.js";
import { listPublicCatalogPreview } from "./platform-catalog-preview.js";

export function getPlatformLinks() {
  const appUrl = (process.env.APP_PUBLIC_URL || "").replace(/\/$/, "");
  const marketingUrl = (process.env.MARKETING_SITE_URL || process.env.MARKETING_SITE_ORIGIN || "").replace(
    /\/$/,
    ""
  );

  return {
    marketingSiteUrl: marketingUrl || null,
    appUrl: appUrl || null,
    register: appUrl ? `${appUrl}/?auth=register` : null,
    login: appUrl ? `${appUrl}/?auth=login` : null,
    officialExample: appUrl ? `${appUrl}/?experience=official` : null,
    creatorGuide: appUrl ? `${appUrl}/docs/CREATOR_GUIDE.md` : null
  };
}

export async function loadMarketingSitePayload() {
  const [officialExample, catalog] = await Promise.all([
    loadOfficialExampleSnapshot(),
    listPublicCatalogPreview({ limit: 8 })
  ]);

  const links = getPlatformLinks();
  const beta = getBetaApplicationFormConfig();

  return {
    fetchedAt: new Date().toISOString(),
    product: {
      name: "织幕",
      tagline: "线上剧本杀与跑团的自动化叙事引擎",
      stage: "beta",
      pricingNote: "内测期间免费使用，无订阅或充值入口。"
    },
    links,
    beta,
    officialExample,
    catalog,
    apis: {
      site: "/api/platform/site",
      beta: "/api/platform/beta",
      betaApply: beta.applyApiPath,
      officialExample: "/api/platform/official-example",
      catalogPreview: "/api/platform/catalog-preview",
      healthLive: "/api/health/live"
    },
    supportEmail: process.env.SUPPORT_EMAIL?.trim() || "support@getzhimu.com"
  };
}
