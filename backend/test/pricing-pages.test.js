import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPricingPayload,
  buildPublicPricingTiers,
  getPricingPageMode,
  isCommercialPricingPublic
} from "../src/pricing-pages.js";

test("buildPublicPricingTiers excludes beta and includes limits", () => {
  const tiers = buildPublicPricingTiers(false);
  assert.equal(tiers.length, 3);
  assert.ok(tiers.every((row) => row.code !== "beta"));
  assert.equal(tiers[0].limits.maxWorlds, 2);
  assert.ok(tiers[0].limitsDisplay.maxBytes.includes("MB"));
});

test("buildPricingPayload launch mode is default", () => {
  const prevMode = process.env.PRICING_PAGE_MODE;
  const prevPublic = process.env.COMMERCIAL_PRICING_PUBLIC;
  delete process.env.PRICING_PAGE_MODE;
  delete process.env.COMMERCIAL_PRICING_PUBLIC;
  try {
    const payload = buildPricingPayload({ appUrl: "https://app.test", marketingUrl: "https://site.test" });
    assert.equal(getPricingPageMode(), "launch");
    assert.equal(payload.mode, "launch");
    assert.equal(payload.launch.active, true);
    assert.equal(payload.commercial.public, false);
    assert.ok(payload.launch.cta.inAppUrl.includes("app.test"));
    assert.ok(payload.launch.cta.emailUrl.startsWith("mailto:"));
    assert.equal(payload.commercial.tiers[1].price.monthly, 68);
  } finally {
    if (prevMode === undefined) delete process.env.PRICING_PAGE_MODE;
    else process.env.PRICING_PAGE_MODE = prevMode;
    if (prevPublic === undefined) delete process.env.COMMERCIAL_PRICING_PUBLIC;
    else process.env.COMMERCIAL_PRICING_PUBLIC = prevPublic;
  }
});

test("COMMERCIAL_PRICING_PUBLIC exposes commercial page flag", () => {
  const prev = process.env.COMMERCIAL_PRICING_PUBLIC;
  process.env.COMMERCIAL_PRICING_PUBLIC = "true";
  try {
    assert.equal(isCommercialPricingPublic(), true);
    const payload = buildPricingPayload({});
    assert.equal(payload.commercial.public, true);
  } finally {
    if (prev === undefined) delete process.env.COMMERCIAL_PRICING_PUBLIC;
    else process.env.COMMERCIAL_PRICING_PUBLIC = prev;
  }
});
