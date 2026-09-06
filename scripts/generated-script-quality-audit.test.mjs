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

  it("records production-blocked cases honestly when still blocked", async () => {
    // After P10.1 most GEN cases should produce; keep the honesty invariant:
    // if blocked, quality must be null and notes must say so.
    const { auditGeneratedScriptCase } = await import("../shared/generated-script-quality-audit.js");
    const row = await auditGeneratedScriptCase("GEN-05");
    if (row.productionBlocked) {
      assert.equal(row.quality, null);
      assert.match(row.notes || "", /未进入 Real Writer/);
    } else {
      assert.ok(row.quality);
      assert.notEqual(row.productionGateStatus, "BLOCKED");
    }
  });

  it("full corpus aggregate has failure distribution fields", async () => {
    const audit = await runGeneratedScriptQualityAudit();
    assert.equal(audit.cases.length, 8);
    assert.ok(audit.aggregate.corpusSize === 8);
    assert.ok(audit.aggregate.productionBlockedSize >= 0);
    assert.ok(audit.aggregate.scoredSize >= 1);
    // P10.1 goal: majority of GEN corpus reachable by Writer
    assert.ok(audit.aggregate.scoredSize >= 7, `expected >=7 scored, got ${audit.aggregate.scoredSize}`);
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
