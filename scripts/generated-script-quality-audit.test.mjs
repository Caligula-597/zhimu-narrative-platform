/**
 * P10.0 Generated Script Quality Audit — smoke + shape tests (read-only).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateQualityAudit,
  auditGeneratedScriptCase,
  formatQualityAuditMarkdown,
  runGeneratedScriptQualityAudit,
  P10_0_AUDIT_FOCUS,
} from "../shared/generated-script-quality-audit.js";
import { GEN_CASE_IDS } from "../shared/p8-generalization-runner.js";
import { CONTENT_QUALITY_DIMENSIONS } from "../shared/content-quality-contracts.js";

describe("P10.0 Generated Script Quality Audit", () => {
  it("covers exactly GEN-01..08 focus map", () => {
    assert.deepEqual(Object.keys(P10_0_AUDIT_FOCUS).sort(), [...GEN_CASE_IDS].sort());
  });

  it("audits READY case through Real Writer + P9.4 without mutating contracts", async () => {
    const row = await auditGeneratedScriptCase("GEN-01");
    assert.equal(row.caseId, "GEN-01");
    assert.equal(row.productionBlocked, false);
    assert.ok(row.quality);
    assert.ok(typeof row.quality.totalScore === "number");
    assert.equal(row.quality.dimensions.length, CONTENT_QUALITY_DIMENSIONS.length);
    assert.ok(row.storyFamilies.length >= 1);
  });

  it("records production-blocked cases honestly (no Writer quality fake)", async () => {
    const row = await auditGeneratedScriptCase("GEN-05");
    assert.equal(row.productionBlocked, true);
    assert.equal(row.quality, null);
    assert.ok(row.productionBlockers.some((b) => b.type === "OWNER_UNRESOLVED"));
    assert.match(row.notes || "", /未进入 Real Writer/);
  });

  it("full corpus aggregate has failure distribution fields", async () => {
    const audit = await runGeneratedScriptQualityAudit();
    assert.equal(audit.cases.length, 8);
    assert.ok(audit.aggregate.corpusSize === 8);
    assert.ok(audit.aggregate.productionBlockedSize >= 1);
    assert.ok(audit.aggregate.scoredSize >= 1);
    assert.ok(audit.aggregate.bandCounts);
    assert.ok(audit.aggregate.dimensionAverages.A_CHARACTER_AGENCY);
    const md = formatQualityAuditMarkdown(audit);
    assert.match(md, /Quality Failure Distribution/);
    assert.match(md, /Production Gate BLOCKED/);
    assert.match(md, /下一刀建议/);

    // Aggregate must not invent scores for blocked rows
    const blocked = audit.cases.filter((c) => c.productionBlocked);
    assert.ok(blocked.every((c) => c.quality == null));
    const rebuilt = aggregateQualityAudit(audit.cases);
    assert.equal(rebuilt.scoredSize, audit.aggregate.scoredSize);
  });
});
