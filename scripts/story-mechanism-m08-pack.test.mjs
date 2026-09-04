/**
 * M08 Story Content Pack V1 — family quality + engine reuse
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  M08_TEMPLATE_IDS,
  M08_FORM_PRESETS,
  buildM08CompleteTemplates,
  m08ContentCoverageMatrix,
} from "../shared/story-mechanism-m08-pack.js";
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

const M08 = buildM08CompleteTemplates();

test("M08 8/8 COMPLETE 且 Registry 对齐", () => {
  assert.equal(M08_TEMPLATE_IDS.length, 8);
  assert.deepEqual(validateStoryRegistry(), []);
  for (const id of M08_TEMPLATE_IDS) {
    const t = getStoryTemplate(id);
    assert.ok(t, id);
    assert.equal(t.contentMaturity, "COMPLETE");
    assert.equal(t.familyId, "M08");
  }
  const table = contentMaturityTable();
  assert.equal(table.filter((r) => r.id.startsWith("M08-") && r.contentMaturity === "COMPLETE").length, 8);
  assert.equal(table.filter((r) => r.contentMaturity === "COMPLETE").length, 17);
  assert.equal(table.filter((r) => r.contentMaturity === "FOUNDATION").length, 21);
});

test("M08 每条 VariantPool≥8、ID 家族内唯一、required slots 存在", () => {
  const allVariantIds = new Set();
  for (const t of M08) {
    assert.ok(t.variants.length >= 8, `${t.id} variants ${t.variants.length}`);
    const ids = t.variants.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length, `${t.id} duplicate variant ids`);
    for (const v of t.variants) {
      const famKey = `${t.id}/${v.id}`;
      assert.ok(!allVariantIds.has(famKey));
      allVariantIds.add(famKey);
      assert.ok(v.beatPattern && Object.keys(v.beatPattern).length >= 2, `${t.id}/${v.id} beatPattern`);
      assert.ok(v.membershipPattern, `${t.id}/${v.id} membershipPattern`);
      assert.ok(v.informationPattern, `${t.id}/${v.id} informationPattern`);
      assert.ok(v.pressurePattern, `${t.id}/${v.id} pressurePattern`);
      assert.ok(v.consequencePattern, `${t.id}/${v.id} consequencePattern`);
      for (const slot of v.requiredSlots || []) {
        assert.ok(t.roleSlots[slot] || t.plotSlots[slot], `${t.id}/${v.id} missing required ${slot}`);
      }
      assert.ok(Array.isArray(v.recommendedCluePattern));
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
    assert.ok(t.plotSlots.membershipVisibility, `${t.id} membershipVisibility`);
    assert.ok(t.plotSlots.secrecyRule, `${t.id} secrecyRule`);
    assert.ok(t.plotSlots.consequence, `${t.id} consequence`);
  }
  assert.equal(
    M08.reduce((n, t) => n + t.variants.length, 0),
    83,
  );
});

test("M08 形式候选池非空", () => {
  for (const [k, list] of Object.entries(M08_FORM_PRESETS)) {
    assert.ok(list.length >= 4, k);
  }
});

test("Workbench schema：M08 editableSlots 可渲染字段齐全", () => {
  for (const t of M08) {
    for (const slot of t.editableSlots) {
      assert.ok(slot.key || slot.id);
      assert.ok(slot.label);
      assert.ok(slot.kind === "role" || slot.kind === "plot");
      assert.ok(Array.isArray(slot.actions));
    }
    assert.ok(t.roleSlots.factionLead);
    assert.ok(t.roleSlots.memberA);
    assert.ok(t.roleSlots.memberB);
  }
  assert.equal(m08ContentCoverageMatrix().length, 8);
});

test("通用 generate/swap/edit/remove 覆盖全部 M08", () => {
  for (const id of M08_TEMPLATE_IDS) {
    let state = createDemoProjectState();
    state = generateStoryMechanism({ templateId: id, projectStoryState: state });
    const block = state.mechanismBlocks[0];
    assert.equal(block.templateId, id);
    assert.equal(block.status, "DRAFT");
    assert.ok(block.variantId);
    assert.ok(block.roleBindings.factionLead?.id);
    assert.ok(block.roleBindings.memberA?.id);
    assert.notEqual(block.roleBindings.factionLead.id, block.roleBindings.memberA.id);
    assert.ok(state.roleAssignments.some((r) => r.slotId === "factionLead"));
    assert.ok(state.roleAssignments.some((r) => r.slotId === "memberA"));

    const otherVariant = getStoryTemplate(id).variants.find((v) => v.id !== block.variantId);
    if (otherVariant) {
      state = swapStoryVariant(state, block.id, otherVariant.id);
      assert.equal(state.mechanismBlocks[0].variantId, otherVariant.id);
    }

    const plotSlot = state.mechanismBlocks[0].editableSlots.find((s) => s.kind === "plot");
    if (plotSlot) {
      const before = state.mechanismBlocks[0].plotBindings[plotSlot.key];
      state = swapStorySlot(state, block.id, plotSlot.key);
      assert.ok(state.mechanismBlocks[0].plotBindings[plotSlot.key] != null || before == null);
    }

    state = acceptStoryBlock(state, block.id);
    assert.equal(state.mechanismBlocks[0].status, "USER_ACCEPTED");
    state = removeStoryBlock(state, block.id);
    assert.equal(state.mechanismBlocks.length, 0);
    assert.equal(state.roleAssignments.length, 0);
  }
});

test("换成员只影响目标槽；换 Variant 保留锁定领袖", () => {
  let state = generateStoryMechanism({
    templateId: "M08-1",
    projectStoryState: createDemoProjectState(),
    preferredVariantId: "V01",
  });
  const id = state.mechanismBlocks[0].id;
  const lead = state.mechanismBlocks[0].roleBindings.factionLead.id;
  const memberBefore = state.mechanismBlocks[0].roleBindings.memberA.id;
  const boundIds = Object.values(state.mechanismBlocks[0].roleBindings)
    .filter(Boolean)
    .map((r) => r.id);
  assert.ok(boundIds.length <= 5, "M08-1 应留出角色池余量以便换成员");
  state = swapStorySlot(state, id, "memberA");
  const memberAfter = state.mechanismBlocks[0].roleBindings.memberA.id;
  assert.equal(state.mechanismBlocks[0].roleBindings.factionLead.id, lead);
  assert.ok(memberAfter);
  assert.notEqual(memberAfter, memberBefore);

  state = lockStorySlot(state, id, "factionLead", true);
  state = swapStoryVariant(state, id, "V07");
  assert.equal(state.mechanismBlocks[0].roleBindings.factionLead.id, lead);
  assert.equal(state.mechanismBlocks[0].variantId, "V07");
});

test("M08 锁定 plot 槽后换结构保留", () => {
  let state = generateStoryMechanism({
    templateId: "M08-2",
    projectStoryState: createDemoProjectState(),
  });
  const id = state.mechanismBlocks[0].id;
  state = editStorySlot(state, id, "hiddenGoal", "用户锁定的隐藏目标");
  state = lockStorySlot(state, id, "hiddenGoal", true);
  const nextVar = getStoryTemplate("M08-2").variants.find(
    (v) => v.id !== state.mechanismBlocks[0].variantId,
  );
  state = swapStoryVariant(state, id, nextVar.id);
  assert.equal(state.mechanismBlocks[0].plotBindings.hiddenGoal, "用户锁定的隐藏目标");
});

test("M01+M07+M08 同项目共存；intentional overlap 可共用角色", () => {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  state = generateStoryMechanism({
    templateId: "M07-5",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  state = generateStoryMechanism({
    templateId: "M08-1",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  assert.equal(state.mechanismBlocks.length, 3);
  const killer = state.mechanismBlocks.find((b) => b.templateId === "M01-FRAMING").roleBindings.culprit.id;
  const m08 = state.mechanismBlocks.find((b) => b.templateId === "M08-1");
  state = editStorySlot(state, m08.id, "factionLead", killer);
  assert.equal(
    state.mechanismBlocks.find((b) => b.templateId === "M08-1").roleBindings.factionLead.id,
    killer,
  );
  assert.ok(state.roleAssignments.some((r) => r.characterId === killer && r.slotId === "culprit"));
  assert.ok(state.roleAssignments.some((r) => r.characterId === killer && r.slotId === "factionLead"));

  const killerRows = state.roleAssignments.filter((r) => r.characterId === killer);
  assert.ok(killerRows.length >= 2);
  const loadTags = state.characters.find((c) => c.id === killer)?.loadTags || [];
  assert.ok(loadTags.includes("culprit") || loadTags.includes("faction_lead") || killerRows.length >= 2);

  state = removeStoryBlock(state, m08.id);
  assert.equal(state.mechanismBlocks.length, 2);
  assert.ok(!state.roleAssignments.some((r) => r.mechanismBlockId === m08.id));
  assert.ok(state.roleAssignments.some((r) => r.characterId === killer && r.slotId === "culprit"));
});

test("M08 persistence roundtrip：accept 后 JSON 重载一致", () => {
  let state = createDemoProjectState();
  state = generateStoryMechanism({
    templateId: "M08-8",
    projectStoryState: state,
    preferredVariantId: "V01",
  });
  const blockId = state.mechanismBlocks[0].id;
  state = lockStorySlot(state, blockId, "factionLead", true);
  state = editStorySlot(state, blockId, "factionGoal", "锁定阵营目标");
  state = lockStorySlot(state, blockId, "factionGoal", true);
  state = acceptStoryBlock(state, blockId);

  const snap = JSON.parse(JSON.stringify(state));
  assert.equal(snap.mechanismBlocks.length, 1);
  assert.equal(snap.mechanismBlocks[0].variantId, "V01");
  assert.equal(snap.mechanismBlocks[0].plotBindings.factionGoal, "锁定阵营目标");
  assert.ok(snap.mechanismBlocks[0].roleBindings.factionLead?.id);
  assert.ok(snap.mechanismBlocks[0].roleBindings.memberA?.id);
  const assigned = Object.values(snap.mechanismBlocks[0].roleBindings).filter(Boolean).length;
  assert.equal(
    snap.roleAssignments.filter((r) => r.mechanismBlockId === blockId).length,
    assigned,
  );
});
