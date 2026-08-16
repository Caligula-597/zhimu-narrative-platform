import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPipelineGenerationAudit,
  generationTraceForPath
} from "../src/pipeline-generation-provenance.js";

test("generation audit preserves field fingerprints and distinguishes AI from human edits", () => {
  const manifest = {
    version: "2.0",
    nodes: {
      truth: { fingerprint: "truth-root", dependsOn: ["source"] },
      "scripts.cells.role-1.ch1": { fingerprint: "script-one", dependsOn: ["matrix.rows.role-1.ch1"] },
      "scripts.cells.role-2.ch1": { fingerprint: "script-two", dependsOn: ["matrix.rows.role-2.ch1"] }
    }
  };
  const audit = buildPipelineGenerationAudit({
    generationProvenance: {
      records: {
        truth: { provider: "deepseek", model: "deepseek-chat", generatedAt: "2026-08-15T00:00:00.000Z" },
        "scripts.cells.role-1.ch1": { originKind: "human_edited", humanEditedAt: "2026-08-15T01:00:00.000Z" },
        scripts: { provider: "deepseek", model: "deepseek-chat", generatedAt: "2026-08-15T00:30:00.000Z" }
      }
    },
    evaluation: { readyForSync: true, overallScore: 8.4, scriptFingerprint: "all-scripts" }
  }, { manifest, importedAt: "2026-08-15T02:00:00.000Z" });
  assert.equal(audit.artifacts.truth.originKind, "ai_generated");
  assert.equal(audit.artifacts["scripts.cells.role-1.ch1"].originKind, "human_edited");
  assert.equal(audit.artifacts["scripts.cells.role-2.ch1"].model, "deepseek-chat");
  assert.equal(generationTraceForPath(audit, "scripts.cells.role-1.ch1").fingerprint, "script-one");
  assert.equal(audit.quality.readyForSync, true);
});
