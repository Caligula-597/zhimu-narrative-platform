/**
 * P9.0 Deterministic Story Semantics Fidelity
 * M01 crime/false + Variant semantic overrides (M07-2, M08-7)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { semanticsBridgeForTemplate } from "../shared/complete-beat-semantics-data.js";
import {
  formatAgencySummary,
  resolveBeatSemantics,
} from "../shared/story-beat-semantics.js";
import {
  auditStorySemanticFidelity,
  resolveVariantProgressionSemantics,
} from "../shared/story-semantic-fidelity.js";
import { getStoryVariant } from "../shared/story-mechanism-registry.js";
import {
  createInitialProjectStoryState,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";

const BINDINGS = {
  culprit: { id: "C", name: "何叙" },
  framedCharacter: { id: "F", name: "赵听雨" },
  discoverer: { id: "D", name: "周鹤" },
  bearer: { id: "B", name: "苏明" },
  factionLead: { id: "L", name: "领袖" },
  memberA: { id: "M", name: "成员" },
  defector: { id: "X", name: "变节者" },
};

function factTypes(sem) {
  return [...(sem?.requires || []), ...(sem?.produces || [])].map(
    (f) => f.factType || f.kind || f.id,
  );
}

describe("P9.0 M01 crime vs false-direction", () => {
  it("crime and falseDirection are distinct events with closed causal chain", () => {
    const bridge = semanticsBridgeForTemplate("M01-FRAMING");
    const crime = resolveBeatSemantics({
      bridge,
      phaseBand: 1,
      roleBindings: BINDINGS,
      sourceBeatId: "beat-crime",
    });
    const falseDir = resolveBeatSemantics({
      bridge,
      phaseBand: 2,
      roleBindings: BINDINGS,
      sourceBeatId: "beat-false",
    });
    const contra = resolveBeatSemantics({
      bridge,
      phaseBand: 3,
      roleBindings: BINDINGS,
      sourceBeatId: "beat-contra",
    });
    const reveal = resolveBeatSemantics({
      bridge,
      phaseBand: 4,
      roleBindings: BINDINGS,
      sourceBeatId: "beat-reveal",
    });

    assert.notEqual(crime.action, falseDir.action);
    assert.notEqual(crime.goal, falseDir.goal);
    assert.ok(factTypes(crime).includes("crime_done"));
    assert.ok(factTypes(crime).includes("planted_evidence_available"));
    assert.ok(!factTypes(crime).includes("false_suspicion"));
    assert.ok(!factTypes(crime).includes("suspicion"));
    assert.ok(factTypes(falseDir).includes("planted_evidence_available"));
    assert.ok(factTypes(falseDir).includes("false_suspicion"));
    assert.ok(factTypes(contra).includes("false_suspicion"));
    assert.ok(factTypes(contra).includes("contradiction"));
    assert.ok(factTypes(reveal).includes("contradiction"));
    assert.notEqual(formatAgencySummary(crime), formatAgencySummary(falseDir));

    const audit = auditStorySemanticFidelity({ templateId: "M01-FRAMING", variantId: "V02" });
    assert.equal(audit.status, "PASS", JSON.stringify(audit.checks.filter((c) => !c.ok)));
  });

  it("engine beat-crime / beat-false resolve different phase bands", () => {
    let state = createInitialProjectStoryState("p9-m01");
    state = {
      ...state,
      stages: [
        { id: "act1", label: "一" },
        { id: "act2", label: "二" },
        { id: "act3", label: "三" },
        { id: "act4", label: "四" },
        { id: "act5", label: "五" },
      ],
      characters: [
        { id: "C", name: "何叙" },
        { id: "F", name: "赵听雨" },
        { id: "D", name: "周鹤" },
        { id: "V", name: "死者" },
      ],
    };
    const generated = generateStoryMechanism({
      templateId: "M01-FRAMING",
      projectStoryState: state,
      preferredVariantId: "V02",
    });
    const block = generated.mechanismBlocks[0];
    const crime = block.progression.find((b) => b.id === "beat-crime");
    const falseB = block.progression.find((b) => b.id === "beat-false");
    assert.ok(crime?.semantics);
    assert.ok(falseB?.semantics);
    assert.notEqual(crime.semantics.action, falseB.semantics.action);
    assert.notEqual(crime.summary, falseB.summary);
    assert.ok(crime.semantics.produces.some((f) => f.factType === "crime_done"));
    assert.ok(falseB.semantics.produces.some((f) => f.factType === "false_suspicion"));
  });
});

describe("P9.0 Variant semantic overrides", () => {
  it("M07-2 V01 vs V02 trigger methods truly differ", () => {
    const v01 = getStoryVariant("M07-2", "V01");
    const v02 = getStoryVariant("M07-2", "V02");
    assert.ok(v01.semanticOverrides?.phases?.progression);
    assert.ok(v02.semanticOverrides?.phases?.progression);

    const a = resolveVariantProgressionSemantics({
      templateId: "M07-2",
      variantId: "V01",
      roleBindings: BINDINGS,
    });
    const b = resolveVariantProgressionSemantics({
      templateId: "M07-2",
      variantId: "V02",
      roleBindings: BINDINGS,
    });
    assert.notEqual(a.semantics.goal, b.semantics.goal);
    assert.notEqual(a.semantics.action, b.semantics.action);
    assert.equal(a.semantics.actionKind, "SUBMIT_CODE");
    assert.equal(b.semantics.actionKind, "USE_PERMISSION");
    assert.ok(a.semantics.goal.includes("结算码"));
    assert.ok(b.semantics.goal.includes("权限"));
    assert.ok(!a.semantics.action.includes("完成登记条件"));
    assert.ok(!b.semantics.action.includes("完成登记条件"));

    assert.equal(auditStorySemanticFidelity({ templateId: "M07-2", variantId: "V01" }).status, "PASS");
    assert.equal(auditStorySemanticFidelity({ templateId: "M07-2", variantId: "V02" }).status, "PASS");
  });

  it("M08-7 success vs failure goals truly differ", () => {
    const a = resolveVariantProgressionSemantics({
      templateId: "M08-7",
      variantId: "V01",
      roleBindings: BINDINGS,
    });
    const b = resolveVariantProgressionSemantics({
      templateId: "M08-7",
      variantId: "V02",
      roleBindings: BINDINGS,
    });
    assert.ok(a.semantics.goal.includes("成功"));
    assert.ok(b.semantics.goal.includes("阻止") || b.semantics.goal.includes("失败"));
    assert.notEqual(a.semantics.goal, b.semantics.goal);
    assert.equal(a.semantics.actionKind, "SUPPORT_PUBLIC_TASK");
    assert.equal(b.semantics.actionKind, "SABOTAGE_PUBLIC_TASK");
    assert.ok(!a.semantics.goal.includes("成功、失败或延迟"));
    assert.ok(!b.semantics.goal.includes("成功、失败或延迟"));
    assert.ok(a.semantics.produces.some((f) => f.factType === "public_task_success_pressure"));
    assert.ok(b.semantics.produces.some((f) => f.factType === "public_task_failure_pressure"));

    assert.equal(auditStorySemanticFidelity({ templateId: "M08-7", variantId: "V01" }).status, "PASS");
    assert.equal(auditStorySemanticFidelity({ templateId: "M08-7", variantId: "V02" }).status, "PASS");
  });

  it("override merge is generic (no family-specific engine branch required)", () => {
    const bridge = semanticsBridgeForTemplate("M07-2");
    const fakeVariant = {
      id: "VX",
      semanticOverrides: {
        phases: {
          progression: { goal: "自定义覆盖目标", action: "自定义覆盖行动", actionKind: "CUSTOM" },
        },
      },
    };
    const sem = resolveBeatSemantics({
      bridge,
      phaseBand: 1,
      roleBindings: BINDINGS,
      variant: fakeVariant,
    });
    assert.equal(sem.goal, "自定义覆盖目标");
    assert.equal(sem.actionKind, "CUSTOM");
  });
});
