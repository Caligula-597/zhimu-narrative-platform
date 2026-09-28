import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEffect,
  applyEffects,
  createGameState,
  describeEffect,
  listEffectDocuments,
  MechanismEffectError,
} from "../shared/mechanism-effects.js";

function base(overrides = {}) {
  return createGameState({
    players: ["A", "B"],
    capacity: { gold: 10 },
    maxDurability: 10,
    maxShield: 5,
    phaseActionCap: 3,
    decks: { main: ["c1", "c2", "c3"] },
    content: { clue_1: true },
    rng: () => 0.5,
    ...overrides,
  });
}

function withPlayer(state, playerId, patch) {
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...state.players[playerId], ...patch } },
  };
}

test("DAMAGE 先扣护盾，剩余再扣耐久", () => {
  let s = withPlayer(base(), "A", { durability: 10, shield: 5 });
  s = applyEffect(s, { code: "DAMAGE", target: "A", amount: 7 }, { source: "t" });
  assert.equal(s.players.A.shield, 0);
  assert.equal(s.players.A.durability, 8);
  assert.equal(s.log[0].absorbed, 5);
});

test("HEAL 不超过上限，且受 allowHealAtZero 锁定", () => {
  let s = withPlayer(base(), "A", { durability: 8 });
  s = applyEffect(s, { code: "HEAL", target: "A", amount: 5 });
  assert.equal(s.players.A.durability, 10);

  const dead = withPlayer(base({ allowHealAtZero: false }), "A", { durability: 0 });
  assert.throws(
    () => applyEffect(dead, { code: "HEAL", target: "A", amount: 1 }),
    (e) => e instanceof MechanismEffectError && e.code === "EFFECT_GATING",
  );
});

test("SHIELD 同类相加，受 maxShield 上限", () => {
  let s = withPlayer(base(), "A", { shield: 5 });
  s = applyEffect(s, { code: "SHIELD", target: "A", amount: 3, duration: 1 });
  assert.equal(s.players.A.shield, 5); // 已到上限
});

test("DRAW 从牌堆取牌，public 会公开，stop 规则下不足会失败", () => {
  let s = applyEffect(base(), { code: "DRAW", target: "A", pileKey: "main", count: 2, visibility: "public" });
  assert.deepEqual(s.players.A.held, ["c1", "c2"]);
  assert.equal(s.revealedPublic.c1, true);
  assert.deepEqual(s.decks.main, ["c3"]);

  const stop = base({ deckDrawRule: "stop" });
  assert.throws(
    () => applyEffect(stop, { code: "DRAW", target: "A", pileKey: "main", count: 5 }),
    (e) => e.code === "EFFECT_INSUFFICIENT",
  );
});

test("DISCARD 移除组件，不足整次失败", () => {
  let s = withPlayer(base(), "A", { held: ["c1", "c2"] });
  s = applyEffect(s, { code: "DISCARD", target: "A", count: 1 });
  assert.deepEqual(s.players.A.held, ["c2"]);

  assert.throws(
    () => applyEffect(withPlayer(base(), "A", { held: ["c1"] }), { code: "DISCARD", target: "A", count: 2 }),
    (e) => e.code === "EFFECT_INSUFFICIENT",
  );
});

test("STEAL 转移规则资源，.不足会失败，.容量会截断", () => {
  let a = withPlayer(base(), "A", { resources: { gold: 10 } });
  const b = withPlayer(a, "B", { resources: { gold: 8 } });
  const s = applyEffect(b, { code: "STEAL", from: "A", to: "B", resource: "gold", amount: 5 });
  assert.equal(s.players.A.resources.gold, 5);
  assert.equal(s.players.B.resources.gold, 10); // 8 + min(5, 10-8=2) = 10

  assert.throws(
    () => applyEffect(withPlayer(base(), "A", { resources: { gold: 1 } }), { code: "STEAL", from: "A", to: "B", resource: "gold", amount: 5 }),
    (e) => e.code === "EFFECT_INSUFFICIENT",
  );
});

test("SWAP 原子互换两个正式状态", () => {
  let s = withPlayer(base(), "A", { score: 1 });
  s = withPlayer(s, "B", { score: 9 });
  s = applyEffect(s, { code: "SWAP", field_a: { player: "A", field: "score" }, field_b: { player: "B", field: "score" } });
  assert.equal(s.players.A.score, 9);
  assert.equal(s.players.B.score, 1);
});

test("COPY 只能复制可复制效果", () => {
  const s = applyEffect(base(), { code: "COPY", source: { code: "SCORE_GAIN", amount: 5 }, target: "A" });
  assert.equal(s.players.A.score, 5);

  assert.throws(
    () => applyEffect(base(), { code: "COPY", source: { code: "BID", player: "A", amount: 1, asset: "gold" }, target: "B" }),
    (e) => e.code === "EFFECT_NOT_COPYABLE",
  );
});

test("LOCK / SILENCE 增加屏蔽，但拒绝 '*' 全锁", () => {
  let s = applyEffect(base(), { code: "LOCK", action: "bid", target: "*", duration: 2 });
  assert.equal(s.locks["*"].bid, true);

  assert.throws(
    () => applyEffect(base(), { code: "LOCK", action: "*" }),
    (e) => e.code === "EFFECT_LOCK_ALL_REJECTED",
  );
  assert.throws(
    () => applyEffect(base(), { code: "SILENCE", action: "*" }),
    (e) => e.code === "EFFECT_SILENCE_ALL_REJECTED",
  );
});

test("SKIP_TURN 让目标采用默认行动", () => {
  const s = applyEffect(base(), { code: "SKIP_TURN", target: "A" });
  assert.equal(s.players.A.actionsRemaining, 0);
});

test("EXTRA_ACTION 不能跨越阶段上限", () => {
  const s = applyEffect(base(), { code: "EXTRA_ACTION", target: "A", count: 5 });
  assert.equal(s.players.A.actionsRemaining, 3); // cap = phaseActionCap
});

test("RESOURCE_GAIN 受容量限制，RESOURCE_LOSS 不产生负数", () => {
  let s = withPlayer(base(), "A", { resources: { gold: 8 } });
  s = applyEffect(s, { code: "RESOURCE_GAIN", target: "A", resource: "gold", amount: 5 });
  assert.equal(s.players.A.resources.gold, 10);

  s = applyEffect(withPlayer(base(), "A", { resources: { gold: 3 } }), { code: "RESOURCE_LOSS", target: "A", resource: "gold", amount: 5 });
  assert.equal(s.players.A.resources.gold, 0);
});

test("REVEAL_* 只能揭示已存在内容", () => {
  let s = applyEffect(base(), { code: "REVEAL_PUBLIC", content_id: "clue_1" });
  assert.equal(s.revealedPublic.clue_1, true);
  s = applyEffect(s, { code: "REVEAL_PRIVATE", content_id: "clue_1", target: "B" });
  assert.equal(s.revealedPrivate.B.clue_1, true);

  assert.throws(
    () => applyEffect(base(), { code: "REVEAL_PUBLIC", content_id: "ghost" }),
    (e) => e.code === "EFFECT_CONTENT_MISSING",
  );
});

test("REROLL 用新结果覆盖旧结果并保留日志", () => {
  const seq = [0.1, 0.9];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  let s = applyEffect(base({ rng }), { code: "REROLL", scope: "dice" });
  assert.equal(s.rngResults.dice, 0.1);
  s = applyEffect(s, { code: "REROLL", scope: "dice" });
  assert.equal(s.rngResults.dice, 0.9);
  assert.equal(s.log.length, 2);
  assert.equal(s.log[1].before, 0.1);
});

test("REDIRECT 只能在结算窗口内使用", () => {
  const s = applyEffect(base(), { code: "REDIRECT", source: "A", new_target: "B" }, { settlementWindow: true });
  assert.equal(s.redirects.A, "B");

  assert.throws(
    () => applyEffect(base(), { code: "REDIRECT", source: "A", new_target: "B" }, { settlementWindow: false }),
    (e) => e.code === "EFFECT_WINDOW_CLOSED",
  );
});

test("COUNTER 不能反制结算码", () => {
  const s = applyEffect(base(), { code: "COUNTER", effect_id: "fx" });
  assert.equal(s.countered.fx, true);

  const verdict = { ...base(), verdicts: { q1: true } };
  assert.throws(
    () => applyEffect(verdict, { code: "COUNTER", effect_id: "q1" }),
    (e) => e.code === "EFFECT_NOT_COUNTERABLE",
  );
});

test("IMMUNITY 拒绝全效果永久免疫", () => {
  const s = applyEffect(base(), { code: "IMMUNITY", target: "A", effect_scope: "DAMAGE", duration: 3 });
  assert.equal(s.players.A.immunities.DAMAGE, 3);

  assert.throws(
    () => applyEffect(base(), { code: "IMMUNITY", target: "A", effect_scope: "*", duration: Infinity }),
    (e) => e.code === "EFFECT_IMMUNITY_REJECTED",
  );
});

test("AREA_CONTROL 增减区域控制值（可为负）", () => {
  let s = applyEffect(base(), { code: "AREA_CONTROL", target: "A", area: "west", amount: 2 });
  assert.equal(s.players.A.areaControl.west, 2);
  s = applyEffect(s, { code: "AREA_CONTROL", target: "A", area: "west", amount: -1 });
  assert.equal(s.players.A.areaControl.west, 1);
});

test("SCORE_MULTIPLY 在 SCORE_GAIN 之后执行（applyEffects 自动排序）", () => {
  const s = applyEffects(base(), [
    { code: "SCORE_MULTIPLY", target: "A", factor: 2 },
    { code: "SCORE_GAIN", target: "A", amount: 10 },
  ]);
  assert.equal(s.players.A.score, 20); // (0 + 10) * 2
});

test("BID 冻结资源成交，WITHDRAW 解冻；已结算不可撤回", () => {
  let s = withPlayer(base(), "A", { resources: { gold: 10 } });
  s = applyEffect(s, { code: "BID", player: "A", amount: 4, asset: "gold", bid_id: "b1" });
  assert.equal(s.players.A.resources.gold, 6);
  assert.equal(s.bids.b1.frozen, 4);

  assert.throws(
    () => applyEffect(s, { code: "BID", player: "A", amount: 1, asset: "gold", bid_id: "b1" }),
    (e) => e.code === "EFFECT_DUPLICATE_BID",
  );

  s = applyEffect(s, { code: "WITHDRAW", action_id: "b1" });
  assert.equal(s.players.A.resources.gold, 10);
  assert.equal(s.bids.b1, undefined);

  const settled = {
    ...withPlayer(base(), "A", { resources: { gold: 10 } }),
    bids: { b2: { playerId: "A", amount: 2, assetKey: "gold", status: "won" } },
  };
  assert.throws(
    () => applyEffect(settled, { code: "WITHDRAW", action_id: "b2" }),
    (e) => e.code === "EFFECT_ALREADY_SETTLED",
  );
});

test("效果目录完整：25 个效果均声明功能与参数含义", () => {
  const docs = listEffectDocuments();
  assert.equal(docs.length, 25);
  for (const doc of docs) {
    assert.ok(doc.description, `${doc.code} 缺少功能说明`);
    assert.ok(Object.keys(doc.params).length > 0, `${doc.code} 缺少参数说明`);
  }
  assert.match(describeEffect("DAMAGE").description, /护盾/);
});