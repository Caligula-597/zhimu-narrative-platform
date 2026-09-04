import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_MECHANISM_ROLE,
  createProjectStoryState,
  mechanismRoleForFamily,
} from "../shared/story-mechanism-contracts.js";
import {
  M01_FRAMING,
  M01_FRAMING_VARIANTS,
  listM01FramingVariants,
} from "../shared/story-mechanism-m01-framing.js";
import {
  acceptStoryBlock,
  createDemoProjectState,
  editStorySlot,
  generateM01Framing,
  swapStorySlot,
  swapStoryVariant,
} from "../shared/story-mechanism-producer.js";

test("家族用途标签：39 GAME + 37 STORY 映射冻结", () => {
  const story = ["M01", "M07", "M08", "M10", "M11"];
  const game = ["M02", "M03", "M04", "M05", "M06", "M09"];
  for (const id of story) assert.equal(mechanismRoleForFamily(id), "STORY_MECHANISM");
  for (const id of game) assert.equal(mechanismRoleForFamily(id), "GAME_MECHANISM");
  assert.equal(Object.keys(FAMILY_MECHANISM_ROLE).length, 11);
});

test("M01-FRAMING 合同与 10 个结构变体就绪", () => {
  assert.equal(M01_FRAMING.id, "M01-FRAMING");
  assert.ok(M01_FRAMING.roleSlots.culprit.required);
  assert.ok(M01_FRAMING.roleSlots.framedCharacter.mustDifferFrom.includes("culprit"));
  assert.equal(M01_FRAMING_VARIANTS.length, 10);
  assert.equal(listM01FramingVariants().length, 10);
  assert.ok(M01_FRAMING_VARIANTS.every((v) => v.beatOutline && v.defaults));
});

test("最小环：生成嫁祸型 → 写回 ProjectStoryState 占位", () => {
  let state = createDemoProjectState();
  state = generateM01Framing(state, { variantId: "V02" });
  assert.equal(state.mechanismBlocks.length, 1);
  const block = state.mechanismBlocks[0];
  assert.equal(block.templateId, "M01-FRAMING");
  assert.equal(block.variantId, "V02");
  assert.equal(block.status, "DRAFT");
  assert.ok(block.roleBindings.culprit?.id);
  assert.ok(block.roleBindings.framedCharacter?.id);
  assert.notEqual(block.roleBindings.culprit.id, block.roleBindings.framedCharacter.id);
  assert.ok(block.setup.length >= 1);
  assert.ok(block.progression.length >= 1);
  assert.ok(block.climax.length >= 1);
  assert.ok(block.plotBindings.plantedEvidence);
  assert.ok(state.assignments.killerCharacterIds.includes(block.roleBindings.culprit.id));
  assert.ok(state.assignments.framedCharacterIds.includes(block.roleBindings.framedCharacter.id));
  assert.ok(state.facts.some((f) => f.kind === "culprit" && f.secret));
});

test("最小环：用这个 → USER_ACCEPTED", () => {
  let state = generateM01Framing(createDemoProjectState(), { variantId: "V02" });
  const id = state.mechanismBlocks[0].id;
  state = acceptStoryBlock(state, id);
  assert.equal(state.mechanismBlocks[0].status, "USER_ACCEPTED");
});

test("最小环：换结构 V02→V06，角色保持、剧情槽按新结构更新", () => {
  let state = generateM01Framing(createDemoProjectState(), { variantId: "V02" });
  const before = state.mechanismBlocks[0];
  const culprit = before.roleBindings.culprit.id;
  const framed = before.roleBindings.framedCharacter.id;
  state = swapStoryVariant(state, before.id, "V06");
  const after = state.mechanismBlocks[0];
  assert.equal(after.variantId, "V06");
  assert.equal(after.roleBindings.culprit.id, culprit);
  assert.equal(after.roleBindings.framedCharacter.id, framed);
  assert.equal(after.status, "USER_MODIFIED");
  assert.match(after.title, /伪造死因/);
  assert.notEqual(after.plotBindings.plantedEvidence, before.plotBindings.plantedEvidence);
});

test("最小环：只换栽赃物品槽，其它剧情锁定意图下可局部轮换", () => {
  let state = generateM01Framing(createDemoProjectState(), { variantId: "V02" });
  const id = state.mechanismBlocks[0].id;
  const beforeEvidence = state.mechanismBlocks[0].plotBindings.plantedEvidence;
  const beforeMotive = state.mechanismBlocks[0].plotBindings.trueMotive;
  state = swapStorySlot(state, id, "plantedEvidence");
  assert.notEqual(state.mechanismBlocks[0].plotBindings.plantedEvidence, beforeEvidence);
  // 动机仍在候选池内（可能相同若未换该槽）
  assert.ok(state.mechanismBlocks[0].plotBindings.trueMotive);
  assert.equal(state.mechanismBlocks[0].plotBindings.trueMotive, beforeMotive);
});

test("最小环：手动改凶手 + 写回 assignments", () => {
  let state = generateM01Framing(createDemoProjectState(), { variantId: "V02" });
  const id = state.mechanismBlocks[0].id;
  const oldKiller = state.mechanismBlocks[0].roleBindings.culprit.id;
  const framed = state.mechanismBlocks[0].roleBindings.framedCharacter.id;
  const alt = state.characters.find(
    (c) => !c.isNpc && c.id !== oldKiller && c.id !== framed,
  );
  assert.ok(alt);
  state = editStorySlot(state, id, "culprit", alt.id);
  assert.equal(state.mechanismBlocks[0].roleBindings.culprit.id, alt.id);
  assert.ok(state.assignments.killerCharacterIds.includes(alt.id));
});

test("ProjectStoryState 规范化：空输入可建白板", () => {
  const state = createProjectStoryState({
    projectId: "p1",
    premise: { playerCount: 6 },
    characters: [{ id: "A", name: "甲" }],
  });
  assert.equal(state.version, 1);
  assert.equal(state.premise.playerCount, 6);
  assert.deepEqual(state.assignments.killerCharacterIds, []);
  assert.equal(state.mechanismBlocks.length, 0);
});
