import assert from "node:assert/strict";
import test from "node:test";
import { createBillingCheckoutSession } from "../src/billing-service.js";
import { presentPendingHostEvents } from "../src/host-event-service.js";
import { activatePhysicalToken } from "../src/physical-token-service.js";
import { updateClueOwnershipHostNote } from "../src/repositories/host-monitor-repository.js";
import { listRoomSegmentRemediesWith } from "../src/segment-remedies.js";

test("billing checkout validates configuration and account before calling Stripe", async () => {
  await assert.rejects(
    createBillingCheckoutSession(
      { actorId: "user-1", planCode: "creator" },
      { configured: () => false }
    ),
    (error) => error.code === "STRIPE_NOT_CONFIGURED"
  );

  await assert.rejects(
    createBillingCheckoutSession(
      { actorId: "user-1", planCode: "creator" },
      { configured: () => true, findAccount: async () => ({ user_kind: "guest", email: "g@example.test" }) }
    ),
    (error) => error.code === "AUTH_REQUIRED"
  );

  const calls = [];
  const session = await createBillingCheckoutSession(
    { actorId: "user-1", planCode: "studio" },
    {
      configured: () => true,
      findAccount: async () => ({ user_kind: "registered", email: "owner@example.test" }),
      createSession: async (input) => {
        calls.push(input);
        return { url: "https://checkout.example.test/session" };
      }
    }
  );
  assert.equal(session.url, "https://checkout.example.test/session");
  assert.deepEqual(calls, [{
    userId: "user-1",
    email: "owner@example.test",
    planCode: "studio"
  }]);
});

test("physical token activation validates room world inside the token lock query", async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [{
          id: "token-1",
          token_code: "ZHM-23456789",
          world_id: "world-a",
          room_world_id: "world-b",
          status: "issued"
        }]
      };
    }
  };

  await assert.rejects(
    activatePhysicalToken(client, {
      roomId: "room-1",
      roleSlotId: "role-1",
      userId: "user-1",
      tokenCode: "ZHM-23456789"
    }, () => {}),
    (error) => error.code === "PHYSICAL_TOKEN_WORLD_MISMATCH"
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /JOIN rooms room ON room\.id = \$2/);
  assert.match(calls[0].sql, /FOR UPDATE OF pt/);
  assert.deepEqual(calls[0].params, ["ZHM-23456789", "room-1"]);
});

test("room segment remedies resolve room scope in one query", async () => {
  const calls = [];
  const rows = await listRoomSegmentRemediesWith(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: "remedy-1" }] };
  }, "room-1", "opening");

  assert.deepEqual(rows, [{ id: "remedy-1" }]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /JOIN segment_remedies remedy ON remedy\.world_id = room\.world_id/);
  assert.deepEqual(calls[0].params, ["room-1", "opening"]);
});

test("host event presentation remains outside HTTP routes", () => {
  const events = presentPendingHostEvents([{
    id: "event-1",
    event_key: "manual:test",
    actions: [{ type: "timeline_log", message: "推进剧情" }],
    rule_conditions: { all: [{ roleSlotId: "role-1" }, { role_slot_id: "role-1" }] }
  }]);

  assert.equal(events[0].source_label, "主持手动");
  assert.deepEqual(events[0].action_summaries, ["推进剧情"]);
  assert.deepEqual(events[0].trigger_players, ["role-1"]);
});

test("host clue-note repository preserves an intentionally empty note", async () => {
  const saved = await updateClueOwnershipHostNote(async () => ({
    rows: [{ host_note: "" }]
  }), {
    roomId: "room-1",
    roleSlotId: "role-1",
    clueId: "clue-1",
    hostNote: ""
  });
  assert.equal(saved, "");

  const missing = await updateClueOwnershipHostNote(async () => ({ rows: [] }), {
    roomId: "room-1",
    roleSlotId: "role-1",
    clueId: "clue-1",
    hostNote: "note"
  });
  assert.equal(missing, null);
});
