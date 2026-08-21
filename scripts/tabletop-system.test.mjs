import test from "node:test";
import assert from "node:assert/strict";

import {
  addTabletopCondition,
  advanceTabletopTurn,
  applyTabletopHpChange,
  classifyTabletopCheck,
  createDefaultTabletopSystem,
  normalizeTabletopSystem,
  resetTabletopCombat,
  resolveTabletopAttack,
  rollTabletopCheck,
  startTabletopCombat,
  tabletopCombatState
} from "../shared/tabletop-system.js";
import { normalizeNarrativeSettings } from "../shared/narrative-profile.js";
import {
  applyRuntimeTabletopCheckOutcome,
  createRuntimeTabletopCheck,
  projectRuntimeTabletopCheck,
  resolveRuntimeTabletopCheck
} from "../shared/tabletop-flow.js";

test("dice configuration supports creator-defined dice count and sides", () => {
  const system = normalizeTabletopSystem({
    dice: { count: 3, sides: 8, modifier: 2, defaultTarget: 17 }
  });
  const result = rollTabletopCheck(system.dice, { bonus: 1 }, () => 0.5);
  assert.deepEqual(result.rolls, [5, 5, 5]);
  assert.equal(result.total, 18);
  assert.equal(result.target, 17);
  assert.equal(result.success, true);
});

test("single die maximum and minimum produce critical outcomes", () => {
  const critical = rollTabletopCheck({ count: 1, sides: 20, defaultTarget: 99 }, {}, () => 0.999999);
  const failure = rollTabletopCheck({ count: 1, sides: 20, modifier: 100, defaultTarget: 1 }, {}, () => 0);
  assert.equal(critical.criticalSuccess, true);
  assert.equal(critical.success, true);
  assert.equal(critical.degree, "critical_success");
  assert.equal(failure.criticalFailure, true);
  assert.equal(failure.success, false);
  assert.equal(failure.degree, "critical_failure");
});

test("check margins map to explicit success and failure degrees", () => {
  assert.equal(classifyTabletopCheck({ margin: 5 }).id, "strong_success");
  assert.equal(classifyTabletopCheck({ margin: 4 }).id, "success");
  assert.equal(classifyTabletopCheck({ margin: 0 }).id, "success");
  assert.equal(classifyTabletopCheck({ margin: -1 }).id, "failure");
  assert.equal(classifyTabletopCheck({ margin: -4 }).id, "failure");
  assert.equal(classifyTabletopCheck({ margin: -5 }).id, "severe_failure");
});

test("advantage and disadvantage compare two complete dice pools", () => {
  const samples = [0, 0, 0.99, 0.99];
  const advantage = rollTabletopCheck(
    { count: 2, sides: 6, defaultTarget: 10 },
    { rollMode: "advantage" },
    () => samples.shift()
  );
  assert.deepEqual(advantage.attempts, [[1, 1], [6, 6]]);
  assert.deepEqual(advantage.rolls, [6, 6]);
  assert.equal(advantage.success, true);

  const reverse = [0, 0, 0.99, 0.99];
  const disadvantage = rollTabletopCheck(
    { count: 2, sides: 6, defaultTarget: 10 },
    { rollMode: "disadvantage" },
    () => reverse.shift()
  );
  assert.deepEqual(disadvantage.rolls, [1, 1]);
  assert.equal(disadvantage.success, false);
});

test("combat attack applies damage and advances the round after NPC response", () => {
  const initial = createDefaultTabletopSystem();
  const npcId = initial.npcs[0].id;
  const playerAttack = resolveTabletopAttack(initial, "party", npcId, () => 0.999999);
  assert.ok(playerAttack.result.damage > 0);
  assert.ok(playerAttack.system.npcs[0].hp < playerAttack.system.npcs[0].maxHp);
  assert.equal(playerAttack.system.combat.turn, "npc");
  const npcAttack = resolveTabletopAttack(playerAttack.system, npcId, "party", () => 0.999999);
  assert.equal(npcAttack.system.combat.turn, "player");
  assert.equal(npcAttack.system.combat.round, 2);
  assert.equal(npcAttack.system.combat.log.length, 2);
});

test("normalization clamps NPC values and reset restores combatants", () => {
  const system = normalizeTabletopSystem({
    npcs: [{ id: "boss", name: "首领", maxHp: 10, hp: -30, attack: 5000, defense: -99, damage: 0 }],
    combat: { targetNpcId: "missing", round: 0 }
  });
  assert.equal(system.npcs[0].hp, 0);
  assert.equal(system.npcs[0].attack, 999);
  assert.equal(system.npcs[0].defense, -9);
  assert.equal(system.npcs[0].damage, 1);
  assert.equal(system.combat.targetNpcId, "boss");
  const reset = resetTabletopCombat(system);
  assert.equal(reset.npcs[0].hp, 10);
  assert.equal(reset.combat.round, 1);
});

test("multi-character encounters follow initiative and skip defeated combatants", () => {
  const initial = normalizeTabletopSystem({
    players: [
      { id: "pc-fast", name: "先锋", initiative: 8, maxHp: 20, hp: 20, attack: 6, defense: 3, damage: 20 },
      { id: "pc-slow", name: "术士", initiative: 1, maxHp: 16, hp: 16, attack: 4, defense: 2, damage: 5 }
    ],
    npcs: [{ id: "wolf", name: "雾狼", initiative: 4, maxHp: 8, hp: 8, defense: 0, damage: 3 }]
  });
  const encounter = startTabletopCombat(initial, {}, () => 0.5);
  assert.equal(encounter.started, true);
  assert.deepEqual(encounter.system.combat.initiativeOrder, ["pc-fast", "wolf", "pc-slow"]);
  assert.equal(tabletopCombatState(encounter.system).active?.id, "pc-fast");
  const attack = resolveTabletopAttack(encounter.system, "pc-fast", "wolf", () => 0.999999);
  assert.equal(attack.result.defeated, true);
  assert.equal(attack.system.combat.outcome, "victory");
});

test("conditions expire at turn end and manual HP changes update encounter outcome", () => {
  const encounter = startTabletopCombat(normalizeTabletopSystem({
    players: [{ id: "pc", name: "玩家", initiative: 9, maxHp: 10, hp: 10 }],
    npcs: [{ id: "enemy", name: "敌人", initiative: 1, maxHp: 5, hp: 5 }]
  }), {}, () => 0.5).system;
  const conditioned = addTabletopCondition(encounter, "pc", { label: "专注", rounds: 1 });
  assert.equal(conditioned.players[0].conditions.length, 1);
  const advanced = advanceTabletopTurn(conditioned);
  assert.equal(advanced.players[0].conditions.length, 0);
  const defeated = applyTabletopHpChange(advanced, "enemy", -99);
  assert.equal(defeated.system.combat.outcome, "victory");
  defeated.system.combat.outcomeApplied = true;
  const revived = applyTabletopHpChange(defeated.system, "enemy", 1);
  assert.equal(revived.system.combat.outcome, "");
  assert.equal(revived.system.combat.outcomeApplied, false);
});

test("encounters require at least one conscious combatant on each side", () => {
  const noPlayers = normalizeTabletopSystem({
    players: [{ id: "pc", name: "玩家", maxHp: 10, hp: 0 }],
    npcs: [
      { id: "enemy-a", name: "敌人甲", maxHp: 5, hp: 5 },
      { id: "enemy-b", name: "敌人乙", maxHp: 5, hp: 5 }
    ]
  });
  assert.equal(startTabletopCombat(noPlayers).started, false);
});

test("world narrative settings retain the tabletop setup from the creation wizard", () => {
  const system = normalizeTabletopSystem({ dice: { count: 2, sides: 6 }, npcs: [] });
  const settings = normalizeNarrativeSettings({
    narrativeProfile: {
      creationType: "tabletop_rpg",
      ruleset: { mode: "custom", key: "zhimu-simple-combat", diceNotation: "2d6" }
    },
    tabletopSystem: system
  });
  assert.equal(settings.narrativeProfile.creationType, "tabletop_rpg");
  assert.equal(settings.narrativeProfile.ruleset.diceNotation, "2d6");
  assert.equal(settings.tabletopSystem.dice.sides, 6);
});

test("runtime checks preserve the authored prompt and resolve with the world dice", () => {
  const pending = createRuntimeTabletopCheck({
    id: "cross-gate",
    label: "越过闸门",
    instruction: "说明如何避开巡逻。",
    target: 10,
    bonus: 1,
    rollMode: "normal",
    successText: "队伍无声通过。",
    failureText: "巡逻队发现了痕迹。",
    successEffects: { alarm: -4 },
    failureEffects: { alarm: 6 }
  }, {
    id: "runtime-check",
    locationId: "gate",
    dice: { count: 2, sides: 6, modifier: 1, defaultTarget: 9 },
    now: () => "2026-08-10T12:00:00.000Z"
  });
  const publicPending = projectRuntimeTabletopCheck(pending, { audience: "player" });
  assert.equal(publicPending.successText, undefined);
  assert.equal(publicPending.failureText, undefined);
  const resolved = resolveRuntimeTabletopCheck(pending, {
    random: () => 0.5,
    now: () => "2026-08-10T12:01:00.000Z"
  });
  assert.deepEqual(resolved.result.rolls, [4, 4]);
  assert.equal(resolved.result.total, 10);
  assert.equal(resolved.result.success, true);
  assert.equal(resolved.outcomeText, "队伍无声通过。");
  const publicResolved = projectRuntimeTabletopCheck(resolved, { audience: "player" });
  assert.equal(publicResolved.outcomeText, "队伍无声通过。");
  assert.equal(publicResolved.successText, undefined);
  assert.equal(publicResolved.failureText, undefined);
  assert.equal(publicResolved.successEffects, undefined);
  const applied = applyRuntimeTabletopCheckOutcome(resolved, [
    { id: "alarm", label: "警戒", min: 0, max: 20, value: 7 }
  ], { now: () => "2026-08-10T12:02:00.000Z" });
  assert.deepEqual(applied.variableValues, [{ id: "alarm", value: 3 }]);
  assert.deepEqual(applied.activeCheck.appliedChanges, [{
    id: "alarm", label: "警戒", previous: 7, value: 3, delta: -4
  }]);
  assert.equal(projectRuntimeTabletopCheck(applied.activeCheck, { audience: "player" }).appliedAt, "2026-08-10T12:02:00.000Z");
});
