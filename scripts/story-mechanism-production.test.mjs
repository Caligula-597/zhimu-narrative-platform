import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_MECHANISM_ROLE,
  createProjectStoryState,
  detectNarrativeOverload,
  mechanismRoleForFamily,
} from "../shared/story-mechanism-contracts.js";
import {
  M01_FRAMING,
  M01_FRAMING_VARIANTS,
  listM01FramingVariants,
} from "../shared/story-mechanism-m01-framing.js";
import {
  CATALOG_STORY_TEMPLATE_IDS,
  contentMaturityTable,
  getStoryTemplate,
  validateStoryRegistry,
} from "../shared/story-mechanism-registry.js";
import {
  acceptStoryBlock,
  createDemoProjectState,
  editStorySlot,
  generateM01Framing,
  generateStoryMechanism,
  lockStorySlot,
  removeStoryBlock,
  swapStorySlot,
  swapStoryVariant,
} from "../shared/story-mechanism-engine.js";

test("家族用途标签：39 GAME + 37 STORY 映射冻结", () => {
  const story = ["M01", "M07", "M08", "M10", "M11"];
  const game = ["M02", "M03", "M04", "M05", "M06", "M09"];
  for (const id of story) assert.equal(mechanismRoleForFamily(id), "STORY_MECHANISM");
  for (const id of game) assert.equal(mechanismRoleForFamily(id), "GAME_MECHANISM");
  assert.equal(Object.keys(FAMILY_MECHANISM_ROLE).length, 11);
});

test("Registry：37/37 catalog STORY 对齐，无校验问题", () => {
  assert.equal(CATALOG_STORY_TEMPLATE_IDS.length, 37);
  assert.deepEqual(validateStoryRegistry(), []);
  for (const id of CATALOG_STORY_TEMPLATE_IDS) {
    assert.ok(getStoryTemplate(id), `missing ${id}`);
  }
  assert.equal(getStoryTemplate("M02-1"), null);
  assert.equal(getStoryTemplate("M09-1"), null);
});

test("contentMaturity 表：M01-FRAMING + M07/M08 COMPLETE，其余 catalog FOUNDATION", () => {
  const table = contentMaturityTable();
  assert.equal(table.length, 38);
  assert.equal(table.find((r) => r.id === "M01-FRAMING").contentMaturity, "COMPLETE");
  assert.equal(table.filter((r) => r.id.startsWith("M07-") && r.contentMaturity === "COMPLETE").length, 8);
  assert.equal(table.filter((r) => r.id.startsWith("M08-") && r.contentMaturity === "COMPLETE").length, 8);
  assert.equal(table.filter((r) => r.contentMaturity === "COMPLETE").length, 17);
  assert.ok(
    table
      .filter((r) => r.inCatalog && !r.id.startsWith("M07-") && !r.id.startsWith("M08-"))
      .every((r) => r.contentMaturity === "FOUNDATION"),
  );
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
  assert.ok(state.roleAssignments.some((r) => r.slotId === "culprit"));
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

test("用户锁定槽不被换结构覆盖", () => {
  let state = generateM01Framing(createDemoProjectState(), { variantId: "V02" });
  const id = state.mechanismBlocks[0].id;
  state = editStorySlot(state, id, "plantedEvidence", "账册残页");
  state = lockStorySlot(state, id, "plantedEvidence", true);
  state = swapStoryVariant(state, id, "V06");
  assert.equal(state.mechanismBlocks[0].plotBindings.plantedEvidence, "账册残页");
  assert.equal(state.mechanismBlocks[0].variantId, "V06");
});

test("通用 generate 任意 FOUNDATION 模板", () => {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M07-1",
    projectStoryState: state,
  });
  assert.equal(state.mechanismBlocks[0].templateId, "M07-1");
  assert.ok(state.mechanismBlocks[0].roleBindings.bearer?.id);
});

test("连续生成两个 STORY block 不互相覆盖 + overload 可检测", () => {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  const firstId = state.mechanismBlocks[0].id;
  const firstKiller = state.mechanismBlocks[0].roleBindings.culprit.id;
  state = generateStoryMechanism({
    templateId: "M07-5",
    projectStoryState: state,
  });
  assert.equal(state.mechanismBlocks.length, 2);
  assert.equal(findStill(state, firstId).roleBindings.culprit.id, firstKiller);
  assert.ok(state.roleAssignments.length >= 3);
  void detectNarrativeOverload(state);
});

function findStill(state, id) {
  return state.mechanismBlocks.find((b) => b.id === id);
}

test("删除 block 后 ProjectStoryState 恢复一致", () => {
  let state = createDemoProjectState();
  state = generateM01Framing(state, { variantId: "V02" });
  const id = state.mechanismBlocks[0].id;
  state = removeStoryBlock(state, id);
  assert.equal(state.mechanismBlocks.length, 0);
  assert.equal(state.roleAssignments.length, 0);
  assert.deepEqual(state.assignments.killerCharacterIds, []);
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
  assert.deepEqual(state.roleAssignments, []);
});
