/**
 * P9.1 Context Instantiation — surface semantics only.
 * Fixtures: GEN-03 / GEN-08 / GEN-06 / GEN-01 (+ revision safety)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { semanticsBridgeForTemplate } from "../shared/complete-beat-semantics-data.js";
import {
  auditContextInstantiationStrict,
  auditContextRevisionImpact,
  contextStructuralFingerprint,
  instantiateTemplateWithContext,
  resolveContextualBeatSemantics,
} from "../shared/context-instantiation.js";
import { getContextPreset } from "../shared/context-preset-data.js";
import {
  buildProjectContextProfile,
  selectContextPresetId,
} from "../shared/project-context-profile.js";
import { resolveVariantProgressionSemantics } from "../shared/story-semantic-fidelity.js";
import {
  createInitialProjectStoryState,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";

const BINDINGS = {
  bearer: { id: "B", name: "苏明" },
  knower: { id: "K", name: "知情者" },
  factionLead: { id: "L", name: "领袖" },
  memberA: { id: "M", name: "成员" },
  culprit: { id: "C", name: "何叙" },
  framedCharacter: { id: "F", name: "赵听雨" },
  discoverer: { id: "D", name: "周鹤" },
};

function profileFor(opts) {
  return buildProjectContextProfile(opts);
}

describe("P9.1 preset selection (data-driven)", () => {
  it("selects SCI_FI_FACILITY from SCI_FI / 科幻 tags (no caseId)", () => {
    const id = selectContextPresetId({
      settingEra: "SCI_FI",
      genreTags: ["科幻", "身份权限"],
      premiseEra: "近未来空间站",
    });
    assert.equal(id, "SCI_FI_FACILITY");
  });

  it("selects CONTEMPORARY_URBAN for modern urban", () => {
    const id = selectContextPresetId({
      settingEra: "CONTEMPORARY",
      genreTags: ["现代", "封闭推凶"],
      premiseEra: "当代都市",
    });
    assert.equal(id, "CONTEMPORARY_URBAN");
  });
});

describe("P9.1 GEN-03 Helios / SCI_FI surface", () => {
  it("instantiates station entities into M07 surface without changing structure", () => {
    const contextProfile = profileFor({
      creationSpec: { setting: { era: "SCI_FI" }, genreTags: ["科幻", "身份权限"] },
      premise: { era: "近未来空间站" },
    });
    assert.equal(contextProfile.presetId, "SCI_FI_FACILITY");

    // Use a variant without progression semanticOverrides so base SEARCH surface shows.
    const row = instantiateTemplateWithContext({
      templateId: "M07-2",
      variantId: "V03",
      contextProfile,
      roleBindings: BINDINGS,
      phaseBand: 1,
    });
    assert.equal(row.audit.status, "PASS", JSON.stringify(row.audit.checks));
    assert.equal(row.semantics.actionKind, "SEARCH");
    assert.ok(row.semantics.action.includes("权限档案终端"));
    assert.ok(row.semantics.action.includes("舰员身份认证日志"));
    assert.ok(row.semantics.target.includes("舰员身份认证日志"));
    assert.equal(row.fingerprintBefore, row.fingerprintAfter);
    assert.ok(!String(row.semantics.action).includes("{ctx."));
  });

  it("V01 settlement trigger keeps actionKind; surface uses facility code", () => {
    const contextProfile = profileFor({
      preferredPresetId: "SCI_FI_FACILITY",
    });
    const row = instantiateTemplateWithContext({
      templateId: "M07-2",
      variantId: "V01",
      contextProfile,
      roleBindings: BINDINGS,
      phaseBand: 1,
    });
    // progression for M07-2 V01 is settlement override on phase progression
    const v = resolveVariantProgressionSemantics({
      templateId: "M07-2",
      variantId: "V01",
      roleBindings: BINDINGS,
      contextProfile,
    });
    assert.equal(v.semantics.actionKind, "SUBMIT_CODE");
    assert.ok(v.semantics.goal.includes("维修区结算授权码"));
    assert.ok(!v.semantics.goal.includes("{ctx."));
  });
});

describe("P9.1 GEN-08 Context × Variant publicTask", () => {
  it("success vs failure keep specialization with concrete task label", () => {
    const contextProfile = profileFor({
      creationSpec: { setting: { era: "CONTEMPORARY" }, genreTags: ["现实", "公共任务"] },
      premise: { era: "当代大型场馆" },
      explicitBindings: {
        publicTask: { label: "恢复备用配电系统", kind: "TASK" },
      },
    });
    assert.equal(contextProfile.bindings.publicTask.label, "恢复备用配电系统");
    assert.equal(contextProfile.bindings.publicTask.source, "PROJECT_EXPLICIT");

    const success = resolveVariantProgressionSemantics({
      templateId: "M08-7",
      variantId: "V01",
      roleBindings: BINDINGS,
      contextProfile,
    });
    const failure = resolveVariantProgressionSemantics({
      templateId: "M08-7",
      variantId: "V02",
      roleBindings: BINDINGS,
      contextProfile,
    });
    assert.ok(success.semantics.goal.includes("恢复备用配电系统"));
    assert.ok(success.semantics.goal.includes("成功"));
    assert.ok(failure.semantics.goal.includes("恢复备用配电系统"));
    assert.ok(failure.semantics.goal.includes("阻止") || failure.semantics.goal.includes("失败"));
    assert.notEqual(success.semantics.goal, failure.semantics.goal);
    assert.equal(success.semantics.actionKind, "SUPPORT_PUBLIC_TASK");
    assert.equal(failure.semantics.actionKind, "SABOTAGE_PUBLIC_TASK");
    assert.equal(
      contextStructuralFingerprint(success.semantics).split("||")[1],
      "SUPPORT_PUBLIC_TASK",
    );
  });
});

describe("P9.1 GEN-06 explicit core object", () => {
  it("两封没有寄出的信 enters identity / document surface", () => {
    const contextProfile = profileFor({
      creationSpec: { setting: { era: "CONTEMPORARY" }, genreTags: ["现实", "双线"] },
      premise: { era: "当代家庭聚会" },
      explicitBindings: {
        identityRecord: { label: "两封没有寄出的信", kind: "RECORD" },
        centralDocument: { label: "两封没有寄出的信", kind: "RECORD" },
      },
    });
    const row = instantiateTemplateWithContext({
      templateId: "M07-2",
      variantId: "V03",
      contextProfile,
      roleBindings: BINDINGS,
      phaseBand: 1,
    });
    assert.equal(row.audit.status, "PASS", JSON.stringify(row.audit.checks));
    assert.ok(row.semantics.action.includes("两封没有寄出的信"));
    assert.ok(row.semantics.target.includes("两封没有寄出的信"));
    assert.ok(row.audit.checks.explicitBindingsHonored.ok);
  });
});

describe("P9.1 GEN-01 contemporary leakage regression", () => {
  it("rejects obvious ancient tokens in contemporary urban surface", () => {
    const contextProfile = profileFor({
      creationSpec: { setting: { era: "CONTEMPORARY" }, genreTags: ["现代", "封闭推凶"] },
      premise: { era: "当代都市" },
    });
    assert.equal(contextProfile.presetId, "CONTEMPORARY_URBAN");
    const preset = getContextPreset("CONTEMPORARY_URBAN");
    assert.ok(preset.forbiddenLeakTokens.includes("玉佩"));

    const row = instantiateTemplateWithContext({
      templateId: "M01-FRAMING",
      variantId: "V02",
      contextProfile,
      roleBindings: BINDINGS,
      phaseBand: 1,
    });
    assert.equal(row.audit.status, "PASS", JSON.stringify(row.audit.checks));
    assert.ok(row.audit.checks.obviousLeakage.ok);
    const blob = [row.semantics.goal, row.semantics.action, row.semantics.target].join("\n");
    for (const token of ["玉佩", "宫籍", "内廷", "密令"]) {
      assert.ok(!blob.includes(token), `leak: ${token}`);
    }
  });
});

describe("P9.1 structural safety", () => {
  it("preserves factIds and fingerprint across context fill", () => {
    const contextProfile = profileFor({ preferredPresetId: "SCI_FI_FACILITY" });
    const bridge = semanticsBridgeForTemplate("M07-2");
    const resolved = resolveContextualBeatSemantics({
      bridge,
      phaseBand: 1,
      roleBindings: BINDINGS,
      contextProfile,
      sourceBlockId: "smb_x",
      sourceBeatId: "beat-develop",
    });
    assert.equal(resolved.fingerprintBefore, resolved.fingerprintAfter);
    const idsBefore = [...resolved.before.requires, ...resolved.before.produces]
      .map((f) => f.factId)
      .filter(Boolean);
    const idsAfter = [...resolved.after.requires, ...resolved.after.produces]
      .map((f) => f.factId)
      .filter(Boolean);
    assert.deepEqual(idsBefore, idsAfter);
    assert.ok(idsAfter.some((id) => id.includes("identity_clue")));
    assert.ok(!idsAfter.some((id) => /crew_identity|舰员/.test(id)));

    const audit = auditContextInstantiationStrict({
      beforeSemantics: resolved.before,
      afterSemantics: resolved.after,
      contextProfile,
      contextSlots: bridge.contextSlots,
      bindings: resolved.bindings,
      missingRequired: resolved.missingRequired,
    });
    assert.equal(audit.status, "PASS");
  });

  it("does not promote context into structural locationRef", () => {
    const contextProfile = profileFor({ preferredPresetId: "SCI_FI_FACILITY" });
    const row = instantiateTemplateWithContext({
      templateId: "M07-2",
      variantId: "V01",
      contextProfile,
      roleBindings: BINDINGS,
      phaseBand: 1,
    });
    assert.equal(row.semantics.locationRef, undefined);
    assert.ok(row.semantics.locationHint.includes("权限档案终端"));
  });
});

describe("P9.1 context revision / no silent overwrite", () => {
  it("USER_MODIFIED / LOCKED → CONTEXT_REVIEW_REQUIRED when revision drifts", () => {
    const contextProfile = profileFor({
      preferredPresetId: "SCI_FI_FACILITY",
      previous: { revision: 2, presetId: "CONTEMPORARY_URBAN", bindings: {} },
    });
    assert.equal(contextProfile.revision, 3);
    const report = auditContextRevisionImpact({
      contextProfile,
      blocks: [
        { id: "b1", status: "DRAFT", sourceContextRevision: 2 },
        { id: "b2", status: "USER_MODIFIED", sourceContextRevision: 2 },
        { id: "b3", status: "LOCKED", sourceContextRevision: 2 },
        { id: "b4", status: "USER_ACCEPTED", sourceContextRevision: 3 },
      ],
    });
    assert.equal(report.status, "REVIEW_REQUIRED");
    assert.equal(report.reviewRequired.length, 2);
    assert.ok(report.reviewRequired.every((r) => r.code === "CONTEXT_REVIEW_REQUIRED"));
    assert.ok(report.reinstantiatable.some((r) => r.blockId === "b1"));
  });

  it("engine stamps sourceContextRevision from profile", () => {
    const contextProfile = profileFor({ preferredPresetId: "CONTEMPORARY_URBAN" });
    let state = createInitialProjectStoryState("p91-rev");
    state = {
      ...state,
      contextProfile,
      stages: [
        { id: "act1", label: "一" },
        { id: "act2", label: "二" },
        { id: "act3", label: "三" },
        { id: "act4", label: "四" },
      ],
      characters: [
        { id: "B", name: "苏明" },
        { id: "K", name: "知情者" },
        { id: "R", name: "相关者" },
      ],
    };
    const generated = generateStoryMechanism({
      templateId: "M07-2",
      projectStoryState: state,
      preferredVariantId: "V01",
    });
    const block = generated.mechanismBlocks[0];
    assert.equal(block.sourceContextRevision, contextProfile.revision);
    assert.ok(block.progression?.[0]?.semantics?.action || block.setup?.[0]?.semantics);
  });
});

describe("P9.0 fidelity still holds with template fallback", () => {
  it("M07-2 V01/V02 remain distinct without project profile", () => {
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
    assert.equal(a.semantics.actionKind, "SUBMIT_CODE");
    assert.equal(b.semantics.actionKind, "USE_PERMISSION");
    assert.ok(a.semantics.goal.includes("结算码"));
    assert.ok(b.semantics.goal.includes("权限"));
    assert.ok(!a.semantics.goal.includes("{ctx."));
  });
});
