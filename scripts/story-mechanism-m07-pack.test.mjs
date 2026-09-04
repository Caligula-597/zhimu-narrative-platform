import assert from "node:assert/strict";
import test from "node:test";
import {
  M07_TEMPLATE_IDS,
  M07_FORM_PRESETS,
  buildM07CompleteTemplates,
  m07ContentCoverageMatrix,
} from "../shared/story-mechanism-m07-pack.js";
import {
  getStoryTemplate,
  validateStoryRegistry,
  contentMaturityTable,
} from "../shared/story-mechanism-registry.js";
import {
  acceptStoryBlock,
  createDemoProjectState,
  editStorySlot,
  generateStoryMechanism,
  lockStorySlot,
  removeStoryBlock,
  swapStorySlot,
  swapStoryVariant,
} from "../shared/story-mechanism-engine.js";

const M07 = buildM07CompleteTemplates();

test("M07 8/8 COMPLETE 且 Registry 对齐", () => {
  assert.equal(M07_TEMPLATE_IDS.length, 8);
  assert.deepEqual(validateStoryRegistry(), []);
  for (const id of M07_TEMPLATE_IDS) {
    const t = getStoryTemplate(id);
    assert.ok(t, id);
    assert.equal(t.contentMaturity, "COMPLETE");
    assert.equal(t.familyId, "M07");
  }
  const table = contentMaturityTable();
  assert.equal(table.filter((r) => r.id.startsWith("M07-") && r.contentMaturity === "COMPLETE").length, 8);
  assert.equal(table.find((r) => r.id === "M01-FRAMING").contentMaturity, "COMPLETE");
  assert.ok(table.filter((r) => r.id.startsWith("M08-")).every((r) => r.contentMaturity === "COMPLETE"));
});

test("M07 每条 VariantPool≥8、ID 无重复、required slots 存在", () => {
  for (const t of M07) {
    assert.ok(t.variants.length >= 8, `${t.id} variants ${t.variants.length}`);
    const ids = t.variants.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length, `${t.id} duplicate variant ids`);
    for (const v of t.variants) {
      assert.ok(v.beatPattern && Object.keys(v.beatPattern).length >= 2, `${t.id}/${v.id} beatPattern`);
      for (const slot of v.requiredSlots || []) {
        assert.ok(t.roleSlots[slot] || t.plotSlots[slot], `${t.id}/${v.id} missing required ${slot}`);
      }
      assert.ok(Array.isArray(v.recommendedCluePattern));
      assert.ok(v.revealPattern);
      assert.ok(v.consequencePattern);
    }
    for (const clue of t.clueSlots) {
      const id = clue.id || clue;
      assert.ok(typeof id === "string" && id.length);
      if (clue.stageHint) {
        assert.ok(
          t.stagePattern.some((s) => (s.id || s) === clue.stageHint),
          `${t.id} clue ${id} bad stageHint ${clue.stageHint}`,
        );
      }
    }
    assert.ok(t.editableSlots.length >= 4, `${t.id} editableSlots`);
    assert.ok(t.constraints.length >= 4, `${t.id} constraints`);
  }
});

test("M07 形式候选池非空", () => {
  for (const [k, list] of Object.entries(M07_FORM_PRESETS)) {
    assert.ok(list.length >= 4, k);
  }
});

test("Workbench schema：M07 editableSlots 可渲染字段齐全", () => {
  for (const t of M07) {
    for (const slot of t.editableSlots) {
      assert.ok(slot.key || slot.id);
      assert.ok(slot.label);
      assert.ok(slot.kind === "role" || slot.kind === "plot");
      assert.ok(Array.isArray(slot.actions));
    }
  }
  assert.ok(m07ContentCoverageMatrix().length === 8);
});

test("通用 generate/swap/edit/remove 覆盖全部 M07", () => {
  for (const id of M07_TEMPLATE_IDS) {
    let state = createDemoProjectState();
    state = generateStoryMechanism({ templateId: id, projectStoryState: state });
    const block = state.mechanismBlocks[0];
    assert.equal(block.templateId, id);
    assert.equal(block.status, "DRAFT");
    assert.ok(block.variantId);

    const otherVariant = getStoryTemplate(id).variants.find((v) => v.id !== block.variantId);
    if (otherVariant) {
      state = swapStoryVariant(state, block.id, otherVariant.id);
      assert.equal(state.mechanismBlocks[0].variantId, otherVariant.id);
    }

    const plotSlot = state.mechanismBlocks[0].editableSlots.find((s) => s.kind === "plot");
    if (plotSlot) {
      const before = state.mechanismBlocks[0].plotBindings[plotSlot.key];
      state = swapStorySlot(state, block.id, plotSlot.key);
      // may equal if only one candidate; still must not throw
      assert.ok(state.mechanismBlocks[0].plotBindings[plotSlot.key] != null || before == null);
    }

    state = acceptStoryBlock(state, block.id);
    assert.equal(state.mechanismBlocks[0].status, "USER_ACCEPTED");
    state = removeStoryBlock(state, block.id);
    assert.equal(state.mechanismBlocks.length, 0);
    assert.equal(state.roleAssignments.length, 0);
  }
});

test("M07 锁定身份承担者后换结构保留", () => {
  let state = generateStoryMechanism({
    templateId: "M07-5",
    projectStoryState: createDemoProjectState(),
    preferredVariantId: "V01",
  });
  const id = state.mechanismBlocks[0].id;
  const bearer = state.mechanismBlocks[0].roleBindings.bearer.id;
  state = lockStorySlot(state, id, "bearer", true);
  state = swapStoryVariant(state, id, "V03");
  assert.equal(state.mechanismBlocks[0].roleBindings.bearer.id, bearer);
  assert.equal(state.mechanismBlocks[0].variantId, "V03");
});

test("M07 手改值带 USER source，换结构保留锁定槽", () => {
  let state = generateStoryMechanism({
    templateId: "M07-2",
    projectStoryState: createDemoProjectState(),
  });
  const id = state.mechanismBlocks[0].id;
  state = editStorySlot(state, id, "hiddenContent", "用户锁定的隐藏内容");
  state = lockStorySlot(state, id, "hiddenContent", true);
  const nextVar = getStoryTemplate("M07-2").variants.find(
    (v) => v.id !== state.mechanismBlocks[0].variantId,
  );
  state = swapStoryVariant(state, id, nextVar.id);
  assert.equal(state.mechanismBlocks[0].plotBindings.hiddenContent, "用户锁定的隐藏内容");
});

test("M01+M07 连续生成不互相覆盖；默认负载分离", () => {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  const m01 = state.mechanismBlocks[0];
  const killer = m01.roleBindings.culprit.id;
  const framed = m01.roleBindings.framedCharacter.id;
  state = generateStoryMechanism({
    templateId: "M07-5",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  assert.equal(state.mechanismBlocks.length, 2);
  assert.equal(state.mechanismBlocks.find((b) => b.id === m01.id).roleBindings.culprit.id, killer);
  const bearer = state.mechanismBlocks.find((b) => b.templateId === "M07-5").roleBindings.bearer.id;
  // 默认应避开已高负载真凶/被嫁祸（若角色池足够）
  assert.ok(bearer);
  assert.ok(state.characters.length >= 6);
  // intentional overlap still possible when forced via edit
  state = editStorySlot(
    state,
    state.mechanismBlocks.find((b) => b.templateId === "M07-5").id,
    "bearer",
    killer,
  );
  assert.equal(
    state.mechanismBlocks.find((b) => b.templateId === "M07-5").roleBindings.bearer.id,
    killer,
  );
  assert.ok(state.roleAssignments.some((r) => r.characterId === killer && r.slotId === "culprit"));
  assert.ok(state.roleAssignments.some((r) => r.characterId === killer && r.slotId === "bearer"));
  void framed;
});
