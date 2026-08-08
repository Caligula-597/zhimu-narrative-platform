import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeStateFacts } from "../src/repositories/runtime-current-state-repository.js";

test("player runtime facts load only the current role's private mechanism answer", async () => {
  let captured = null;
  await loadRuntimeStateFacts(
    { roomId: "room-1", roleSlotId: "role-1" },
    async (sql, params) => {
      captured = { sql, params };
      return { rows: [{}] };
    },
  );
  assert.deepEqual(captured.params, ["room-1", "role-1"]);
  assert.match(captured.sql, /submission\.role_slot_id = \$2::uuid/);
  assert.match(captured.sql, /'answer', submission\.answer/);
  assert.doesNotMatch(captured.sql, /jsonb_agg\(submission\)/);
});
