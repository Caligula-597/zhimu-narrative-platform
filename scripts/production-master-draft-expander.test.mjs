/**
 * P6.0 Production Master Draft Expander — unit tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  expandProductionMasterDraft,
  expandAndWriteProductionMasterDraft,
  applyContentEdit,
  proposeStructureEdit,
  writeProductionMasterDraft,
  expandBeatProse,
  relationNotesForBeat,
} from "../shared/production-master-draft-expander.js";
import { outlineStructureRevision } from "../shared/production-master-draft-contracts.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import {
  acceptStoryBlock,
  createDemoProjectState,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";

const FIXED_NOW = () => "2026-09-04T12:00:00.000Z";

function seedIntegrated() {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  state = acceptStoryBlock(state, state.mechanismBlocks[0].id);
  state = generateStoryMechanism({
    templateId: "M07-5",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  state = acceptStoryBlock(state, state.mechanismBlocks.find((b) => b.templateId === "M07-5").id);
  state = generateStoryMechanism({
    templateId: "M08-2",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  state = acceptStoryBlock(state, state.mechanismBlocks.find((b) => b.templateId === "M08-2").id);
  return integrateMasterOutline(state);
}

test("无 outline 时 expand 失败", () => {
  assert.throws(
    () => expandProductionMasterDraft(createDemoProjectState()),
    (err) => err.code === "EXPAND_NO_OUTLINE",
  );
});

test("expand 保持 stage 顺序与 beat 可追溯", () => {
  const state = seedIntegrated();
  const outline = state.masterOutlineDraft;
  const draft = expandProductionMasterDraft(state, { now: FIXED_NOW });
  assert.equal(draft.stages.length, outline.stages.length);
  for (let i = 0; i < outline.stages.length; i += 1) {
    assert.equal(draft.stages[i].stageId, outline.stages[i].id);
    assert.equal(draft.stages[i].order, outline.stages[i].order);
    assert.equal(draft.stages[i].beats.length, outline.stages[i].beats.length);
    for (let j = 0; j < outline.stages[i].beats.length; j += 1) {
      const ob = outline.stages[i].beats[j];
      const pb = draft.stages[i].beats[j];
      assert.equal(pb.sourceOutlineBeatId, ob.id);
      assert.equal(pb.sourceBlockId, ob.sourceBlockId);
      assert.equal(pb.sourceBeatId, ob.sourceBeatId);
    }
  }
  assert.equal(draft.sourceStoryStateRevision, state.revision);
  assert.equal(draft.sourceMasterOutlineRevision, outlineStructureRevision(outline));
});

test("deterministic repeat：同样输入结构字段等价", () => {
  const state = seedIntegrated();
  const a = expandProductionMasterDraft(state, { now: FIXED_NOW });
  const b = expandProductionMasterDraft(state, { now: FIXED_NOW });
  assert.equal(a.id, b.id);
  assert.equal(a.sourceMasterOutlineRevision, b.sourceMasterOutlineRevision);
  assert.deepEqual(
    a.stages.map((s) => s.beats.map((x) => x.eventSummary)),
    b.stages.map((s) => s.beats.map((x) => x.eventSummary)),
  );
  assert.deepEqual(
    a.truthView.events.map((e) => e.whatHappened),
    b.truthView.events.map((e) => e.whatHappened),
  );
});

test("COLOCATED 关系注记不含假因果连接词强制", () => {
  const notes = relationNotesForBeat([
    { kind: "WEAVE_SHARED_SCENE", relationQuality: "COLOCATED", reason: "同场", status: "PROPOSED", beatIds: [] },
  ]);
  assert.ok(notes.some((n) => n.startsWith("【同场并列】")));
  assert.ok(!notes.some((n) => n.startsWith("【真正交织】")));
});

test("prose 模板忠实展开", () => {
  const text = expandBeatProse({
    actors: [{ id: "a", name: "阿文" }],
    goal: "洗清嫌疑",
    action: "进入旧宅寻找账册",
    target: "账册",
  });
  assert.match(text, /阿文为了洗清嫌疑/);
  assert.match(text, /账册/);
});

test("四视图同源投影", () => {
  const draft = expandProductionMasterDraft(seedIntegrated(), { now: FIXED_NOW });
  assert.ok(draft.truthView.events.length >= 1);
  assert.ok(draft.characterViews.characters.length >= 1);
  assert.ok(Array.isArray(draft.clueView.clues));
  assert.equal(draft.executionView.stages.length, draft.stages.length);
  const beatIds = new Set(draft.stages.flatMap((s) => s.beats.map((b) => b.sourceOutlineBeatId)));
  for (const e of draft.truthView.events) {
    assert.ok(beatIds.has(e.beatId));
  }
});

test("crowding / low weave 产生 warning；StructureChangeRequest 仅 PROPOSED", () => {
  const draft = expandProductionMasterDraft(seedIntegrated(), { now: FIXED_NOW });
  assert.ok(Array.isArray(draft.warnings));
  for (const r of draft.structureChangeRequests) {
    assert.equal(r.status, "PROPOSED");
  }
});

test("CONTENT_EDIT 不改源 outline；STRUCTURE_EDIT 只 propose", () => {
  let state = expandAndWriteProductionMasterDraft(seedIntegrated(), { now: FIXED_NOW });
  const outlineBefore = JSON.stringify(state.masterOutlineDraft);
  const beat = state.productionMasterDraft.stages[0].beats[0];
  let draft = applyContentEdit(state.productionMasterDraft, beat.id, {
    eventSummary: "用户改写的段落",
    contentConfirmed: true,
  });
  state = writeProductionMasterDraft(state, draft);
  assert.equal(JSON.stringify(state.masterOutlineDraft), outlineBefore);
  assert.equal(
    state.productionMasterDraft.stages[0].beats.find((b) => b.id === beat.id).eventSummary,
    "用户改写的段落",
  );

  draft = proposeStructureEdit(state.productionMasterDraft, {
    type: "MOVE_BEAT",
    sourceBeatIds: [beat.sourceOutlineBeatId],
    sourceStageIds: [state.productionMasterDraft.stages[0].stageId],
    reason: "test",
    proposal: "move",
  });
  assert.ok(draft.structureChangeRequests.some((r) => r.status === "PROPOSED" && r.type === "MOVE_BEAT"));
  assert.equal(JSON.stringify(state.masterOutlineDraft), outlineBefore);
});

test("story / outline 变更 → STALE", () => {
  let state = expandAndWriteProductionMasterDraft(seedIntegrated(), { now: FIXED_NOW });
  assert.equal(state.productionMasterDraft.status, "DRAFT");
  state = createProjectStoryState({
    ...state,
    revision: (state.revision || 0) + 1,
  });
  assert.equal(state.productionMasterDraft.status, "STALE");

  state = expandAndWriteProductionMasterDraft(seedIntegrated(), { now: FIXED_NOW });
  const outline = {
    ...state.masterOutlineDraft,
    stages: state.masterOutlineDraft.stages.map((s, i) =>
      i === 0 ? { ...s, beats: s.beats.slice().reverse() } : s,
    ),
  };
  state = createProjectStoryState({
    ...state,
    masterOutlineDraft: outline,
  });
  assert.equal(state.productionMasterDraft.status, "STALE");
});

test("ProjectStoryState 规范化保留 productionMasterDraft", () => {
  const state = expandAndWriteProductionMasterDraft(seedIntegrated(), { now: FIXED_NOW });
  const round = createProjectStoryState(JSON.parse(JSON.stringify(state)));
  assert.ok(round.productionMasterDraft);
  assert.equal(round.productionMasterDraft.stages.length, state.productionMasterDraft.stages.length);
});
