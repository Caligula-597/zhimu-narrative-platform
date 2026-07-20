import assert from "node:assert/strict";
import test from "node:test";
import {
  projectWorldForMembership,
  publicWorldSettings
} from "../src/world-settings-visibility.js";

const privateSettings = {
  creationType: "tabletop_rpg",
  coverAssetId: "asset-1",
  recapTruthSummary: "凶手与结局",
  matrixSync: { hostRunbooks: [{ secret: true }] },
  creatorBrief: { coreMystery: "内部谜底" },
  commercialProfile: {
    authorName: "作者",
    registrationNumber: "备案-001",
    theme: "悬疑",
    category: "还原",
    versionLabel: "1.0",
    ageRating: "16+",
    copyrightSource: "未公开授权链",
    selfReviewStatus: "in_review",
    selfReviewNotes: "内部审查意见",
    materialChangeDate: "2026-07-20"
  }
};

test("public world settings expose display metadata without truth or internal review data", () => {
  assert.deepEqual(publicWorldSettings(privateSettings), {
    creationType: "tabletop_rpg",
    coverAssetId: "asset-1",
    commercialProfile: {
      authorName: "作者",
      registrationNumber: "备案-001",
      theme: "悬疑",
      category: "还原",
      versionLabel: "1.0",
      ageRating: "16+"
    }
  });
});

test("viewer world projection removes moderation and private creator settings", () => {
  const projected = projectWorldForMembership({
    id: "world-1",
    name: "测试世界",
    summary: "简介",
    status: "active",
    catalog_public: true,
    catalog_review_status: "rejected",
    catalog_review_note: "内部审核意见",
    owner_user_id: "owner-1",
    settings: privateSettings,
    membership_role: "viewer",
    content_revision: 9
  });

  assert.equal(projected.catalog_review_note, undefined);
  assert.equal(projected.owner_user_id, undefined);
  assert.equal(projected.settings.recapTruthSummary, undefined);
  assert.equal(projected.settings.commercialProfile.selfReviewNotes, undefined);
});

test("internal members retain the complete settings object", () => {
  const world = { id: "world-1", membership_role: "reviewer", settings: privateSettings };
  assert.equal(projectWorldForMembership(world), world);
});
