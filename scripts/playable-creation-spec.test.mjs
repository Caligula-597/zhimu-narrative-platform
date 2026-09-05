/**
 * P8.1 PlayableCreationSpec — contract / envelope / compatibility / candidates
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePlayableCreationSpec,
  updatePlayableCreationSpec,
  validatePlayableCreationSpec,
  PLAYABLE_CREATION_SPEC_VERSION,
} from "../shared/playable-creation-spec.js";
import {
  buildCreationConstraintEnvelope,
  resolveRecommendedStageCount,
} from "../shared/creation-constraint-envelope.js";
import {
  applyCreationSpecUpdate,
  auditCreationSpecCompatibility,
} from "../shared/creation-spec-compatibility.js";
import { buildStoryCandidatePlan } from "../shared/creation-candidate-planner.js";
import { normalizeProjectStoryState } from "../shared/story-mechanism-contracts.js";
import {
  acceptStoryBlock,
  createInitialProjectStoryState,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";
import { listStoryTemplates } from "../shared/story-mechanism-registry.js";

const SPEC_A = {
  playerCount: 6,
  roleConfiguration: {
    genderPolicy: "FIXED_COUNTS",
    fixedCounts: { male: 3, female: 3 },
  },
  setting: { era: "ANCIENT" },
  genreTags: ["推理", "阵营"],
  durationMinutes: 240,
  stagePreference: { mode: "AUTO" },
  experience: {
    deduction: 0.8,
    roleplay: 0.5,
    faction: 0.7,
    mechanism: 0.4,
    emotional: 0.3,
  },
  gameplayPreferences: {
    preferred: ["BIDDING", "VOTING"],
    avoid: [],
  },
};

const SPEC_B = {
  playerCount: 7,
  roleConfiguration: { genderPolicy: "ANY" },
  setting: { era: "SCI_FI" },
  genreTags: ["身份", "推理"],
  durationMinutes: 180,
  stagePreference: { mode: "AUTO" },
  experience: {
    deduction: 0.7,
    roleplay: 0.4,
    faction: 0.2,
    mechanism: 0.5,
    emotional: 0.2,
  },
  gameplayPreferences: { preferred: [], avoid: [] },
};

const SPEC_C = {
  playerCount: 5,
  roleConfiguration: {
    genderPolicy: "AUTHOR_DEFINED",
    authorDefinedSlots: [
      { slotId: "role-1", gender: "MALE" },
      { slotId: "role-2", gender: "FEMALE" },
      { slotId: "role-3", gender: "ANY" },
      { slotId: "role-4", gender: "ANY" },
      { slotId: "role-5", gender: "FEMALE" },
    ],
  },
  setting: { era: "MODERN" },
  genreTags: ["情感", "低交织"],
  durationMinutes: 150,
  stagePreference: { mode: "EXACT", count: 3 },
  experience: {
    deduction: 0.3,
    roleplay: 0.8,
    faction: 0,
    mechanism: 0,
    emotional: 0.9,
  },
  gameplayPreferences: { preferred: [], avoid: ["BIDDING"] },
  premise: { shortIdea: "两封没有寄出的信" },
};

describe("PlayableCreationSpec contract", () => {
  it("normalizes SPEC-A/B/C and preserves experience independently", () => {
    const a = normalizePlayableCreationSpec(SPEC_A);
    assert.equal(a.version, PLAYABLE_CREATION_SPEC_VERSION);
    assert.equal(a.playerCount, 6);
    assert.equal(a.experience.deduction, 0.8);
    assert.equal(a.experience.emotional, 0.3);
    assert.deepEqual(a.gameplayPreferences.preferred, ["BIDDING", "VOTING"]);

    const b = normalizePlayableCreationSpec(SPEC_B);
    assert.equal(b.playerCount, 7);
    assert.equal(b.setting.era, "SCI_FI");

    const c = normalizePlayableCreationSpec(SPEC_C);
    assert.equal(c.roleConfiguration.authorDefinedSlots.length, 5);
    assert.equal(c.premise.shortIdea, "两封没有寄出的信");
  });

  it("rejects invalid fixedCounts without silent ANY pad", () => {
    const bad = validatePlayableCreationSpec({
      ...SPEC_A,
      roleConfiguration: {
        genderPolicy: "FIXED_COUNTS",
        fixedCounts: { male: 4, female: 3 },
      },
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.code === "SPEC_INVALID_ROLE_COUNT"));
    assert.equal(normalizePlayableCreationSpec({
      ...SPEC_A,
      roleConfiguration: {
        genderPolicy: "FIXED_COUNTS",
        fixedCounts: { male: 4, female: 3 },
      },
    }), null);
  });

  it("rejects unsupported playerCount 9", () => {
    const bad = validatePlayableCreationSpec({ ...SPEC_A, playerCount: 9 });
    assert.ok(bad.errors.some((e) => e.code === "UNSUPPORTED_PLAYER_COUNT"));
  });

  it("rejects EXACT stage count 6", () => {
    const bad = validatePlayableCreationSpec({
      ...SPEC_A,
      stagePreference: { mode: "EXACT", count: 6 },
    });
    assert.ok(bad.errors.some((e) => e.code === "UNSUPPORTED_STAGE_COUNT"));
  });
});

describe("ConstraintEnvelope", () => {
  it("AUTO → recommended 4 with explicit reason", () => {
    const rec = resolveRecommendedStageCount(normalizePlayableCreationSpec(SPEC_A));
    assert.equal(rec.count, 4);
    assert.equal(rec.source, "SYSTEM_RECOMMENDATION");
    const env = buildCreationConstraintEnvelope(SPEC_A);
    assert.equal(env.resolvedStageCount, 4);
    assert.equal(env.stageCountResolution.source, "SYSTEM_RECOMMENDATION");
    assert.equal(env.playerCount, 6);
    assert.equal(env.roleSlotConstraints.length, 6);
    assert.ok(env.settingTags.includes("ANCIENT"));
  });

  it("EXACT preserves user count", () => {
    const env = buildCreationConstraintEnvelope(SPEC_C);
    assert.equal(env.resolvedStageCount, 3);
    assert.equal(env.stageCountResolution.source, "USER_EXACT");
  });
});

describe("Candidate planner", () => {
  it("returns recommendations without accepting blocks; no M-numbers in preferred tags", () => {
    const templates = listStoryTemplates();
    const plan = buildStoryCandidatePlan(SPEC_A, templates);
    assert.ok(plan.candidates.length >= 1);
    assert.equal(plan.sourceSpecRevision, normalizePlayableCreationSpec(SPEC_A).revision);
    assert.ok(plan.gameplayCandidates.some((g) => g.intentTag === "BIDDING"));
    assert.ok(plan.gameplayCandidates.every((g) => Array.isArray(g.internalFamilyHints)));
    // Does not create accepted STORY
    assert.ok(!("mechanismBlocks" in plan));
  });

  it("SCI_FI soft affinity still allows M08 candidates (no hard filter)", () => {
    const templates = listStoryTemplates().filter((t) =>
      ["M07-5", "M08-1", "M01-FRAMING"].includes(t.id),
    );
    const plan = buildStoryCandidatePlan(SPEC_B, templates);
    assert.ok(plan.candidates.some((c) => c.familyId === "M08" || c.templateId.startsWith("M08")));
  });
});

describe("Compatibility / edit fixture", () => {
  it("spec revision bumps; accepted blocks preserved; REVIEW_REQUIRED", () => {
    let state = createInitialProjectStoryState("pcs-edit");
    state = generateStoryMechanism({
      templateId: "M01-FRAMING",
      projectStoryState: state,
      preferredVariantId: "V02",
    });
    state = acceptStoryBlock(state, state.mechanismBlocks[0].id);
    const blockId = state.mechanismBlocks[0].id;

    const first = applyCreationSpecUpdate(state, {
      ...SPEC_A,
      stagePreference: { mode: "EXACT", count: 4 },
    });
    assert.equal(first.errors.length, 0);
    assert.equal(first.spec.revision, 1);
    state = first.state;
    assert.equal(state.mechanismBlocks[0].id, blockId);
    assert.equal(state.mechanismBlocks[0].status, "USER_ACCEPTED");

    const second = applyCreationSpecUpdate(state, {
      playerCount: 7,
      roleConfiguration: { genderPolicy: "ANY" },
      setting: { era: "SCI_FI" },
      stagePreference: { mode: "EXACT", count: 5 },
      experience: SPEC_B.experience,
      gameplayPreferences: { preferred: [], avoid: [] },
      genreTags: ["科幻"],
      durationMinutes: 200,
    });
    assert.equal(second.errors.length, 0);
    assert.equal(second.spec.revision, 2);
    assert.equal(second.spec.playerCount, 7);
    assert.equal(second.spec.setting.era, "SCI_FI");
    assert.equal(second.compatibility.status, "REVIEW_REQUIRED");
    assert.ok(
      second.compatibility.issues.some((i) => i.code === "SPEC_PLAYER_COUNT_CHANGED"),
    );
    assert.deepEqual(second.compatibility.preservedAcceptedBlockIds, [blockId]);
    assert.equal(second.state.mechanismBlocks.length, 1);
    assert.equal(second.state.mechanismBlocks[0].status, "USER_ACCEPTED");

    const env = buildCreationConstraintEnvelope(second.spec);
    assert.equal(env.sourceSpecRevision, 2);
    assert.equal(env.resolvedStageCount, 5);
  });

  it("legacy state without creationSpec remains null and readable", () => {
    const state = normalizeProjectStoryState(createInitialProjectStoryState("legacy"));
    assert.equal(state.creationSpec, null);
    const report = auditCreationSpecCompatibility({
      previousSpec: null,
      nextSpec: null,
      projectStoryState: state,
    });
    assert.equal(report.status, "COMPATIBLE");
    assert.ok(report.issues.some((i) => i.code === "LEGACY_UNSPECIFIED"));
  });
});

describe("updatePlayableCreationSpec", () => {
  it("rejects bad patch and keeps previous", () => {
    const { spec: base } = updatePlayableCreationSpec(null, SPEC_A);
    const { spec, errors } = updatePlayableCreationSpec(base, {
      playerCount: 9,
    });
    assert.ok(errors.length);
    assert.equal(spec.playerCount, 6);
  });
});
