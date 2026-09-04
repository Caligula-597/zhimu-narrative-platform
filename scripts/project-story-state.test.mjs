import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeProjectStoryState,
  characterLoadScore,
} from "../shared/story-mechanism-contracts.js";
import {
  acceptStoryBlock,
  createInitialProjectStoryState,
  editStorySlot,
  generateStoryMechanism,
  lockStorySlot,
  removeStoryBlock,
  swapStorySlot,
  swapStoryVariant,
} from "../shared/story-mechanism-engine.js";

test("新项目初始化空 ProjectStoryState（无 blocks，有最小角色 snapshot）", () => {
  const state = createInitialProjectStoryState("world-a");
  assert.equal(state.projectId, "world-a");
  assert.equal(state.mechanismBlocks.length, 0);
  assert.equal(state.roleAssignments.length, 0);
  assert.equal(state.revision, 0);
  assert.ok(state.characters.length >= 6);
  assert.ok(state.stages.length >= 1);
});

test("normalize round-trip 保留 bindings / locked / USER source / revision", () => {
  let state = createInitialProjectStoryState("world-rt");
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  const id = state.mechanismBlocks[0].id;
  state = editStorySlot(state, id, "plantedEvidence", "用户手改的证物");
  state = lockStorySlot(state, id, "plantedEvidence", true);
  state = acceptStoryBlock(state, id);
  const json = JSON.parse(JSON.stringify(state));
  const back = normalizeProjectStoryState(json);
  assert.equal(back.mechanismBlocks.length, 1);
  assert.equal(back.mechanismBlocks[0].plotBindings.plantedEvidence, "用户手改的证物");
  assert.ok(back.mechanismBlocks[0].lockedSlots.includes("plantedEvidence"));
  assert.equal(back.mechanismBlocks[0].status, "USER_ACCEPTED");
  assert.ok(back.mechanismBlocks[0].revision >= 2);
  assert.ok(back.roleAssignments.length >= 1);
});

test("项目 A/B 状态隔离（内存构造）", () => {
  let a = createInitialProjectStoryState("proj-a");
  let b = createInitialProjectStoryState("proj-b");
  a = generateStoryMechanism({ templateId: "M01-FRAMING", projectStoryState: a, preferredVariantId: "V02" });
  a = acceptStoryBlock(a, a.mechanismBlocks[0].id);
  assert.equal(a.mechanismBlocks.length, 1);
  assert.equal(b.mechanismBlocks.length, 0);
  assert.notEqual(a.projectId, b.projectId);
});

test("generate/accept/swap/edit/lock/remove 后 revision 与负载一致", () => {
  let state = createInitialProjectStoryState("rev-1");
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  const id = state.mechanismBlocks[0].id;
  const r0 = state.mechanismBlocks[0].revision;
  state = swapStoryVariant(state, id, "V06");
  assert.ok(state.mechanismBlocks[0].revision > r0);
  const r1 = state.mechanismBlocks[0].revision;
  state = swapStorySlot(state, id, "plantedEvidence");
  assert.ok(state.mechanismBlocks[0].revision > r1);
  state = editStorySlot(state, id, "culprit", "D");
  state = lockStorySlot(state, id, "culprit", true);
  state = acceptStoryBlock(state, id);

  state = generateStoryMechanism({
    templateId: "M07-5",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  const m07 = state.mechanismBlocks.find((b) => b.templateId === "M07-5");
  assert.ok(m07);
  state = acceptStoryBlock(state, m07.id);

  assert.equal(state.mechanismBlocks.length, 2);
  assert.ok(characterLoadScore(state, "D") > 0);
  const beforeRemove = state.mechanismBlocks.length;
  state = removeStoryBlock(state, id);
  assert.equal(state.mechanismBlocks.length, beforeRemove - 1);
  assert.ok(!state.mechanismBlocks.some((b) => b.id === id));
});

test("M01 + M07 同项目共存且手改不被 normalize 丢掉", () => {
  let state = createInitialProjectStoryState("coexist");
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  state = acceptStoryBlock(state, state.mechanismBlocks[0].id);
  state = generateStoryMechanism({
    templateId: "M07-5",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  const m07Id = state.mechanismBlocks.find((b) => b.templateId === "M07-5").id;
  state = editStorySlot(state, m07Id, "hiddenContent", "锁定隐藏内容");
  state = lockStorySlot(state, m07Id, "hiddenContent", true);
  state = acceptStoryBlock(state, m07Id);
  const again = normalizeProjectStoryState(JSON.parse(JSON.stringify(state)));
  assert.equal(again.mechanismBlocks.length, 2);
  assert.equal(
    again.mechanismBlocks.find((b) => b.templateId === "M07-5").plotBindings.hiddenContent,
    "锁定隐藏内容",
  );
});
