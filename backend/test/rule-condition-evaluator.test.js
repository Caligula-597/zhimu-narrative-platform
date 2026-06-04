import assert from "node:assert/strict";
import test from "node:test";
import { compareValues, evaluateConditions } from "../src/rule-condition-evaluator.js";
import { query } from "../src/db.js";

test("compareValues supports numeric and string equality", () => {
  assert.equal(compareValues(3, "gte", 3), true);
  assert.equal(compareValues(2, "gt", 3), false);
  assert.equal(compareValues("abc", "eq", "abc"), true);
  assert.equal(compareValues("abc", "neq", "def"), true);
});

test("evaluateConditions supports any and not groups", async () => {
  const client = {
    async query(_sql, params) {
      const [roomId, roleSlotId, sectionId] = params;
      assert.equal(roomId, "room-1");
      if (roleSlotId === "role-a" && sectionId === "sec-a") {
        return { rows: [{ ok: true }] };
      }
      return { rows: [{ ok: false }] };
    }
  };

  const anyMet = await evaluateConditions(client, "room-1", {
    any: [
      { type: "reading_completed", roleSlotId: "role-a", scriptSectionId: "sec-a" },
      { type: "reading_completed", roleSlotId: "role-b", scriptSectionId: "sec-b" }
    ]
  });
  assert.equal(anyMet, true);

  const notMet = await evaluateConditions(client, "room-1", {
    not: { type: "reading_completed", roleSlotId: "role-b", scriptSectionId: "sec-b" }
  });
  assert.equal(notMet, true);
});

test("evaluateConditions supports variable_compare on player_states", async (context) => {
  const suffix = `${Date.now()}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ('154aa8a9-9cd2-4098-90f4-c75e56c0cc53', $1, '', 'testing')
     RETURNING id`,
    [`变量条件 ${suffix}`]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, '角色', 1) RETURNING id`,
    [world.rows[0].id]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, '154aa8a9-9cd2-4098-90f4-c75e56c0cc53', $2, $3, 'testing')
     RETURNING id`,
    [world.rows[0].id, `变量房 ${suffix}`, `VAR-${suffix}`]
  );
  context.after(async () => {
    await query(`DELETE FROM rooms WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  });

  await query(
    `INSERT INTO player_states (room_id, role_slot_id, variables)
     VALUES ($1, $2, '{"trust": 4}'::jsonb)`,
    [room.rows[0].id, role.rows[0].id]
  );

  const dbClient = { query: (...args) => query(...args) };
  const met = await evaluateConditions(dbClient, room.rows[0].id, {
    all: [{ type: "variable_compare", roleSlotId: role.rows[0].id, key: "trust", operator: "gte", value: 3 }]
  });
  assert.equal(met, true);

  const unmet = await evaluateConditions(dbClient, room.rows[0].id, {
    all: [{ type: "variable_compare", roleSlotId: role.rows[0].id, key: "trust", operator: "gt", value: 10 }]
  });
  assert.equal(unmet, false);
});
