import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { routeRequirements } from "../src/core/router/requirement-router.js";
import type { ProjectSpec } from "../src/domain/project/project-spec.js";

function baseSpec(over: Partial<ProjectSpec> = {}): ProjectSpec {
  return {
    id: "proj_1",
    playerCount: 6,
    cooperationMode: "unspecified",
    deliverables: {
      structure: true,
      characterBooks: false,
      gmManual: false,
      fullNarrative: false
    },
    requirements: [],
    forbiddenPatterns: [],
    ...over
  };
}

describe("Requirement Router", () => {
  it("does not infer mystery/space from vague 民国六人本", async () => {
    const result = await routeRequirements(
      baseSpec({ requirements: ["民国六人本"] })
    );
    assert.equal(result.core, true);
    assert.equal(result.modules.hard_mystery?.enabled, false);
    assert.equal(result.modules.outcome_conflict?.enabled, false);
    assert.equal(result.modules.ai_prose?.enabled, false);
  });

  it("enables hard_mystery only on explicit keyword", async () => {
    const result = await routeRequirements(
      baseSpec({ requirements: ["硬核推理"] })
    );
    assert.equal(result.modules.hard_mystery?.enabled, true);
    assert.ok(
      result.modules.hard_mystery?.triggerSource.some((s) => s.includes("硬核推理"))
    );
  });
});
