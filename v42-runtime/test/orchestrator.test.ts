import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runProject } from "../src/core/orchestrator/run-project.js";
import { MemoryNodeRepository } from "../src/infrastructure/db/memory-node-repository.js";
import { createMemoryRuntime } from "../src/api/facade.js";
import type { ProjectSpec } from "../src/domain/project/project-spec.js";
import { validateNodeReferences } from "../src/validators/deterministic/reference.validator.js";
import type { MotivationNode } from "../src/domain/motivation/motivation.js";
import {
  executePlotEvent,
  findTriggerableEvents
} from "../src/runtime/plot-engine/plot-engine.js";
import type { PlotEventNode } from "../src/domain/plot/plot-event.js";
import type { SessionState } from "../src/runtime/state/session-state.js";

const spec: ProjectSpec = {
  id: "proj_orch",
  playerCount: 4,
  cooperationMode: "mixed",
  deliverables: {
    structure: true,
    characterBooks: true,
    gmManual: true,
    fullNarrative: true
  },
  requirements: ["硬核推理"],
  forbiddenPatterns: []
};

describe("Orchestrator stub pipeline", () => {
  it("runs stages in order and fires module hooks", async () => {
    const repo = new MemoryNodeRepository();
    const result = await runProject(spec, repo);
    assert.equal(result.router.modules.hard_mystery?.enabled, true);
    assert.ok(result.completedStages.includes("routing"));
    assert.ok(result.completedStages.includes("setting"));
    assert.ok(result.completedStages.includes("objectives"));
    assert.ok(result.completedStages.includes("plot"));
    assert.ok(result.completedStages.includes("narrative"));
    assert.ok(result.completedStages.includes("complete"));
    assert.ok(result.moduleHooksRun.includes("after_objective"));
    assert.ok(result.moduleHooksRun.includes("after_plot"));
    assert.ok(result.moduleHooksRun.includes("after_narrative"));
  });

  it("facade createMemoryRuntime.run works", async () => {
    const runtime = createMemoryRuntime();
    const result = await runtime.run(spec);
    assert.equal(result.projectId, "proj_orch");
  });
});

describe("Deterministic reference validator", () => {
  it("fails on missing sourceNodeIds", () => {
    const now = new Date().toISOString();
    const node: MotivationNode = {
      id: "M1",
      projectId: "p",
      type: "motivation",
      version: 1,
      status: "draft",
      createdBy: "t",
      updatedBy: "t",
      createdAt: now,
      updatedAt: now,
      lockLevel: 0,
      tags: [],
      characterId: "c1",
      description: "x",
      sourceNodeIds: ["missing_bg"],
      priority: "primary",
      conflictWithMotivationIds: [],
      active: true
    };
    const result = validateNodeReferences([node]);
    assert.equal(result.status, "fail");
  });
});

describe("Plot engine", () => {
  it("triggers and applies mutations", () => {
    const now = new Date().toISOString();
    const event: PlotEventNode = {
      id: "PE1",
      projectId: "p",
      type: "plot_event",
      version: 1,
      status: "validated",
      createdBy: "t",
      updatedBy: "t",
      createdAt: now,
      updatedAt: now,
      lockLevel: 0,
      tags: [],
      eventClass: "conditional",
      title: "警报响起",
      trigger: {
        type: "state",
        predicates: [{ path: "alarm", operator: "equals", value: true }]
      },
      invariantEffects: [{ path: "scene", operation: "set", value: "chaos" }],
      reactiveBranches: [],
      repeatable: false
    };
    const state: SessionState = {
      sessionId: "s1",
      projectId: "p",
      currentTime: 0,
      characterLocations: {},
      objectStates: {},
      characterKnowledgeIds: {},
      publicKnowledgeIds: [],
      resourceStates: {},
      objectiveProgress: {},
      firedPlotEventIds: [],
      activeGMRuleIds: [],
      stateVariables: { alarm: true }
    };
    const triggerable = findTriggerableEvents([event], state);
    assert.equal(triggerable.length, 1);
    const next = executePlotEvent(event, state);
    assert.equal(next.stateVariables.scene, "chaos");
    assert.ok(next.firedPlotEventIds.includes("PE1"));
  });
});
