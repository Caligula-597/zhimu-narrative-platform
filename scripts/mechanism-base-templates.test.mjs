import assert from "node:assert/strict";
import test from "node:test";
import {
  createMechanismState,
  instantiateBaseTemplate,
  listBaseTemplateDocuments,
  runBaseFlow,
  MechanismBaseTemplateError,
} from "../shared/mechanism-base-templates.js";

function withPlayer(state, playerId, patch) {
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...state.players[playerId], ...patch } },
  };
}

test("TRANSFER：DOUBLE 双确认成交，单方确认无效，结算原子转移", () => {
  const params = instantiateBaseTemplate("TRANSFER", { resource_types: ["gold"], confirm_mode: "DOUBLE", timing: "IMMEDIATE" });
  let s = withPlayer(createMechanismState({ players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });

  s = runBaseFlow("TRANSFER", "propose", s, params, { transferId: "t1", resource: "gold", amount: 4, from: "A", to: "B" });
  assert.equal(s.transfers.t1.status, "proposed");

  s = runBaseFlow("TRANSFER", "confirm", s, params, { transferId: "t1", by: "A" });
  assert.equal(s.transfers.t1.status, "proposed"); // 单方确认无效
  assert.equal(s.players.A.resources.gold, 10); // 尚未转移

  s = runBaseFlow("TRANSFER", "confirm", s, params, { transferId: "t1", by: "B" });
  assert.equal(s.transfers.t1.status, "settled"); // 双确认后立即结算
  assert.equal(s.players.A.resources.gold, 6);
  assert.equal(s.players.B.resources.gold, 4);
});

test("TRANSFER：非机制资源拒绝、余额不足整单失败、限制不允许反悔", () => {
  const params = instantiateBaseTemplate("TRANSFER", { resource_types: ["gold"], transfer_limit: 1 });

  assert.throws(
    () => runBaseFlow("TRANSFER", "propose", createMechanismState({ players: ["A", "B"] }), params, { resource: "secret", amount: 1, from: "A", to: "B" }),
    (e) => e instanceof MechanismBaseTemplateError && e.code === "BASE_RULE_VIOLATION",
  );

  const state = withPlayer(createMechanismState({ players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });
  const bad = runBaseFlow("TRANSFER", "propose", state, params, { transferId: "big", resource: "gold", amount: 20, from: "A", to: "B" });
  const accepted = { ...bad, transfers: { ...bad.transfers, big: { ...bad.transfers.big, status: "accepted" } } };
  assert.throws(
    () => runBaseFlow("TRANSFER", "settle", accepted, params, { transferId: "big" }),
    (e) => e.code === "EFFECT_INSUFFICIENT",
  );

  // transfer_limit 达到 1 后，第二次结算拒绝
  let s = withPlayer(createMechanismState({ players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });
  s = runBaseFlow("TRANSFER", "propose", s, params, { transferId: "t1", resource: "gold", amount: 3, from: "A", to: "B" });
  s = runBaseFlow("TRANSFER", "settle", s, params, { transferId: "t1" });
  s = runBaseFlow("TRANSFER", "propose", s, params, { transferId: "t2", resource: "gold", amount: 1, from: "A", to: "B" });
  assert.throws(
    () => runBaseFlow("TRANSFER", "settle", s, params, { transferId: "t2" }),
    (e) => e.code === "BASE_TRANSFER_LIMIT",
  );
});

test("TRANSFER：未结算可撤回，已结算不可撤回", () => {
  const params = instantiateBaseTemplate("TRANSFER", { resource_types: ["gold"] });
  let s = withPlayer(createMechanismState({ players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });

  s = runBaseFlow("TRANSFER", "propose", s, params, { transferId: "t1", resource: "gold", amount: 2, from: "A", to: "B" });
  s = runBaseFlow("TRANSFER", "revoke", s, params, { transferId: "t1" });
  assert.equal(s.transfers.t1, undefined);

  s = runBaseFlow("TRANSFER", "propose", s, params, { transferId: "t2", resource: "gold", amount: 2, from: "A", to: "B" });
  s = runBaseFlow("TRANSFER", "settle", s, params, { transferId: "t2" });
  assert.throws(
    () => runBaseFlow("TRANSFER", "revoke", s, params, { transferId: "t2" }),
    (e) => e.code === "BASE_ALREADY_SETTLED",
  );
});

test("BID：出价冻结、撤回解冻、重复出价单拒绝", () => {
  const params = instantiateBaseTemplate("BID", { freeze_asset: "gold", bid_rule: "INCREMENT", visibility: "PUBLIC" });
  let s = withPlayer(createMechanismState({ players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });

  s = runBaseFlow("BID", "bid", s, params, { player: "A", amount: 4, bidId: "b1" });
  assert.equal(s.players.A.resources.gold, 6);
  assert.equal(s.bids.b1.frozen, 4);

  assert.throws(
    () => runBaseFlow("BID", "bid", s, params, { player: "A", amount: 1, bidId: "b1" }),
    (e) => e.code === "EFFECT_DUPLICATE_BID",
  );

  s = runBaseFlow("BID", "withdraw", s, params, { actionId: "b1" });
  assert.equal(s.players.A.resources.gold, 10);
  assert.equal(s.bids.b1, undefined);
});

test("TIMER：倒计时、补时、超时输出结算码", () => {
  const params = instantiateBaseTemplate("TIMER", { base_duration: 480, extend_to: 15, extend_on_action: true, timeout_code: "TIMEOUT" });
  let s = createMechanismState({ players: ["A", "B"] });

  s = runBaseFlow("TIMER", "start", s, params, { clockKey: "c", duration: 20 });
  assert.equal(s.clocks.c.remaining, 20);

  s = runBaseFlow("TIMER", "tick", s, params, { clockKey: "c", seconds: 8 });
  assert.equal(s.clocks.c.remaining, 12);

  s = runBaseFlow("TIMER", "extend", s, params, { clockKey: "c" });
  assert.equal(s.clocks.c.remaining, 15); // 补时到 extend_to

  s = runBaseFlow("TIMER", "tick", s, params, { clockKey: "c", seconds: 20 });
  assert.equal(s.clocks.c.remaining, 0);
  assert.equal(s.log[s.log.length - 1].flow, "timeout");
  assert.equal(s.log[s.log.length - 1].code, "TIMEOUT");
});

test("SEALED_CHOICE：秘密提交 + 统一揭示，揭示后不可再提交/重复揭示", () => {
  const params = instantiateBaseTemplate("SEALED_CHOICE", { reveal_visibility: "AGGREGATE_ONLY" });
  let s = createMechanismState({ players: ["A", "B"] });

  s = runBaseFlow("SEALED_CHOICE", "submit", s, params, { sealedKey: "s", player: "A", value: "x" });
  assert.equal(s.sealedSubmissions.s.A, "x");
  assert.equal(s.sealedRevealed.s, undefined);

  s = runBaseFlow("SEALED_CHOICE", "reveal", s, params, { sealedKey: "s" });
  assert.equal(s.sealedRevealed.s, true);

  assert.throws(
    () => runBaseFlow("SEALED_CHOICE", "submit", s, params, { sealedKey: "s", player: "B", value: "y" }),
    (e) => e.code === "BASE_ALREADY_REVEALED",
  );
  assert.throws(
    () => runBaseFlow("SEALED_CHOICE", "reveal", s, params, { sealedKey: "s" }),
    (e) => e.code === "BASE_ALREADY_REVEALED",
  );
});

test("VOTE：投/改票、锁票后拒绝、票权不足拒绝", () => {
  const single = instantiateBaseTemplate("VOTE", {
    ballot_mode: "SINGLE",
    candidates: ["X", "Y"],
    allow_revise: true,
  });
  let s = createMechanismState({ players: ["A", "B"] });
  s = runBaseFlow("VOTE", "cast", s, single, { ballotKey: "main", player: "A", value: { choice: "X" } });
  assert.equal(s.ballots.main.A.choice, "X");
  s = runBaseFlow("VOTE", "cast", s, single, { ballotKey: "main", player: "A", value: { choice: "Y" } });
  assert.equal(s.ballots.main.A.choice, "Y");
  s = runBaseFlow("VOTE", "lock", s, single, { ballotKey: "main" });
  assert.throws(
    () => runBaseFlow("VOTE", "cast", s, single, { ballotKey: "main", player: "B", value: { choice: "X" } }),
    (e) => e.code === "BASE_ALREADY_LOCKED",
  );

  const weighted = instantiateBaseTemplate("VOTE", {
    ballot_mode: "WEIGHTED",
    candidates: ["X", "Y"],
    max_weight_per_player: 3,
  });
  let w = createMechanismState({ players: ["A"] });
  w = runBaseFlow("VOTE", "grant_power", w, weighted, { players: ["A"] });
  assert.equal(w.votePower.A, 3);
  assert.throws(
    () =>
      runBaseFlow("VOTE", "cast", w, weighted, {
        ballotKey: "main",
        player: "A",
        value: { allocations: { X: 2, Y: 2 } },
      }),
    (e) => e.code === "BASE_INSUFFICIENT_POWER",
  );
});

test("VOTE：否决令牌第一枚生效，第二枚拒绝", () => {
  const params = instantiateBaseTemplate("VOTE", { ballot_mode: "SINGLE", candidates: ["A", "B"] });
  let s = createMechanismState({ players: ["A", "B"] });
  s = runBaseFlow("VOTE", "grant_veto", s, params, { amounts: { A: 1, B: 1 } });
  s = runBaseFlow("VOTE", "cast_veto", s, params, { player: "A", ballotKey: "main" });
  assert.equal(s.vetoCast.player, "A");
  assert.equal(s.vetoTokens.A, 0);
  assert.throws(
    () => runBaseFlow("VOTE", "cast_veto", s, params, { player: "B", ballotKey: "main" }),
    (e) => e.code === "BASE_VETO_TAKEN",
  );
});

test("底层模板文档完整：5 个基座均声明功能/可调参数含义/锁定规则", () => {
  const docs = listBaseTemplateDocuments();
  assert.equal(docs.length, 5);
  assert.ok(docs.some((d) => d.code === "VOTE"));
  for (const doc of docs) {
    assert.ok(doc.description, doc.code + " 缺少功能说明");
    assert.ok(Object.keys(doc.editable_params).length > 0, doc.code + " 缺少可调参数说明");
    assert.ok(doc.locked_rules.length > 0, doc.code + " 缺少锁定规则");
  }
});
