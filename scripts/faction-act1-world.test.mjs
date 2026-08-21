import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFactionAct1World,
  compileNarrativeIr,
  listVenueOptions
} from "../shared/world-engine/index.js";

test("freight wharf is a seeded eight-player venue", () => {
  assert.ok(listVenueOptions().some((row) => row.key === "freight_wharf"));
});

test("faction act1 world compiles resource collisions and split knowledge", () => {
  const world = buildFactionAct1World();
  assert.equal(world.ledger.characters.length, 8);
  assert.ok(world.collisions.some((row) => row.type === "unpaid_obligation"));
  assert.ok(world.collisions.some((row) => row.type === "shared_capacity"));
  assert.equal(world.playIr.openingSaturation, false);
  const dispatcher = compileNarrativeIr(world.ledger, "CHAR_001", world);
  const captain = compileNarrativeIr(world.ledger, "CHAR_008", world);
  const dispatcherBody = JSON.stringify(dispatcher.events);
  const captainBody = JSON.stringify(captain.events);
  assert.ok(/未结清|12000|钱厚德/.test(dispatcherBody));
  assert.equal(/未结清|12000/.test(captainBody), false);
  assert.ok(dispatcher.runtimeIds.length > captain.runtimeIds.length);
});
