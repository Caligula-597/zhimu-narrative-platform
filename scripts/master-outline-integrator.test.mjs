/**
 * Master Outline Integrator Prototype V1 tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMasterOutlineDraft,
  integrateMasterOutline,
  listAcceptedStoryBlocks,
  moveOutlineBeat,
  mergeOutlineBeats,
  setConflictDecision,
  splitWeaveLink,
  proposeWeaveBetweenBeats,
  writeMasterOutlineDraft,
  proposeWeaveLinks,
} from "../shared/master-outline-integrator.js";
import { WEAVE_KINDS } from "../shared/master-outline-contracts.js";
import {
  acceptStoryBlock,
  createDemoProjectState,
  generateStoryMechanism,
} from "../shared/story-mechanism-engine.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";

function seedThreeBlocks() {
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
    templateId: "M08-1",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  state = acceptStoryBlock(state, state.mechanismBlocks.find((b) => b.templateId === "M08-1").id);
  return state;
}

test("无已接受积木时 integrate 失败", () => {
  assert.throws(
    () => integrateMasterOutline(createDemoProjectState()),
    (err) => err.code === "OUTLINE_NO_BLOCKS",
  );
});

test("M01+M07+M08 交织产出 MasterOutlineDraft 四大部分", () => {
  const state = seedThreeBlocks();
  assert.equal(listAcceptedStoryBlocks(state).length, 3);
  const next = integrateMasterOutline(state);
  const draft = next.masterOutlineDraft;
  assert.ok(draft);
  assert.equal(draft.sourceStoryStateRevision, state.revision);
  assert.equal(draft.sourceBlockIds.length, 3);
  assert.ok(draft.stages.length >= 3);
  assert.ok(draft.stages.every((s) => Array.isArray(s.beats)));
  const beatCount = draft.stages.reduce((n, s) => n + s.beats.length, 0);
  assert.ok(beatCount >= 6);
  assert.ok(Array.isArray(draft.weaveLinks));
  assert.ok(draft.weaveLinks.length >= 1);
  assert.ok(draft.weaveLinks.every((l) => WEAVE_KINDS.includes(l.kind)));
  assert.ok(Array.isArray(draft.conflictReport));
  assert.ok(Array.isArray(draft.characterLoadReport));
  assert.ok(draft.characterLoadReport.length >= 1);
  // 不是「一幕一块」：至少有一个阶段包含来自 ≥2 个 block 的 beat
  const multi = draft.stages.some((s) => {
    const blocks = new Set(s.beats.map((b) => b.sourceBlockId));
    return blocks.size >= 2;
  });
  assert.ok(multi, "应出现跨积木同阶段（交织而非并排）");
});

test("共享角色可产生 WEAVE_SHARED_* / 无共享可 KEEP_PARALLEL", () => {
  const state = seedThreeBlocks();
  const draft = buildMasterOutlineDraft(state);
  const kinds = new Set(draft.weaveLinks.map((l) => l.kind));
  assert.ok(
    [...kinds].some((k) =>
      [
        "WEAVE_SHARED_SCENE",
        "WEAVE_SHARED_CHARACTER",
        "WEAVE_CAUSAL",
        "WEAVE_STRONG",
        "WEAVE_SHARED_ACTION",
        "WEAVE_WEAK",
        "KEEP_PARALLEL",
      ].includes(k),
    ),
  );
  const blocks = listAcceptedStoryBlocks(state);
  const beats = draft.stages.flatMap((s) => s.beats);
  const links = proposeWeaveLinks(beats, blocks);
  assert.ok(links.length >= 1);
  assert.ok(links.every((l) => ["INTERWOVEN", "COLOCATED", "PARALLEL"].includes(l.relationQuality)));
});

test("P5.2：默认不把仅共享角色标成 INTERWOVEN；空中间阶段压缩", () => {
  const state = seedThreeBlocks();
  const draft = buildMasterOutlineDraft(state);
  const fake = draft.weaveLinks.filter(
    (l) =>
      l.relationQuality === "INTERWOVEN" &&
      (l.kind === "WEAVE_SHARED_SCENE" || l.kind === "WEAVE_SHARED_CHARACTER"),
  );
  assert.equal(fake.length, 0);
  for (let i = 1; i < draft.stages.length - 1; i += 1) {
    assert.ok(draft.stages[i].beats.length > 0, "中间阶段不应为空");
  }
  const goalDriven = draft.stages.flatMap((s) => s.beats).filter((b) => b.semantics?.goal && b.semantics?.action);
  assert.ok(goalDriven.length >= 2);
});

test("P5.2：低相关积木应出现 KEEP_PARALLEL", () => {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M08-1",
    projectStoryState: state,
    preferredVariantId: "V04",
  });
  state = acceptStoryBlock(state, state.mechanismBlocks[0].id);
  state = generateStoryMechanism({
    templateId: "M07-2",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  state = acceptStoryBlock(state, state.mechanismBlocks.find((b) => b.templateId === "M07-2").id);
  const draft = buildMasterOutlineDraft(state);
  assert.ok(draft.weaveLinks.some((l) => l.kind === "KEEP_PARALLEL"));
});

test("局部调整：移动 / 合并 / 冲突决定 / 拆开 / 尝试交织", () => {
  let state = integrateMasterOutline(seedThreeBlocks());
  let draft = state.masterOutlineDraft;
  const fromStage = draft.stages.find((s) => s.beats.length);
  const beat = fromStage.beats[0];
  const toStage = draft.stages.find((s) => s.id !== fromStage.id) || draft.stages[0];
  draft = moveOutlineBeat(draft, beat.id, toStage.id);
  assert.ok(draft.stages.find((s) => s.id === toStage.id).beats.some((b) => b.id === beat.id));
  assert.equal(draft.status, "USER_ADJUSTED");

  const beats = draft.stages.flatMap((s) => s.beats);
  const a = beats.find((b) => b.familyId === "M01");
  const b = beats.find((b) => b.familyId === "M07" || b.familyId === "M08");
  assert.ok(a && b);
  draft = mergeOutlineBeats(draft, a.id, b.id);
  assert.ok(draft.weaveLinks.some((l) => l.kind === "WEAVE_SHARED_SCENE" && l.status === "ACCEPTED"));

  if (draft.conflictReport[0]) {
    draft = setConflictDecision(draft, draft.conflictReport[0].id, "IGNORE");
    assert.equal(draft.conflictReport[0].decision, "IGNORE");
  }

  const link = draft.weaveLinks.find((l) => l.status !== "SPLIT");
  if (link) {
    draft = splitWeaveLink(draft, link.id);
    assert.equal(draft.weaveLinks.find((l) => l.id === link.id).status, "SPLIT");
  }

  const c = beats.find((x) => x.id !== a.id && x.sourceBlockId !== a.sourceBlockId);
  if (c) {
    draft = proposeWeaveBetweenBeats(draft, a.id, c.id);
    assert.ok(draft.weaveLinks.some((l) => l.status === "ACCEPTED"));
  }

  state = writeMasterOutlineDraft(state, draft);
  assert.equal(state.masterOutlineDraft.id, draft.id);
});

test("ProjectStoryState 规范化保留 masterOutlineDraft", () => {
  const state = integrateMasterOutline(seedThreeBlocks());
  const round = createProjectStoryState(JSON.parse(JSON.stringify(state)));
  assert.ok(round.masterOutlineDraft);
  assert.equal(round.masterOutlineDraft.sourceBlockIds.length, 3);
  assert.ok(round.masterOutlineDraft.stages.length >= 1);
});

test("DRAFT 积木不参与交织", () => {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
  });
  // not accepted
  assert.equal(listAcceptedStoryBlocks(state).length, 0);
  assert.throws(() => buildMasterOutlineDraft(state), (e) => e.code === "OUTLINE_NO_BLOCKS");
});
