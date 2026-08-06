import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";


test("host can create list and read room checkpoints", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "第一夜收工", description: "玩家已完成序章调查" }
  });
  assert.equal(create.statusCode, 201);
  const created = create.json();
  assert.equal(created.label, "第一夜收工");
  assert.equal(created.description, "玩家已完成序章调查");
  assert.ok(Array.isArray(created.snapshot.players));
  assert.ok(Object.hasOwn(created.snapshot, "unlockedScenes"));
  assert.ok(Object.hasOwn(created.snapshot, "pendingEvents"));
  assert.ok(Object.hasOwn(created.snapshot, "recentLogs"));
  assert.equal(created.snapshot.schemaVersion, 3);
  assert.ok(Object.hasOwn(created.snapshot, "mechanismRuntime"));
  assert.ok(Array.isArray(created.snapshot.readingProgress));
  assert.ok(Array.isArray(created.snapshot.inventory));
  assert.ok(Array.isArray(created.snapshot.contentUnlocks));
  assert.ok(Array.isArray(created.snapshot.investigationRecords));

  const list = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(list.statusCode, 200);
  const checkpoints = list.json();
  assert.ok(checkpoints.some((item) => item.id === created.id));
  assert.ok(checkpoints[0].summary);

  const detail = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/checkpoints/${created.id}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().snapshot.roomId, fixtureRoomId);
  assert.equal(detail.json().label, "第一夜收工");
});

test("checkpoint restore applies and records audit trail", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "restore-probe", description: "schema probe" }
  });
  assert.equal(create.statusCode, 201);
  const checkpointId = create.json().id;

  const restore = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId },
    payload: {
      scope: {
        readingProgress: false,
        clueOwnership: false,
        inventory: false,
        contentUnlocks: false,
        pendingHostEvents: false
      }
    }
  });
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.json().status, "applied");
  assert.equal(restore.json().checkpointId, checkpointId);

  const history = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/checkpoints/${checkpointId}/restores`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(history.statusCode, 200);
  assert.ok(history.json().some((row) => row.status === "applied"));
});

test("player cannot create checkpoints", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers: { "x-user-id": playerUserId },
    payload: { title: "不应成功", description: "玩家不能创建" }
  });
  assert.equal(response.statusCode, 403);
});

test("checkpoint creation is idempotent across client retries", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const key = `checkpoint-create-${Date.now()}-${Math.random()}`;
  const headers = { "x-user-id": hostUserId, "idempotency-key": key };
  const payload = { title: "idempotent checkpoint", description: "retry probe" };

  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers,
    payload
  });
  const second = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/checkpoints`,
    headers,
    payload
  });

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(second.json().id, first.json().id);
  const count = await query(
    `SELECT COUNT(*)::int AS count FROM checkpoints WHERE room_id = $1 AND label = $2`,
    [fixtureRoomId, payload.title]
  );
  assert.equal(count.rows[0].count, 1);
});
