import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

test("creator role profile create, edit, persist, and delete flow", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: `/api/worlds/${fixtureWorldId}/roles`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: "私人档案回归角色",
      publicProfile: "初始公开档案",
      privateProfile: "初始私人档案",
      sequence: 9876
    }
  });
  assert.equal(created.statusCode, 201, created.body);
  const roleSlotId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM role_slots WHERE id = $1`, [roleSlotId]);
  });

  const updated = await app.inject({
    method: "PUT",
    url: `/api/worlds/${fixtureWorldId}/roles/${roleSlotId}`,
    headers: { "x-user-id": hostUserId },
    payload: {
      name: "私人档案回归角色·已编辑",
      publicProfile: "编辑后的公开档案",
      privateProfile: "只有创作者应能看到的编辑结果",
      sequence: 9876
    }
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().private_profile, "只有创作者应能看到的编辑结果");

  const persisted = await query(
    `SELECT name, public_profile, private_profile, sequence FROM role_slots WHERE id = $1 AND world_id = $2`,
    [roleSlotId, fixtureWorldId]
  );
  assert.equal(persisted.rowCount, 1);
  assert.deepEqual(persisted.rows[0], {
    name: "私人档案回归角色·已编辑",
    public_profile: "编辑后的公开档案",
    private_profile: "只有创作者应能看到的编辑结果",
    sequence: 9876
  });

  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${fixtureWorldId}/roles/${roleSlotId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal((await query(`SELECT id FROM role_slots WHERE id = $1`, [roleSlotId])).rowCount, 0);
});
