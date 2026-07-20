import assert from "node:assert/strict";
import test from "node:test";

import { loadPlayerHomeSocial } from "../src/repositories/player-home-social-repository.js";
import {
  loadPlayerHomeSession,
  summarizePlayerHostConfirm
} from "../src/repositories/player-home-session-repository.js";

test("Player social payload is loaded with one database acquisition", async () => {
  let calls = 0;
  const result = await loadPlayerHomeSocial({
    roomId: "room-1",
    roleSlotId: "role-1",
    async runQuery(_sql, params) {
      calls += 1;
      assert.deepEqual(params, ["room-1", "role-1"]);
      return {
        rows: [{
          notes: [{ id: "note-1" }],
          owned_clues: [{ id: "clue-1" }],
          shared_clues: [{ id: "clue-2" }],
          members: [{ role_slot_id: "role-1" }],
          suspicions: [{ id: "suspicion-1" }],
          testimonies: [{ id: "testimony-1" }],
          private_actions: [{ id: "action-1" }]
        }]
      };
    }
  });

  assert.equal(calls, 1);
  assert.deepEqual(result.clues, [{ id: "clue-1" }]);
  assert.deepEqual(result.sharedClues, [{ id: "clue-2" }]);
  assert.deepEqual(result.suspicions, [{ id: "suspicion-1" }]);
});

test("Player session payload is loaded with one database acquisition", async () => {
  let calls = 0;
  const result = await loadPlayerHomeSession({
    roomId: "room-1",
    roleSlotId: "role-1",
    actorId: "user-1",
    async runQuery(_sql, params) {
      calls += 1;
      assert.deepEqual(params, ["room-1", "role-1", "user-1"]);
      return {
        rows: [{
          voice_rooms: [{ id: "voice-1" }],
          inventory: [{ item_id: "item-1" }],
          pending_host_events: [
            { title: "For me", rule_conditions: { all: [{ roleSlotId: "role-1" }] } }
          ],
          current_game: {
            id: "game-1",
            game_type: "zhimu_lock",
            title: "Lock",
            public_config: {},
            state: { attempts_left: 2 },
            status: "active"
          },
          active_votes: [{ id: "vote-1" }],
          role_state: { faction_key: "north" }
        }]
      };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.hostConfirm.pendingCount, 1);
  assert.equal(result.hostConfirm.waitingForYou, true);
  assert.equal(result.currentGame.instanceId, "game-1");
  assert.equal(result.currentGame.attemptsLeft, 2);
});

test("host confirmation summary keeps the legacy audience semantics", () => {
  const summary = summarizePlayerHostConfirm([
    { title: "Everyone", rule_conditions: null },
    { title: "Another role", rule_conditions: { all: [{ roleSlotId: "role-2" }] } },
    { title: "Mine", rule_conditions: { all: [{ role_slot_id: "role-1" }] } },
    { title: "Fourth", rule_conditions: null }
  ], "role-1");

  assert.equal(summary.pendingCount, 4);
  assert.equal(summary.waitingForYou, true);
  assert.deepEqual(summary.titles, ["Everyone", "Another role", "Mine"]);
});
