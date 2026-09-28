import assert from "node:assert/strict";
import test from "node:test";
import {
  createDominionStudyGame,
  dominionPrivateState,
  dominionPublicState,
  dominionScore,
  dispatchDominionCommand,
  getDominionCardDefinitions,
  getDominionKingdomIds,
  legalDominionCommands,
  restoreDominionState,
  runDominionReferenceTurn
  , serializeDominionState
  , validateDominionState
} from "../shared/dominion-study-replica.js";

const testCard = (cardId, uid) => ({ cardId, uid, name: cardId });

test("Dominion study replica creates the official base setup shape", () => {
  const state = createDominionStudyGame({ playerCount: 4, seed: 7 });
  assert.equal(getDominionKingdomIds().length, 26);
  assert.equal(state.kingdomIds.length, 10);
  assert.deepEqual(state.players.map((player) => player.hand.length), [5, 5, 5, 5]);
  assert.equal(state.players[0].deck.length, 5);
  assert.equal(state.supply.estate.count, 12);
  assert.equal(state.supply.curse.count, 30);
  assert.equal(state.supply.province.count, 12);
  assert.equal(state.players[0].phase, "action");
});

test("Dominion ABC flow plays treasure, buys, cleans up and passes the turn", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 11 });
  const player = state.players[0];
  const copperIds = player.hand.filter((card) => card.cardId === "copper").map((card) => card.uid);
  state = dispatchDominionCommand(state, { type: "end-action" }).state;
  state = dispatchDominionCommand(state, { type: "play-treasures", cardIds: copperIds }).state;
  assert.equal(state.players[0].coins, copperIds.length);
  state = dispatchDominionCommand(state, { type: "buy", cardId: "silver" }).state;
  state = dispatchDominionCommand(state, { type: "end-buy" }).state;
  assert.equal(state.activePlayerIndex, 1);
  assert.equal(state.players[1].phase, "action");
  assert.equal(state.players[0].hand.length, 0);
  assert.ok(state.players[0].discard.some((card) => card.cardId === "silver"));
});

test("Dominion private and public projections keep deck contents private", () => {
  const state = createDominionStudyGame({ playerCount: 3, seed: 13 });
  const privateView = dominionPrivateState(state, 0);
  assert.equal(privateView.players[0].hand.length, 5);
  assert.equal(privateView.players[1].hand.length, 0);
  assert.equal(privateView.players[1].deck.length, 0);
  const publicView = dominionPublicState(state);
  assert.equal(publicView.players[0].handCount, 5);
  assert.equal(publicView.players[0].hand, undefined);
  assert.equal(publicView.supply.province.count, 12);
});

test("every base Kingdom action has an executable resolver", () => {
  const definitions = getDominionCardDefinitions();
  for (const definition of Object.values(definitions).filter((item) => item.types.includes("action"))) {
    const state = createDominionStudyGame({ playerCount: 2, seed: 19 });
    state.players[0].hand.push({ uid: `coverage-${definition.id}`, cardId: definition.id, name: definition.name });
    const result = dispatchDominionCommand(state, { type: "play-action", cardId: `coverage-${definition.id}` });
    assert.equal(result.ok, true, `${definition.id} must resolve without an engine error`);
  }
});

test("reference AI can run a complete local Dominion game without illegal commands", () => {
  let state = createDominionStudyGame({ playerCount: 4, seed: 17 });
  let turns = 0;
  while (!state.ended && turns < 240) {
    const active = state.activePlayerIndex;
    const result = runDominionReferenceTurn(state, active);
    state = result.state;
    turns += 1;
    assert.ok(result.guard < 80, "reference turn exceeded the command safety guard");
  }
  assert.equal(state.ended, true);
  assert.ok(state.log.some((event) => event.type === "game-end"));
  assert.equal(dominionScore(state).length, 4);
});

function assertStateIntegrity(state) {
  const seen = new Set();
  for (const player of state.players) {
    assert.ok(player.actions >= 0);
    assert.ok(player.buys >= 0);
    assert.ok(player.coins >= 0);
    for (const zone of [player.deck, player.discard, player.hand, player.inPlay, player.setAside]) {
      for (const instance of zone) {
        assert.equal(seen.has(instance.uid), false, `duplicate card instance ${instance.uid}`);
        seen.add(instance.uid);
      }
    }
  }
  for (const instance of state.trash) {
    assert.equal(seen.has(instance.uid), false, `trashed card still exists in a player zone ${instance.uid}`);
    seen.add(instance.uid);
  }
  for (const pile of Object.values(state.supply)) assert.ok(pile.count >= 0);
}

test("step audit rejects phase skips and preserves the ABC order", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 23 });
  const player = state.players[0];
  const illegalBuy = dispatchDominionCommand(state, { type: "buy", cardId: "copper" });
  assert.equal(illegalBuy.ok, false);
  assert.equal(illegalBuy.code, "BUY_PHASE_REQUIRED");
  const illegalTreasure = dispatchDominionCommand(state, { type: "play-treasures", cardIds: player.hand.filter((card) => card.cardId === "copper").map((card) => card.uid) });
  assert.equal(illegalTreasure.ok, false);
  assert.equal(illegalTreasure.code, "BUY_PHASE_REQUIRED");
  state = dispatchDominionCommand(state, { type: "end-action" }).state;
  assert.equal(state.phase, "buy");
  assert.equal(state.players[0].phase, "buy");
  const copperIds = state.players[0].hand.filter((card) => card.cardId === "copper").map((card) => card.uid);
  state = dispatchDominionCommand(state, { type: "play-treasures", cardIds: copperIds }).state;
  assert.equal(state.players[0].coins, copperIds.length);
  state = dispatchDominionCommand(state, { type: "end-buy" }).state;
  assert.equal(state.activePlayerIndex, 1);
  assert.equal(state.phase, "action");
  assert.equal(state.players[0].phase, "waiting");
  assert.equal(state.players[1].phase, "action");
  assertStateIntegrity(state);
});

test("prompt steps resolve Chapel and attack reaction without duplicating cards", () => {
  let state = createDominionStudyGame({ playerCount: 3, seed: 29 });
  state.players[0].hand.push({ uid: "audit-chapel", cardId: "chapel", name: "Chapel" });
  state = dispatchDominionCommand(state, { type: "play-action", cardId: "audit-chapel" }).state;
  assert.equal(state.pendingPrompt.type, "select-hand-trash");
  const trashTarget = state.players[0].hand.find((card) => card.cardId === "estate");
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardIds: [trashTarget.uid] }).state;
  assert.equal(state.pendingPrompt, null);
  assert.ok(state.trash.some((card) => card.uid === trashTarget.uid));

  state = createDominionStudyGame({ playerCount: 3, seed: 31 });
  state.players[0].hand.push({ uid: "audit-witch", cardId: "witch", name: "Witch" });
  state.players[1].hand.push({ uid: "audit-moat", cardId: "moat", name: "Moat" });
  state = dispatchDominionCommand(state, { type: "play-action", cardId: "audit-witch" }).state;
  assert.equal(state.pendingPrompt.type, "select-reaction");
  state = dispatchDominionCommand(state, { type: "resolve-prompt", revealMoat: true }).state;
  assert.equal(state.pendingPrompt, null);
  assertStateIntegrity(state);
});

test("fifty reference games preserve state invariants", () => {
  for (let seed = 0; seed < 50; seed += 1) {
    let state = createDominionStudyGame({ playerCount: 4, seed: 500 + seed });
    let turns = 0;
    while (!state.ended && turns < 240) {
      state = runDominionReferenceTurn(state, state.activePlayerIndex).state;
      assertStateIntegrity(state);
      turns += 1;
    }
    assert.equal(state.ended, true, `seed ${seed} did not reach a legal end state`);
  }
});

test("save and restore preserves a pending prompt and command audit", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 61 });
  const chapel = testCard("chapel", "save-chapel");
  state.players[0].hand.push(chapel);
  state = dispatchDominionCommand(state, { type: "play-action", cardId: chapel.uid }).state;
  const serialized = serializeDominionState(state);
  const restored = restoreDominionState(serialized);
  assert.deepEqual(restored, state);
  assert.equal(validateDominionState(restored).ok, true);
  assert.ok(restored.log.some((event) => event.type === "command" && event.command.type === "play-action"));
});

test("Vassal can only play the revealed action, then discards it when declined", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 67 });
  const vassal = testCard("vassal", "response-vassal");
  const otherAction = testCard("village", "response-other-action");
  state.players[0].hand.push(vassal, otherAction);
  state.players[0].deck = [testCard("smithy", "response-revealed-smithy")];
  state = dispatchDominionCommand(state, { type: "play-action", cardId: vassal.uid }).state;
  assert.equal(state.pendingPrompt.type, "select-vassal-action");
  const illegal = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: otherAction.uid });
  assert.equal(illegal.ok, false);
  assert.equal(illegal.code, "VASSAL_REVEALED_CARD_REQUIRED");
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: "none" }).state;
  assert.equal(state.pendingPrompt, null);
  assert.ok(state.players[0].discard.some((item) => item.uid === "response-revealed-smithy"));
});

test("Throne Room resumes the second copy of a prompted action", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 71 });
  const throne = testCard("throne-room", "response-throne");
  const sentry = testCard("sentry", "response-sentry");
  state.players[0].hand.push(throne, sentry);
  state.players[0].deck = [
    testCard("copper", "response-copper-1"), testCard("copper", "response-copper-2"),
    testCard("copper", "response-copper-3"), testCard("copper", "response-copper-4")
  ];
  state = dispatchDominionCommand(state, { type: "play-action", cardId: throne.uid }).state;
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: sentry.uid }).state;
  assert.equal(state.pendingPrompt.type, "select-sentry-card");
  for (let index = 0; index < 2; index += 1) state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: state.pendingPrompt.cards[0].uid, choice: "discard" }).state;
  assert.equal(state.pendingPrompt.type, "select-sentry-card", "the second Throne Room repetition must still be pending");
  for (let index = 0; index < 2; index += 1) state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: state.pendingPrompt.cards[0].uid, choice: "discard" }).state;
  assert.equal(state.pendingPrompt, null);
  assert.equal(state.players[0].discard.filter((item) => item.cardId === "copper").length, 2);
  assertStateIntegrity(state);
});

test("Moat blocks one target but does not cancel the rest of a multi-target attack", () => {
  let state = createDominionStudyGame({ playerCount: 3, seed: 73 });
  const witch = testCard("witch", "response-witch");
  state.players[0].hand.push(witch);
  state.players[1].hand.push(testCard("moat", "response-moat"));
  state = dispatchDominionCommand(state, { type: "play-action", cardId: witch.uid }).state;
  assert.equal(state.pendingPrompt.playerIndex, 1);
  state = dispatchDominionCommand(state, { type: "resolve-prompt", revealMoat: true }).state;
  assert.equal(state.pendingPrompt, null);
  assert.equal(state.players[1].discard.filter((item) => item.cardId === "curse").length, 0);
  assert.equal(state.players[2].discard.filter((item) => item.cardId === "curse").length, 1);
});

test("Library asks whether each action or reaction is set aside, then discards it", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 79 });
  const library = testCard("library", "response-library");
  state.players[0].hand.push(library);
  state.players[0].deck = [testCard("copper", "library-copper-1"), testCard("copper", "library-copper-2"), testCard("village", "library-village")];
  state = dispatchDominionCommand(state, { type: "play-action", cardId: library.uid }).state;
  assert.equal(state.pendingPrompt.type, "select-library-card");
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: "library-village", choice: "set-aside" }).state;
  assert.equal(state.pendingPrompt, null);
  assert.equal(state.players[0].setAside.length, 0);
  assert.ok(state.players[0].discard.some((item) => item.uid === "library-village"));
});

test("legal command projection exposes concrete response choices without revealing foreign hands", () => {
  let state = createDominionStudyGame({ playerCount: 3, seed: 83 });
  const witch = testCard("witch", "legal-witch");
  state.players[0].hand.push(witch);
  state.players[1].hand.push(testCard("moat", "legal-moat"));
  state = dispatchDominionCommand(state, { type: "play-action", cardId: witch.uid }).state;
  const commands = legalDominionCommands(state);
  assert.deepEqual(commands.map((command) => command.revealMoat), [true, false]);
  const privateView = dominionPrivateState(state, 0);
  assert.equal(privateView.players[1].hand.length, 0);
});

test("Vassal discards a revealed non-action exactly once", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 89 });
  const vassal = testCard("vassal", "audit-vassal-non-action");
  state.players[0].hand.push(vassal);
  state.players[0].deck = [testCard("copper", "audit-vassal-copper")];
  state = dispatchDominionCommand(state, { type: "play-action", cardId: vassal.uid }).state;
  assert.equal(state.pendingPrompt, null);
  assert.equal(state.players[0].hand.some((card) => card.uid === "audit-vassal-copper"), false);
  assert.equal(state.players[0].discard.filter((card) => card.uid === "audit-vassal-copper").length, 1);
  assertStateIntegrity(state);
});

test("Moneylender only accepts Copper, and Mine only gains Treasure", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 97 });
  const moneylender = testCard("moneylender", "audit-moneylender");
  const silver = testCard("silver", "audit-moneylender-silver");
  const copper = testCard("copper", "audit-moneylender-copper");
  state.players[0].hand.push(moneylender, silver, copper);
  state = dispatchDominionCommand(state, { type: "play-action", cardId: moneylender.uid }).state;
  const illegalMoneylender = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: silver.uid });
  assert.equal(illegalMoneylender.ok, false);
  assert.equal(illegalMoneylender.code, "TREASURE_REQUIRED");
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: copper.uid }).state;
  assert.equal(state.players[0].coins, 3);
  assert.ok(state.trash.some((card) => card.uid === copper.uid));

  state = createDominionStudyGame({ playerCount: 2, seed: 101 });
  const mine = testCard("mine", "audit-mine");
  const mineCopper = testCard("copper", "audit-mine-copper");
  state.players[0].hand.push(mine, mineCopper);
  state = dispatchDominionCommand(state, { type: "play-action", cardId: mine.uid }).state;
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: mineCopper.uid }).state;
  assert.equal(state.pendingPrompt.type, "select-supply");
  const illegalMine = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: "village" });
  assert.equal(illegalMine.ok, false);
  assert.equal(illegalMine.code, "TREASURE_REQUIRED");
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: "silver" }).state;
  assert.ok(state.players[0].hand.some((card) => card.cardId === "silver"));
});

test("Bandit never trashes Copper, and hidden Vassal reveals stay private", () => {
  let state = createDominionStudyGame({ playerCount: 3, seed: 103 });
  const bandit = testCard("bandit", "audit-bandit");
  state.players[0].hand.push(bandit);
  state.players[1].deck = [testCard("copper", "audit-bandit-copper-a"), testCard("copper", "audit-bandit-copper-b")];
  state = dispatchDominionCommand(state, { type: "play-action", cardId: bandit.uid }).state;
  assert.equal(state.trash.some((card) => card.uid.startsWith("audit-bandit-copper")), false);
  assert.equal(state.players[1].discard.filter((card) => card.uid.startsWith("audit-bandit-copper")).length, 2);

  state = createDominionStudyGame({ playerCount: 2, seed: 107 });
  const vassal = testCard("vassal", "audit-private-vassal");
  state.players[0].hand.push(vassal);
  state.players[0].deck = [testCard("smithy", "audit-private-smithy")];
  state = dispatchDominionCommand(state, { type: "play-action", cardId: vassal.uid }).state;
  const publicView = dominionPublicState(state);
  const ownerView = dominionPrivateState(state, 0);
  const otherView = dominionPrivateState(state, 1);
  assert.equal(publicView.pendingPrompt.cardId, undefined);
  assert.equal(ownerView.pendingPrompt.cardId, "audit-private-smithy");
  assert.equal(otherView.pendingPrompt.cardId, undefined);
});

test("Sentry keeps both topdecked cards in an explicit chosen order", () => {
  let state = createDominionStudyGame({ playerCount: 2, seed: 109 });
  const sentry = testCard("sentry", "audit-sentry-order");
  state.players[0].hand.push(sentry);
  state.players[0].deck = [testCard("copper", "audit-sentry-a"), testCard("silver", "audit-sentry-b"), testCard("gold", "audit-sentry-c")];
  state = dispatchDominionCommand(state, { type: "play-action", cardId: sentry.uid }).state;
  assert.equal(state.pendingPrompt.type, "select-sentry-card");
  const first = state.pendingPrompt.cards[0].uid;
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: first, choice: "topdeck" }).state;
  const second = state.pendingPrompt.cards[0].uid;
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardId: second, choice: "topdeck" }).state;
  assert.equal(state.pendingPrompt.type, "select-sentry-order");
  const order = state.pendingPrompt.cards.map((card) => card.uid).reverse();
  state = dispatchDominionCommand(state, { type: "resolve-prompt", cardIds: order }).state;
  assert.equal(state.pendingPrompt, null);
  assert.deepEqual(state.players[0].deck.slice(-2).map((card) => card.uid), [order[1], order[0]]);
  assertStateIntegrity(state);
});
