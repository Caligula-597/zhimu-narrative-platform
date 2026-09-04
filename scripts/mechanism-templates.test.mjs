import assert from "node:assert/strict";
import test from "node:test";
import {
  initMechanismState,
  instantiateMechanism,
  listMechanismDocuments,
  runMechanismAction,
  settleMechanism,
} from "../shared/mechanism-templates.js";
import { runBaseFlow } from "../shared/mechanism-base-templates.js";

function withPlayer(state, playerId, patch) {
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...state.players[playerId], ...patch } },
  };
}

function withCurrency(state, players, amount) {
  let s = state;
  for (const id of players) s = withPlayer(s, id, { resources: { currency: amount } });
  return s;
}

test("M02-1 自由交换：双确认立即成交 + 结算计数", () => {
  const inst = instantiateMechanism("M02-1", { resource_types: ["gold"], timing: "IMMEDIATE" });
  let s = withPlayer(initMechanismState("M02-1", { players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });

  s = runMechanismAction("M02-1", "propose", s, inst, { transferId: "t1", resource: "gold", amount: 4, from: "A", to: "B" });
  s = runMechanismAction("M02-1", "confirm", s, inst, { transferId: "t1", by: "A" });
  assert.equal(s.transfers.t1.status, "proposed"); // 还需对方确认
  s = runMechanismAction("M02-1", "confirm", s, inst, { transferId: "t1", by: "B" });
  assert.equal(s.transfers.t1.status, "settled");
  assert.equal(s.players.B.resources.gold, 4);

  s = settleMechanism("M02-1", s, inst);
  assert.equal(s.mechanism.result.status, "SETTLED");
  assert.equal(s.mechanism.result.settledTotal, 1);
});

test("M02-1 阶段末履约：接受后到 settleMechanism 统一转移", () => {
  const inst = instantiateMechanism("M02-1", { resource_types: ["gold"], timing: "STAGE_END" });
  let s = withPlayer(initMechanismState("M02-1", { players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });

  s = runMechanismAction("M02-1", "propose", s, inst, { transferId: "t1", resource: "gold", amount: 4, from: "A", to: "B" });
  s = runMechanismAction("M02-1", "confirm", s, inst, { transferId: "t1", by: "A" });
  s = runMechanismAction("M02-1", "confirm", s, inst, { transferId: "t1", by: "B" });
  assert.equal(s.transfers.t1.status, "accepted");
  assert.equal(s.players.B.resources.gold, undefined); // 尚未转移，无余额

  s = settleMechanism("M02-1", s, inst);
  assert.equal(s.players.B.resources.gold, 4);
});

test("M03-1 明拍：叫价、补时、成交、胜者扣款败者退款", () => {
  const inst = instantiateMechanism("M03-1", { start_price: 2, min_increment: 1, extend_to: 15, freeze_asset: "currency", lot: "lot1" });
  let s = withCurrency(initMechanismState("M03-1", { players: ["A", "B", "C"], capacity: { currency: 100 } }), ["A", "B", "C"], 100);
  s = runBaseFlow("TIMER", "start", s, inst.baseParams.TIMER, { clockKey: "main", duration: 480 });

  assert.throws(
    () => runMechanismAction("M03-1", "bid", s, inst, { player: "A", amount: 1 }),
    (e) => e.code === "MECH_ACTION_INVALID",
  );

  s = runMechanismAction("M03-1", "bid", s, inst, { player: "A", amount: 5, bidId: "b1" });
  assert.equal(s.mechanism.leaderBidId, "b1");
  assert.equal(s.players.A.resources.currency, 95);

  s = runMechanismAction("M03-1", "bid", s, inst, { player: "B", amount: 8, bidId: "b2" });
  assert.equal(s.players.A.resources.currency, 100); // 旧领先者解冻
  assert.equal(s.players.B.resources.currency, 92);
  assert.equal(s.mechanism.leaderBidId, "b2");
  assert.equal(s.clocks.main.remaining, 15); // 补时

  s = settleMechanism("M03-1", s, inst);
  assert.equal(s.mechanism.result.status, "SOLD");
  assert.equal(s.mechanism.result.winner, "B");
  assert.equal(s.mechanism.result.paid, 8);
  assert.equal(s.players.B.resources.currency, 92); // 100 - 8
  assert.ok(s.players.B.held.includes("lot1"));
});

test("M03-1 明拍：无人出价流拍", () => {
  const inst = instantiateMechanism("M03-1", { start_price: 2, lot: "lot1" });
  const s = settleMechanism("M03-1", initMechanismState("M03-1", { players: ["A", "B"] }), inst);
  assert.equal(s.mechanism.result.status, "NO_SALE");
});

test("M03-2 暗标：第二价格成交（胜者付第二高价 + 1）", () => {
  const inst = instantiateMechanism("M03-2", { price_rule: "second", min_bid: 0, freeze_asset: "currency", lot: "lot1" });
  let s = withCurrency(initMechanismState("M03-2", { players: ["A", "B", "C"], capacity: { currency: 100 } }), ["A", "B", "C"], 100);

  s = runMechanismAction("M03-2", "submit", s, inst, { player: "A", amount: 10, sealedKey: "lot" });
  s = runMechanismAction("M03-2", "submit", s, inst, { player: "B", amount: 6, sealedKey: "lot" });

  s = settleMechanism("M03-2", s, inst);
  assert.equal(s.mechanism.result.status, "SOLD");
  assert.equal(s.mechanism.result.winner, "A");
  assert.equal(s.mechanism.result.price, 7); // min(10, 6+1)
  assert.equal(s.players.A.resources.currency, 93);
  assert.equal(s.players.B.resources.currency, 100); // 败者退款
  assert.ok(s.players.A.held.includes("lot1"));
});

test("M03-2 暗标：最高价并列触发二次报价", () => {
  const inst = instantiateMechanism("M03-2", { price_rule: "second" });
  let s = withCurrency(initMechanismState("M03-2", { players: ["A", "B"], capacity: { currency: 100 } }), ["A", "B"], 100);

  s = runMechanismAction("M03-2", "submit", s, inst, { player: "A", amount: 10, sealedKey: "lot" });
  s = runMechanismAction("M03-2", "submit", s, inst, { player: "B", amount: 10, sealedKey: "lot" });

  s = settleMechanism("M03-2", s, inst);
  assert.equal(s.mechanism.result.status, "TIE");
  assert.equal(s.mechanism.result.needsRebid, true);
  assert.deepEqual(s.mechanism.result.tiedPlayers.sort(), ["A", "B"]);
  assert.equal(s.players.A.resources.currency, 100); // 双方退款
  assert.equal(s.players.B.resources.currency, 100);
});

test("M03-2 暗标：截止前可修改报价", () => {
  const inst = instantiateMechanism("M03-2", { min_bid: 0 });
  let s = withCurrency(initMechanismState("M03-2", { players: ["A"], capacity: { currency: 100 } }), ["A"], 100);

  s = runMechanismAction("M03-2", "submit", s, inst, { player: "A", amount: 3, sealedKey: "lot" });
  s = runMechanismAction("M03-2", "submit", s, inst, { player: "A", amount: 9, sealedKey: "lot" });
  assert.equal(s.players.A.resources.currency, 91); // 旧报价退款后重新冻结 9
  assert.equal(s.sealedSubmissions.lot.A, 9);
});

test("机制文档完整：39 个成品机制均声明 schema", () => {
  const docs = listMechanismDocuments();
  assert.equal(docs.length, 39);
  for (const doc of docs) {
    assert.ok(doc.name, `${doc.template_id} 缺少名称`);
    assert.ok(doc.legal_actions.length > 0, `${doc.template_id} 缺少合法操作`);
    assert.ok(doc.locked_rules.length > 0, `${doc.template_id} 缺少锁定规则`);
    assert.ok(Array.isArray(doc.composition), `${doc.template_id} 缺少组合声明`);
    assert.ok(Object.keys(doc.editable_params).length > 0, `${doc.template_id} 缺少可调参数`);
    assert.ok(doc.output_fields.length > 0, `${doc.template_id} 缺少输出字段`);
  }
  assert.deepEqual(listMechanismDocuments().find((d) => d.template_id === "M03-1").composition.sort(), ["BID", "TIMER"]);
  assert.deepEqual(listMechanismDocuments().find((d) => d.template_id === "M03-2").composition.sort(), ["BID", "SEALED_CHOICE"]);
  assert.deepEqual(listMechanismDocuments().find((d) => d.template_id === "M02-3").composition.sort(), ["TIMER", "TRANSFER"]);
  assert.deepEqual(listMechanismDocuments().find((d) => d.template_id === "M02-6").composition, ["SEALED_CHOICE"]);
  assert.deepEqual(listMechanismDocuments().find((d) => d.template_id === "M09-1").composition.sort(), ["TIMER", "VOTE"]);
  assert.deepEqual(listMechanismDocuments().find((d) => d.template_id === "M09-5").composition, ["VOTE"]);
});

test("M02-2 固定比率兑换：按比率换资源、库存与次数限制", () => {
  const inst = instantiateMechanism("M02-2", {
    exchange_rates: { "currency:item": 2 },
    public_stock: { item: 5 },
    max_exchanges: 2,
  });
  let s = withPlayer(initMechanismState("M02-2", { players: ["A"], capacity: { currency: 100, item: 10 } }), "A", { resources: { currency: 20 } });

  s = runMechanismAction("M02-2", "exchange", s, inst, { player: "A", from_resource: "currency", to_resource: "item", want: 2 });
  assert.equal(s.players.A.resources.currency, 16);
  assert.equal(s.players.A.resources.item, 2);
  assert.equal(s.pools.item.total, 3);

  s = runMechanismAction("M02-2", "exchange", s, inst, { player: "A", from_resource: "currency", to_resource: "item", want: 1 });
  assert.equal(s.players.A.resources.item, 3);

  assert.throws(
    () => runMechanismAction("M02-2", "exchange", s, inst, { player: "A", from_resource: "currency", to_resource: "item", want: 1 }),
    (e) => e.code === "MECH_EXCHANGE_LIMIT",
  );
});

test("M02-2 余额不足或库存不足整单失败", () => {
  const poorInst = instantiateMechanism("M02-2", { exchange_rates: { "currency:item": 2 } });
  const poor = withPlayer(initMechanismState("M02-2", { players: ["A"], capacity: { currency: 10, item: 10 } }), "A", { resources: { currency: 3 } });
  assert.throws(
    () => runMechanismAction("M02-2", "exchange", poor, poorInst, { player: "A", from_resource: "currency", to_resource: "item", want: 2 }),
    (e) => e.code === "EFFECT_INSUFFICIENT",
  );
  const stockInst = instantiateMechanism("M02-2", { exchange_rates: { "currency:item": 2 }, public_stock: { item: 1 } });
  const stocked = withPlayer(initMechanismState("M02-2", { players: ["A"], capacity: { currency: 10, item: 10 } }), "A", { resources: { currency: 10 } });
  assert.throws(
    () => runMechanismAction("M02-2", "exchange", stocked, stockInst, { player: "A", from_resource: "currency", to_resource: "item", want: 2 }),
    (e) => e.code === "MECH_STOCK_EXHAUSTED",
  );
});

test("M02-3 双边密议：邀请/接受 + 密谈内双确认成交", () => {
  const inst = instantiateMechanism("M02-3", { resource_types: ["gold"], timing: "IMMEDIATE" });
  let s = withPlayer(initMechanismState("M02-3", { players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });

  s = runMechanismAction("M02-3", "invite", s, inst, { talkId: "t1", inviter: "A", invitee: "B" });
  assert.equal(s.talks.t1.status, "invited");
  assert.ok(s.clocks.t1);

  s = runMechanismAction("M02-3", "accept", s, inst, { talkId: "t1", player: "B" });
  assert.equal(s.talks.t1.status, "accepted");

  s = runMechanismAction("M02-3", "propose", s, inst, { transferId: "tx1", resource: "gold", amount: 4, from: "A", to: "B" });
  s = runMechanismAction("M02-3", "confirm", s, inst, { transferId: "tx1", by: "A" });
  s = runMechanismAction("M02-3", "confirm", s, inst, { transferId: "tx1", by: "B" });
  assert.equal(s.players.B.resources.gold, 4);

  s = settleMechanism("M02-3", s, inst);
  assert.equal(s.mechanism.result.talksAccepted, 1);
});

test("M02-4 公共报价板：发布报价并一键成交互换", () => {
  const inst = instantiateMechanism("M02-4", { resource_types: ["gold", "item"], max_offers_per_player: 2 });
  let s = initMechanismState("M02-4", { players: ["A", "B"], capacity: { gold: 10, item: 10 } });
  s = withPlayer(s, "A", { resources: { gold: 5 } });
  s = withPlayer(s, "B", { resources: { item: 3 } });

  s = runMechanismAction("M02-4", "offer", s, inst, { offerId: "o1", from: "A", give_resource: "gold", give_amount: 4, want_resource: "item", want_amount: 2 });
  assert.equal(s.offers.o1.status, "open");

  s = runMechanismAction("M02-4", "accept_offer", s, inst, { offerId: "o1", player: "B" });
  assert.equal(s.offers.o1.status, "settled");
  assert.equal(s.players.A.resources.gold, 1);
  assert.equal(s.players.B.resources.gold, 4);
  assert.equal(s.players.A.resources.item, 2);
  assert.equal(s.players.B.resources.item, 1);

  s = settleMechanism("M02-4", s, inst);
  assert.equal(s.mechanism.result.settled, 1);
});

test("M02-5 受限转移：借用一次传递 + 阶段末自动返还", () => {
  const inst = instantiateMechanism("M02-5", { resource_types: ["gold"], max_transfers: 1, allow_borrow: true });
  let s = withPlayer(initMechanismState("M02-5", { players: ["A", "B"], capacity: { gold: 10 } }), "A", { resources: { gold: 10 } });

  s = runMechanismAction("M02-5", "transfer", s, inst, { transferId: "tx1", contract: "borrow", resource: "gold", amount: 4, from: "A", to: "B" });
  s = runMechanismAction("M02-5", "confirm", s, inst, { transferId: "tx1", by: "A" });
  s = runMechanismAction("M02-5", "confirm", s, inst, { transferId: "tx1", by: "B" });
  assert.equal(s.players.B.resources.gold, 4);

  s = settleMechanism("M02-5", s, inst);
  assert.equal(s.players.B.resources.gold, 0);
  assert.equal(s.players.A.resources.gold, 10);
  assert.equal(s.mechanism.result.borrowReturns[0].returned, true);
});

test("M02-5 交换合同互换并计入一次传递上限", () => {
  const inst = instantiateMechanism("M02-5", { resource_types: ["gold", "item"], max_transfers: 1 });
  let s = initMechanismState("M02-5", { players: ["A", "B"], capacity: { gold: 10, item: 10 } });
  s = withPlayer(s, "A", { resources: { gold: 5 } });
  s = withPlayer(s, "B", { resources: { item: 3 } });

  s = runMechanismAction("M02-5", "exchange", s, inst, { from: "A", to: "B", give_resource: "gold", give_amount: 2, want_resource: "item", want_amount: 1 });
  assert.equal(s.players.A.resources.gold, 3);
  assert.equal(s.players.B.resources.gold, 2);
  assert.equal(s.players.A.resources.item, 1);
  assert.equal(s.players.B.resources.item, 2);

  assert.throws(
    () => runMechanismAction("M02-5", "exchange", s, inst, { from: "A", to: "B", give_resource: "gold", give_amount: 1, want_resource: "item", want_amount: 1 }),
    (e) => e.code === "MECH_TRANSFER_LIMIT",
  );
});

test("M02-6 共享资源池：投入增加池量，最终映射档位", () => {
  const inst = instantiateMechanism("M02-6", { pool_resource: "gold", initial_pool: 5, rounds: 1, max_deposit_per_round: 2, thresholds: { A: 9, B: 7, C: 5, D: 0 } });
  let s = initMechanismState("M02-6", { players: ["A", "B"], capacity: { gold: 20 } });
  s = withPlayer(s, "A", { resources: { gold: 10 } });
  s = withPlayer(s, "B", { resources: { gold: 10 } });

  s = runMechanismAction("M02-6", "choose", s, inst, { player: "A", action: "deposit", amount: 2, round: 0 });
  s = runMechanismAction("M02-6", "choose", s, inst, { player: "B", action: "deposit", amount: 1, round: 0 });
  s = runMechanismAction("M02-6", "resolve_round", s, inst, { round: 0 });
  assert.equal(s.pools.reserve.total, 8);
  assert.equal(s.players.A.resources.gold, 8);
  assert.equal(s.players.B.resources.gold, 9);

  s = settleMechanism("M02-6", s, inst);
  assert.equal(s.mechanism.result.poolTotal, 8);
  assert.equal(s.mechanism.result.tier, "B");
});

test("M02-6 取出超过库存时等比例满足", () => {
  const inst = instantiateMechanism("M02-6", { pool_resource: "gold", initial_pool: 1, rounds: 1, max_withdraw_per_round: 2 });
  let s = initMechanismState("M02-6", { players: ["A", "B"], capacity: { gold: 20 }, rng: () => 0.01 });
  s = runMechanismAction("M02-6", "choose", s, inst, { player: "A", action: "withdraw", amount: 2, round: 0 });
  s = runMechanismAction("M02-6", "choose", s, inst, { player: "B", action: "withdraw", amount: 2, round: 0 });
  s = runMechanismAction("M02-6", "resolve_round", s, inst, { round: 0 });
  const totalGranted = (s.players.A.resources.gold || 0) + (s.players.B.resources.gold || 0);
  assert.equal(totalGranted, 1);
  assert.equal(s.pools.reserve.total, 0);
});

test("M03-3 降价竞拍：首个购买者成交，价格随时间下降", () => {
  const inst = instantiateMechanism("M03-3", { start_price: 12, floor_price: 1, step: 1, freeze_asset: "currency", lot: "lot1" });
  let s = withCurrency(initMechanismState("M03-3", { players: ["A", "B"], capacity: { currency: 100 } }), ["A", "B"], 100);

  s = runMechanismAction("M03-3", "descend", s, inst);
  s = runMechanismAction("M03-3", "descend", s, inst);
  s = runMechanismAction("M03-3", "buy", s, inst, { player: "A" });
  assert.equal(s.mechanism.status, "sold");
  assert.equal(s.players.A.resources.currency, 90);
  assert.ok(s.players.A.held.includes("lot1"));

  assert.throws(() => runMechanismAction("M03-3", "buy", s, inst, { player: "B" }), (e) => e.code === "MECH_ALREADY_SOLD");

  s = settleMechanism("M03-3", s, inst);
  assert.equal(s.mechanism.result.status, "SOLD");
  assert.equal(s.mechanism.result.paid, 10);
});

test("M03-4 连续拍卖：逐件成交并共享预算", () => {
  const inst = instantiateMechanism("M03-4", { lots: ["lot1", "lot2"], start_price: 2, min_increment: 1, freeze_asset: "currency" });
  let s = withCurrency(initMechanismState("M03-4", { players: ["A", "B"], capacity: { currency: 100 } }), ["A", "B"], 100);

  s = runMechanismAction("M03-4", "bid", s, inst, { player: "A", amount: 3, bidId: "b1" });
  s = runMechanismAction("M03-4", "advance", s, inst);
  assert.equal(s.mechanism.currentLot, 1);
  assert.equal(s.players.A.resources.currency, 97);
  assert.ok(s.players.A.held.includes("lot1"));

  s = runMechanismAction("M03-4", "bid", s, inst, { player: "B", amount: 5, bidId: "b2" });
  s = settleMechanism("M03-4", s, inst);
  assert.equal(s.mechanism.result.perLot.length, 2);
  assert.equal(s.mechanism.result.perLot[1].winner, "B");
  assert.equal(s.players.B.resources.currency, 95);
  assert.ok(s.players.B.held.includes("lot2"));
});

test("M03-5 非货币竞价：按换算分胜出，败者退款", () => {
  const inst = instantiateMechanism("M03-5", {
    payable_assets: ["act", "mark"],
    conversion_table: { act: 2, mark: 3 },
    per_asset_cap: { act: 3 },
    lot: "lot1",
  });
  let s = initMechanismState("M03-5", { players: ["A", "B"], capacity: {} });
  s = withPlayer(s, "A", { resources: { act: 5, mark: 2 } });
  s = withPlayer(s, "B", { resources: { act: 5, mark: 2 } });

  s = runMechanismAction("M03-5", "submit_bid", s, inst, { player: "A", commitments: { act: 2, mark: 2 } });
  s = runMechanismAction("M03-5", "submit_bid", s, inst, { player: "B", commitments: { act: 3 } });

  s = settleMechanism("M03-5", s, inst);
  assert.equal(s.mechanism.result.status, "SOLD");
  assert.equal(s.mechanism.result.winner, "A");
  assert.equal(s.mechanism.result.score, 10);
  assert.equal(s.players.A.resources.act, 3);
  assert.equal(s.players.A.resources.mark, 0);
  assert.equal(s.players.B.resources.act, 5);
  assert.ok(s.players.A.held.includes("lot1"));
});

test("M03-5 平票触发二次报价并退款", () => {
  const inst = instantiateMechanism("M03-5", { payable_assets: ["act"], conversion_table: { act: 2 }, lot: "lot1" });
  let s = initMechanismState("M03-5", { players: ["A", "B"], capacity: {} });
  s = withPlayer(s, "A", { resources: { act: 5 } });
  s = withPlayer(s, "B", { resources: { act: 5 } });
  s = runMechanismAction("M03-5", "submit_bid", s, inst, { player: "A", commitments: { act: 2 } });
  s = runMechanismAction("M03-5", "submit_bid", s, inst, { player: "B", commitments: { act: 2 } });
  s = settleMechanism("M03-5", s, inst);
  assert.equal(s.mechanism.result.status, "TIE");
  assert.equal(s.players.A.resources.act, 5);
  assert.equal(s.players.B.resources.act, 5);
});

test("M04-1 二十一点：发牌、庄家补牌、玩家胜庄家扣庄家耐久", () => {
  const inst = instantiateMechanism("M04-1", {
    initial_durability: 10,
    win_damage: 2,
    lose_damage: 3,
    dealer_stand_at: 17,
    dealer_durability: 20,
    card_points: { "10": 10, "7": 7, "5": 5 },
    deck: ["10", "7", "10", "10", "5", "10"],
  });
  let s = initMechanismState("M04-1", { players: ["A", "B"], capacity: {}, rng: () => 0.999 });
  s = runMechanismAction("M04-1", "new_game", s, inst);
  s = runMechanismAction("M04-1", "deal", s, inst);
  assert.equal(s.players.A.held.length, 2);
  assert.equal(s.players.B.held.length, 2);
  s = runMechanismAction("M04-1", "resolve_round", s, inst);
  // 庄家 [5,10]=15，A=17、B=20 均胜
  assert.equal(s.mechanism.roundResult.dealer, 15);
  assert.equal(s.mechanism.dealerDurability, 16);
  assert.equal(s.players.A.score, 1);
  assert.equal(s.players.B.score, 1);
  const settled = settleMechanism("M04-1", s, inst);
  assert.equal(settled.mechanism.result.status, "SETTLED");
  assert.equal(settled.mechanism.result.rank.length, 2);
});

test("M04-2 极限耐受：成功得积分、失败增加承受并消耗保护", () => {
  const inst = instantiateMechanism("M04-2", { max_endurance: 10, protection_count: 1, protection_reduce: 2 });
  let s = initMechanismState("M04-2", { players: ["A", "B"], capacity: {}, rng: () => 0.5 });
  s = runMechanismAction("M04-2", "submit", s, inst, { player: "A", level: 2, round: 0 });
  s = runMechanismAction("M04-2", "submit", s, inst, { player: "B", level: 3, round: 0 });
  s = runMechanismAction("M04-2", "resolve_round", s, inst, { round: 0 });
  assert.equal(s.players.A.score, 2); // 等级2成功（0.5 < 0.75）
  assert.equal(s.players.B.score, 0); // 等级3失败（0.5 不 < 0.5）
  assert.equal(s.mechanism.stats.B.endurance, 2); // 失败增4，保护减2
  assert.equal(s.mechanism.protectionLeft.B, 0);
  const settled = settleMechanism("M04-2", s, inst);
  assert.equal(settled.mechanism.result.rank[0].player, "A");
});

test("M04-3 三式博弈：进取克迂回得 2 分", () => {
  const inst = instantiateMechanism("M04-3", {});
  let s = initMechanismState("M04-3", { players: ["A", "B"], capacity: {} });
  s = runMechanismAction("M04-3", "submit", s, inst, { player: "A", stance: "advance", target: "B", round: 0 });
  s = runMechanismAction("M04-3", "submit", s, inst, { player: "B", stance: "flank", target: "A", round: 0 });
  s = runMechanismAction("M04-3", "resolve_round", s, inst, { round: 0 });
  assert.equal(s.players.A.score, 2);
  assert.equal(s.players.B.score, 0);
});

test("M04-3 三式博弈：同姿态各得 1 分", () => {
  const inst = instantiateMechanism("M04-3", {});
  let s = initMechanismState("M04-3", { players: ["A", "B"], capacity: {} });
  s = runMechanismAction("M04-3", "submit", s, inst, { player: "A", stance: "advance", target: "B", round: 0 });
  s = runMechanismAction("M04-3", "submit", s, inst, { player: "B", stance: "advance", target: "A", round: 0 });
  s = runMechanismAction("M04-3", "resolve_round", s, inst, { round: 0 });
  assert.equal(s.players.A.score, 2); // 各自作为攻击方与守方各 +1
  assert.equal(s.players.B.score, 2);
});

test("M04-4 轮选资源：顺序选资源并按基础分结算", () => {
  const inst = instantiateMechanism("M04-4", {
    rounds: 3,
    extra_resources: 2,
    resources: ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10", "r11", "r12"],
    resource_score: { r1: 1, r2: 2, r3: 3, r4: 4 },
  });
  let s = initMechanismState("M04-4", { players: ["A", "B"], capacity: {}, rng: () => 0.999 });
  s = runMechanismAction("M04-4", "start_round", s, inst, { round: 0 });
  assert.deepEqual(s.mechanism.order, ["A", "B"]);
  s = runMechanismAction("M04-4", "draft", s, inst, { player: "A", resource: "r4" });
  s = runMechanismAction("M04-4", "draft", s, inst, { player: "B", resource: "r3" });
  const settled = settleMechanism("M04-4", s, inst);
  assert.equal(settled.mechanism.result.rank[0].player, "A");
  assert.equal(settled.mechanism.result.rank[0].score, 4);
  assert.equal(settled.mechanism.result.rank[1].score, 3);
});

test("M04-5 止盈阶梯：登顶锁定满收益，退出锁定当前层", () => {
  const inst = instantiateMechanism("M04-5", { layers: 2, success_probs: [1, 1], rewards: [1, 3] });
  let s = initMechanismState("M04-5", { players: ["A", "B"], capacity: {}, rng: () => 0 });
  s = runMechanismAction("M04-5", "submit", s, inst, { player: "A", action: "continue", round: 0 });
  s = runMechanismAction("M04-5", "submit", s, inst, { player: "B", action: "exit", round: 0 });
  s = runMechanismAction("M04-5", "resolve_round", s, inst, { round: 0 });
  s = runMechanismAction("M04-5", "submit", s, inst, { player: "A", action: "continue", round: 1 });
  s = runMechanismAction("M04-5", "resolve_round", s, inst, { round: 1 });
  const settled = settleMechanism("M04-5", s, inst);
  const a = settled.mechanism.result.rank.find((r) => r.player === "A");
  const b = settled.mechanism.result.rank.find((r) => r.player === "B");
  assert.equal(a.locked, 3);
  assert.equal(a.status, "capped");
  assert.equal(b.locked, 1);
  assert.equal(b.status, "exited");
});

test("M04-6 区间侦测：服务器目标、公开高低反馈、私密区间、命中", () => {
  const inst = instantiateMechanism("M04-6", { range_min: 1, range_max: 100, public_probes: 8, private_width: 20 });
  let s = initMechanismState("M04-6", { players: ["A"], capacity: {}, rng: () => 0 });
  s = runMechanismAction("M04-6", "new_game", s, inst);
  assert.equal(s.mechanism.target, 1); // 1 + floor(0 * 100)
  s = runMechanismAction("M04-6", "probe_public", s, inst, { number: 50 });
  assert.equal(s.mechanism.hi, 49); // 50 偏高
  s = runMechanismAction("M04-6", "probe_private", s, inst, { player: "A", lo: 1 });
  assert.equal(s.mechanism.privateResults.A.inside, true);
  s = runMechanismAction("M04-6", "probe_public", s, inst, { number: 1, player: "A" });
  assert.equal(s.mechanism.hitBy, "A");
  const settled = settleMechanism("M04-6", s, inst);
  assert.equal(settled.mechanism.result.hit, true);
});

test("M04-7 接力积分：随机分队、冒险档贡献与胜队判定", () => {
  const inst = instantiateMechanism("M04-7", {
    sturdy_value: 1,
    standard_value: 2,
    standard_prob: 0.8,
    risky_value: 4,
    risky_prob: 0.5,
  });
  let s = initMechanismState("M04-7", { players: ["A", "B", "C", "D"], capacity: {}, rng: () => 0 });
  s = runMechanismAction("M04-7", "new_game", s, inst);
  // rng=0 → Fisher-Yates 每次 j=0：["A","B","C","D"] → ["B","C","D","A"]
  assert.deepEqual(s.mechanism.teams.A, ["B", "C"]);
  assert.deepEqual(s.mechanism.teams.B, ["D", "A"]);
  s = runMechanismAction("M04-7", "submit", s, inst, { player: "B", tier: "risky", round: 0 });
  s = runMechanismAction("M04-7", "submit", s, inst, { player: "C", tier: "risky", round: 0 });
  s = runMechanismAction("M04-7", "submit", s, inst, { player: "D", tier: "sturdy", round: 0 });
  s = runMechanismAction("M04-7", "submit", s, inst, { player: "A", tier: "sturdy", round: 0 });
  s = runMechanismAction("M04-7", "resolve_round", s, inst, { round: 0 });
  assert.equal(s.mechanism.teamScore.A, 8); // B、C 冒险档均成功（0 < 0.5）
  assert.equal(s.mechanism.teamScore.B, 2);
  const settled = settleMechanism("M04-7", s, inst);
  assert.equal(settled.mechanism.result.winner, "A");
});

test("M05-1 组合提交台：投入组件集齐多组并结算档位", () => {
  const inst = instantiateMechanism("M05-1", {
    tier_labels: ["D", "C", "B", "A"],
    groups: [
      { id: "g1", required: { core: 1, trait: 1 }, result: "R1" },
      { id: "g2", required: { proof: 2 }, result: "R2" },
    ],
  });
  let s = initMechanismState("M05-1", { players: ["A", "B"], capacity: {} });
  s = withPlayer(s, "A", { held: ["core:1", "trait:1"] });
  s = withPlayer(s, "B", { held: ["proof:1", "proof:2"] });
  s = runMechanismAction("M05-1", "setup", s, inst);
  s = runMechanismAction("M05-1", "contribute", s, inst, { player: "A", group: "g1", component: "core:1" });
  s = runMechanismAction("M05-1", "contribute", s, inst, { player: "A", group: "g1", component: "trait:1" });
  s = runMechanismAction("M05-1", "resolve_group", s, inst, { group: "g1" });
  s = runMechanismAction("M05-1", "contribute", s, inst, { player: "B", group: "g2", component: "proof:1" });
  s = runMechanismAction("M05-1", "contribute", s, inst, { player: "B", group: "g2", component: "proof:2" });
  s = runMechanismAction("M05-1", "resolve_group", s, inst, { group: "g2" });
  const settled = settleMechanism("M05-1", s, inst);
  assert.equal(settled.mechanism.result.completedGroups, 2);
  assert.equal(settled.mechanism.result.tier, "B");
});

test("M05-2 序列复原：提交正确顺序得 A 档", () => {
  const inst = instantiateMechanism("M05-2", { fragments: ["f1", "f2", "f3"], max_submissions: 3 });
  let s = initMechanismState("M05-2", { players: ["A"], capacity: {}, rng: () => 0 });
  s = runMechanismAction("M05-2", "new_game", s, inst);
  // rng=0 → shuffle 结果 target = ["f2","f3","f1"]
  assert.deepEqual(s.mechanism.target, ["f2", "f3", "f1"]);
  s = runMechanismAction("M05-2", "submit", s, inst, { order: ["f2", "f3", "f1"] });
  assert.equal(s.mechanism.best.correctPos, 3);
  const settled = settleMechanism("M05-2", s, inst);
  assert.equal(settled.mechanism.result.tier, "A");
});

test("M05-3 线路拼图：入口连通出口计分", () => {
  const inst = instantiateMechanism("M05-3", {
    board_size: 2,
    entrance: { x: 0, y: 0 },
    exits: [{ x: 1, y: 1 }],
    max_tiles: 4,
    tiles: [
      { id: "t1", ports: [0, 1, 0, 0] },
      { id: "t2", ports: [0, 0, 1, 1] },
      { id: "t3", ports: [1, 1, 0, 0] },
    ],
  });
  let s = initMechanismState("M05-3", { players: ["A"], capacity: {} });
  s = runMechanismAction("M05-3", "place", s, inst, { tile: "t1", x: 0, y: 0, rotation: 0 });
  s = runMechanismAction("M05-3", "place", s, inst, { tile: "t2", x: 1, y: 0, rotation: 0 });
  s = runMechanismAction("M05-3", "place", s, inst, { tile: "t3", x: 1, y: 1, rotation: 0 });
  s = runMechanismAction("M05-3", "submit", s, inst);
  assert.equal(s.mechanism.linkedExits, 1);
  const settled = settleMechanism("M05-3", s, inst);
  assert.equal(settled.mechanism.result.linkedExits, 1);
});

test("M05-4 接口矩阵：拖入组件满足接口并结算档位", () => {
  const inst = instantiateMechanism("M05-4", {
    required_matches: 2,
    tier_labels: ["D", "C", "B", "A"],
    interfaces: [
      { id: "i1", require: { color: "red", shape: "circle" } },
      { id: "i2", require: { color: "blue", value: "5" } },
    ],
    component_tags: {
      c1: { color: "red", shape: "circle", value: "1", source: "x" },
      c2: { color: "red", shape: "square", value: "2", source: "y" },
    },
  });
  let s = initMechanismState("M05-4", { players: ["A"], capacity: {} });
  s = withPlayer(s, "A", { held: ["c1", "c2"] });
  s = runMechanismAction("M05-4", "assign", s, inst, { player: "A", component: "c1", interface: "i1" });
  assert.equal(s.mechanism.assignments.i1.satisfied, true);
  s = runMechanismAction("M05-4", "assign", s, inst, { player: "A", component: "c2", interface: "i2" });
  assert.equal(s.mechanism.assignments.i2.satisfied, false);
  s = runMechanismAction("M05-4", "submit", s, inst);
  assert.equal(s.mechanism.satisfiedCount, 1);
  const settled = settleMechanism("M05-4", s, inst);
  assert.equal(settled.mechanism.result.tier, "C");
});

test("M05-5 配方网络：核心件与通用件两种配方完成目标", () => {
  const inst = instantiateMechanism("M05-5", {
    targets: [{ id: "t1", result: "R1" }, { id: "t2", result: "R2" }],
  });
  let s = initMechanismState("M05-5", { players: ["A"], capacity: {} });
  s = withPlayer(s, "A", { resources: { core: 2, generic: 4 } });
  s = runMechanismAction("M05-5", "craft", s, inst, { player: "A", target: "t1", recipe: "core" });
  assert.equal(s.players.A.resources.core, 1);
  s = runMechanismAction("M05-5", "craft", s, inst, { player: "A", target: "t2", recipe: "generic" });
  assert.equal(s.players.A.resources.generic, 1);
  const settled = settleMechanism("M05-5", s, inst);
  assert.equal(settled.mechanism.result.completedTargets, 2);
});

test("M05-6 递进组件：两阶段拼接得到最终方案", () => {
  const inst = instantiateMechanism("M05-6", {
    part_resource: "part",
    stage1_targets: [{ id: "s1", result: "A" }, { id: "s2", result: "B" }, { id: "s3", result: "C" }],
    stage1_cost: 2,
    stage2_options: [{ id: "f1", result: "FINAL" }],
  });
  let s = initMechanismState("M05-6", { players: ["A"], capacity: {} });
  s = withPlayer(s, "A", { resources: { part: 5 } });
  s = runMechanismAction("M05-6", "produce_stage1", s, inst, { player: "A", stage1: "s1" });
  s = runMechanismAction("M05-6", "produce_stage1", s, inst, { player: "A", stage1: "s2" });
  assert.equal(s.players.A.resources.part, 1);
  assert.deepEqual(s.players.A.held, ["A", "B"]);
  s = runMechanismAction("M05-6", "combine_stage2", s, inst, { player: "A", option: "f1", mid1: "A", mid2: "B" });
  assert.deepEqual(s.players.A.held, []);
  const settled = settleMechanism("M05-6", s, inst);
  assert.equal(settled.mechanism.result.tier, "HIGH");
});

test("M09-1 最小环：投/改票 → 多数胜出", () => {
  const inst = instantiateMechanism("M09-1", { candidates: ["X", "Y", "Z"] });
  let s = initMechanismState("M09-1", { players: ["A", "B", "C", "D"] });
  s = runMechanismAction("M09-1", "vote", s, inst, { player: "A", choice: "X" });
  s = runMechanismAction("M09-1", "vote", s, inst, { player: "B", choice: "Y" });
  s = runMechanismAction("M09-1", "vote", s, inst, { player: "C", choice: "X" });
  s = runMechanismAction("M09-1", "vote", s, inst, { player: "B", choice: "X" });
  const settled = settleMechanism("M09-1", s, inst);
  assert.equal(settled.mechanism.result.status, "DECIDED");
  assert.equal(settled.mechanism.result.winner, "X");
  assert.equal(settled.mechanism.result.counts.X, 3);
  assert.equal(settled.ballotLocked.main, true);
});

test("M09-1 最小环：有效票为 0 → NO_DECISION；平票 → TIE", () => {
  const inst = instantiateMechanism("M09-1", { candidates: ["X", "Y"] });
  const empty = settleMechanism("M09-1", initMechanismState("M09-1", { players: ["A", "B"] }), inst);
  assert.equal(empty.mechanism.result.status, "NO_DECISION");

  let s = initMechanismState("M09-1", { players: ["A", "B"] });
  s = runMechanismAction("M09-1", "vote", s, inst, { player: "A", choice: "X" });
  s = runMechanismAction("M09-1", "vote", s, inst, { player: "B", choice: "Y" });
  const tied = settleMechanism("M09-1", s, inst);
  assert.equal(tied.mechanism.result.status, "TIE");
  assert.deepEqual(tied.mechanism.result.tied.sort(), ["X", "Y"]);
});

test("M09-2 最小环：三分之二门槛通过 / 未达门槛失败", () => {
  const inst = instantiateMechanism("M09-2", { threshold_ratio: 2 / 3, abstain_in_denominator: false });
  let s = initMechanismState("M09-2", { players: ["A", "B", "C"] });
  s = runMechanismAction("M09-2", "vote", s, inst, { player: "A", choice: "aye" });
  s = runMechanismAction("M09-2", "vote", s, inst, { player: "B", choice: "aye" });
  s = runMechanismAction("M09-2", "vote", s, inst, { player: "C", choice: "nay" });
  const passed = settleMechanism("M09-2", s, inst);
  assert.equal(passed.mechanism.result.status, "PASSED");
  assert.equal(passed.mechanism.result.threshold, 2);

  let f = initMechanismState("M09-2", { players: ["A", "B", "C"] });
  f = runMechanismAction("M09-2", "vote", f, inst, { player: "A", choice: "aye" });
  f = runMechanismAction("M09-2", "vote", f, inst, { player: "B", choice: "nay" });
  f = runMechanismAction("M09-2", "vote", f, inst, { player: "C", choice: "nay" });
  assert.equal(settleMechanism("M09-2", f, inst).mechanism.result.status, "FAILED");
});

test("M09-3 最小环：IRV 淘汰末位并转移至过半", () => {
  const inst = instantiateMechanism("M09-3", { candidates: ["A", "B", "C"] });
  let s = initMechanismState("M09-3", { players: ["P1", "P2", "P3", "P4", "P5"] });
  s = runMechanismAction("M09-3", "vote", s, inst, { player: "P1", ranking: ["A", "B", "C"] });
  s = runMechanismAction("M09-3", "vote", s, inst, { player: "P2", ranking: ["A", "C", "B"] });
  s = runMechanismAction("M09-3", "vote", s, inst, { player: "P3", ranking: ["B", "A", "C"] });
  s = runMechanismAction("M09-3", "vote", s, inst, { player: "P4", ranking: ["B", "C", "A"] });
  s = runMechanismAction("M09-3", "vote", s, inst, { player: "P5", ranking: ["C", "A", "B"] });
  const settled = settleMechanism("M09-3", s, inst);
  assert.equal(settled.mechanism.result.status, "DECIDED");
  assert.equal(settled.mechanism.result.winner, "A");
  assert.ok(settled.mechanism.result.rounds.length >= 2);
});

test("M09-4 最小环：达阈值保留，边界平票 TIED_PENDING_RULE", () => {
  const inst = instantiateMechanism("M09-4", {
    candidates: ["A", "B", "C", "D"],
    max_selections: 2,
    retain_ratio: 0.4,
    max_retain: 2,
  });
  let s = initMechanismState("M09-4", { players: ["P1", "P2", "P3", "P4", "P5"] });
  s = runMechanismAction("M09-4", "vote", s, inst, { player: "P1", selections: ["A", "B"] });
  s = runMechanismAction("M09-4", "vote", s, inst, { player: "P2", selections: ["A", "C"] });
  s = runMechanismAction("M09-4", "vote", s, inst, { player: "P3", selections: ["A", "B"] });
  s = runMechanismAction("M09-4", "vote", s, inst, { player: "P4", selections: ["A", "C"] });
  s = runMechanismAction("M09-4", "vote", s, inst, { player: "P5", selections: ["A", "D"] });
  const settled = settleMechanism("M09-4", s, inst);
  assert.equal(settled.mechanism.result.status, "TIED_PENDING_RULE");
  assert.deepEqual(settled.mechanism.result.retained, ["A"]);
  assert.deepEqual(settled.mechanism.result.tied.sort(), ["B", "C"]);
});

test("M09-5 最小环：票权拆分投入并消耗", () => {
  const inst = instantiateMechanism("M09-5", { candidates: ["X", "Y"], vote_power: 3, clear_unused: true });
  let s = initMechanismState("M09-5", { players: ["A", "B"] });
  s = runMechanismAction("M09-5", "setup", s, inst, {});
  assert.equal(s.votePower.A, 3);
  s = runMechanismAction("M09-5", "vote", s, inst, { player: "A", allocations: { X: 2, Y: 1 } });
  s = runMechanismAction("M09-5", "vote", s, inst, { player: "B", allocations: { X: 3 } });
  assert.equal(s.votePower.A, 0);
  assert.equal(s.votePower.B, 0);
  const settled = settleMechanism("M09-5", s, inst);
  assert.equal(settled.mechanism.result.status, "DECIDED");
  assert.equal(settled.mechanism.result.winner, "X");
  assert.equal(settled.mechanism.result.counts.X, 5);
});

test("M09-6 最小环：普通表决后否决 → 替代分支", () => {
  const inst = instantiateMechanism("M09-6", {
    candidates: ["X", "Y"],
    veto_holders: { A: 1 },
    fallback_branch: "branch_alt",
    veto_window_seconds: 45,
  });
  let s = initMechanismState("M09-6", { players: ["A", "B", "C"] });
  s = runMechanismAction("M09-6", "setup", s, inst, {});
  s = runMechanismAction("M09-6", "vote", s, inst, { player: "A", choice: "X" });
  s = runMechanismAction("M09-6", "vote", s, inst, { player: "B", choice: "X" });
  s = runMechanismAction("M09-6", "vote", s, inst, { player: "C", choice: "Y" });
  s = runMechanismAction("M09-6", "open_veto_window", s, inst, {});
  assert.equal(s.mechanism.phase, "veto_window");
  s = runMechanismAction("M09-6", "veto", s, inst, { player: "A" });
  const settled = settleMechanism("M09-6", s, inst);
  assert.equal(settled.mechanism.result.status, "VETOED");
  assert.equal(settled.mechanism.result.vetoBy, "A");
  assert.equal(settled.mechanism.result.fallbackBranch, "branch_alt");
  assert.equal(settled.mechanism.result.original.winner, "X");
});

test("M09-7 最小环：组内多数成组票，再多数聚合", () => {
  const inst = instantiateMechanism("M09-7", {
    candidates: ["X", "Y"],
    groups: { G1: ["A", "B"], G2: ["C"], G3: ["D", "E"] },
    aggregate_mode: "majority",
  });
  let s = initMechanismState("M09-7", { players: ["A", "B", "C", "D", "E"] });
  s = runMechanismAction("M09-7", "vote", s, inst, { player: "A", choice: "X" });
  s = runMechanismAction("M09-7", "vote", s, inst, { player: "B", choice: "X" });
  s = runMechanismAction("M09-7", "vote", s, inst, { player: "C", choice: "Y" });
  s = runMechanismAction("M09-7", "vote", s, inst, { player: "D", choice: "X" });
  s = runMechanismAction("M09-7", "vote", s, inst, { player: "E", choice: "Y" });
  const settled = settleMechanism("M09-7", s, inst);
  assert.equal(settled.mechanism.result.groupResults.G1.choice, "X");
  assert.equal(settled.mechanism.result.groupResults.G2.choice, "Y");
  assert.equal(settled.mechanism.result.groupResults.G3.status, "ABSTAIN");
  assert.equal(settled.mechanism.result.status, "TIE");
});
