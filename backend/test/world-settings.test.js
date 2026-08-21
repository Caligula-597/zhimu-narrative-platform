import assert from "node:assert/strict";
import { fixtureRoomId, fixtureWorldId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";



test("GET and PATCH world settings for editors", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const prior = await query(`SELECT summary, settings FROM worlds WHERE id = $1`, [fixtureWorldId]);
  context.after(async () => {
    await query(`UPDATE worlds SET summary = $2, settings = $3::jsonb WHERE id = $1`, [
      fixtureWorldId,
      prior.rows[0]?.summary ?? "海雾将旧日的来信送回港口。",
      JSON.stringify(prior.rows[0]?.settings ?? {})
    ]);
  });

  const worldId = fixtureWorldId;

  const detail = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().id, worldId);

  const patch = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId },
    payload: { summary: "updated-by-test", settings: { demoFlag: true } }
  });
  assert.equal(patch.statusCode, 200);
  assert.equal(patch.json().summary, "updated-by-test");
  assert.equal(patch.json().settings.demoFlag, true);

  const forbidden = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": playerUserId },
    payload: { name: "should fail" }
  });
  assert.equal(forbidden.statusCode, 403);
});

test("host can patch room runtime settings", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const before = await query(`SELECT settings FROM rooms WHERE id = $1`, [fixtureRoomId]);
  const priorSettings = before.rows[0]?.settings ?? {};
  context.after(async () => {
    await query(`UPDATE rooms SET settings = $2::jsonb WHERE id = $1`, [fixtureRoomId, JSON.stringify(priorSettings)]);
  });

  const patch = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/settings`,
    headers: { "x-user-id": hostUserId },
    payload: { settings: { hostVoiceListen: true } }
  });
  assert.equal(patch.statusCode, 200);
  assert.equal(patch.json().settings.hostVoiceListen, true);

  const initialPresentation = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/settings`,
    headers: { "x-user-id": hostUserId },
    payload: {
      settings: {
        runtimePresentation: {
          activeSegmentKey: "opening",
          activeLocationId: "lobby",
          revealedLocationIds: ["lobby"],
          mapVisible: true,
          activeEncounter: {
            locationId: "lobby",
            npcIds: ["guard"],
            status: "active",
            startedAt: "2026-08-10T13:00:00.000Z"
          },
          updatedAt: "2026-08-10T13:00:00.000Z"
        }
      }
    }
  });
  assert.equal(initialPresentation.statusCode, 200, initialPresentation.body);

  const partialPresentation = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/settings`,
    headers: { "x-user-id": hostUserId },
    payload: {
      settings: {
        runtimePresentation: {
          mapVisible: false,
          updatedAt: "2026-08-10T13:01:00.000Z"
        }
      }
    }
  });
  assert.equal(partialPresentation.statusCode, 200, partialPresentation.body);
  assert.equal(partialPresentation.json().settings.runtimePresentation.mapVisible, false);
  assert.equal(partialPresentation.json().settings.runtimePresentation.activeLocationId, "lobby");
  assert.deepEqual(partialPresentation.json().settings.runtimePresentation.activeEncounter.npcIds, ["guard"]);

  const audit = await query(
    `SELECT 1 FROM host_audit_log WHERE room_id = $1 AND action = 'room_settings_updated'`,
    [fixtureRoomId]
  );
  assert.ok(audit.rowCount >= 1);
});
