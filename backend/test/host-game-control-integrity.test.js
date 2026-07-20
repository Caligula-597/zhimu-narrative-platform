import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { normalizeHostGameControlError } from "../src/host-game-control-service.js";
import { startLockMiniGame } from "../src/room-mini-games.js";
import { waitForScheduledEventOutbox } from "../src/event-outbox-dispatcher.js";
import { fixtureRoomId, hostUserId, playerUserId } from "./helpers/fixture-ids.js";

async function dropAuditFailureTrigger() {
  await query(`DROP TRIGGER IF EXISTS test_fail_host_game_audit_trigger ON host_audit_log`);
  await query(`DROP FUNCTION IF EXISTS test_fail_host_game_audit()`);
}

async function installAuditFailureTrigger(action) {
  await dropAuditFailureTrigger();
  await query(`
    CREATE OR REPLACE FUNCTION test_fail_host_game_audit()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.action = '${action}' THEN
        RAISE EXCEPTION 'forced host game audit failure';
      END IF;
      RETURN NEW;
    END $$`);
  await query(`
    CREATE TRIGGER test_fail_host_game_audit_trigger
    BEFORE INSERT ON host_audit_log
    FOR EACH ROW EXECUTE FUNCTION test_fail_host_game_audit()`);
}

test("host game control maps lock pressure and timeouts to stable contracts", () => {
  const busy = normalizeHostGameControlError({ code: "55P03" });
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.code, "HOST_GAME_CONTROL_BUSY");
  const activeConflict = normalizeHostGameControlError({
    code: "23505",
    constraint: "idx_room_mini_games_one_active"
  });
  assert.equal(activeConflict.statusCode, 409);
  assert.equal(activeConflict.code, "HOST_GAME_CONTROL_BUSY");
  const timeout = normalizeHostGameControlError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "HOST_GAME_CONTROL_TIMEOUT");
});

test("startLockMiniGame uses two ordered writes to preserve the active-game invariant", async () => {
  let queryCount = 0;
  const row = {
    id: "game-query-budget",
    game_type: "zhimu_lock",
    title: "Query budget",
    public_config: { max_attempts: 3 },
    state: { attempts_left: 3 },
    status: "active",
    created_at: new Date(),
    updated_at: new Date()
  };
  const client = {
    async query(sql) {
      queryCount += 1;
      if (queryCount === 1) {
        assert.match(sql, /UPDATE room_mini_games/);
        return { rows: [], rowCount: 0 };
      }
      assert.match(sql, /INSERT INTO room_mini_games/);
      return { rows: [row], rowCount: 1 };
    }
  };

  const game = await startLockMiniGame(client, {
    roomId: "room-query-budget",
    actorUserId: "host-query-budget",
    body: { answer: "2468", title: "Query budget" }
  });
  assert.equal(queryCount, 2);
  assert.equal(game.id, row.id);
});

test("concurrent host mini-game starts serialize and keep one active game", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  await query(`DELETE FROM room_mini_games WHERE room_id = $1`, [fixtureRoomId]);
  const suffix = `${Date.now()}`;
  const titles = [`Concurrent A ${suffix}`, `Concurrent B ${suffix}`];
  const gameIds = [];
  context.after(async () => {
    await query(`DELETE FROM room_mini_games WHERE room_id = $1`, [fixtureRoomId]);
    if (gameIds.length) {
      await query(
        `DELETE FROM timeline_logs
         WHERE room_id = $1 AND metadata ->> 'gameId' = ANY($2::text[])`,
        [fixtureRoomId, gameIds]
      );
      await query(
        `DELETE FROM host_audit_log
         WHERE room_id = $1 AND target_id = ANY($2::text[])`,
        [fixtureRoomId, gameIds]
      );
    }
  });

  const responses = await Promise.all(titles.map((title) => app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/mini-games`,
    headers: { "x-user-id": hostUserId },
    payload: { answer: "2468", title, maxAttempts: 3 }
  })));
  assert.deepEqual(
    responses.map((response) => response.statusCode),
    [200, 200],
    responses.map((response) => response.body).join("\n")
  );
  gameIds.push(...responses.map((response) => response.json().currentGame.id));
  await waitForScheduledEventOutbox();

  const games = await query(
    `SELECT id, status FROM room_mini_games
     WHERE id = ANY($1::uuid[])
     ORDER BY created_at, id`,
    [gameIds]
  );
  assert.equal(games.rowCount, 2);
  assert.equal(games.rows.filter((row) => row.status === "active").length, 1);
  assert.equal(games.rows.filter((row) => row.status === "skipped").length, 1);
  const audits = await query(
    `SELECT COUNT(*)::int AS count FROM host_audit_log
     WHERE action = 'mini_game_started' AND target_id = ANY($1::text[])`,
    [gameIds]
  );
  assert.equal(audits.rows[0].count, 2);

  const active = games.rows.find((row) => row.status === "active");
  const forced = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/mini-games/${active.id}/force-complete`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(forced.statusCode, 200, forced.body);
  assert.equal(forced.json().currentGame.status, "success");
  assert.equal((await query(
    `SELECT 1 FROM host_audit_log
     WHERE action = 'mini_game_force_completed' AND target_id = $1`,
    [active.id]
  )).rowCount, 1);
});

test("mini-game business writes roll back when durable audit insertion fails", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  context.after(dropAuditFailureTrigger);
  await query(`DELETE FROM room_mini_games WHERE room_id = $1`, [fixtureRoomId]);
  const title = `Audit rollback ${Date.now()}`;
  context.after(async () => {
    const games = await query(
      `DELETE FROM room_mini_games WHERE room_id = $1 AND title = $2 RETURNING id`,
      [fixtureRoomId, title]
    );
    const gameIds = games.rows.map((row) => String(row.id));
    await query(
      `DELETE FROM timeline_logs WHERE room_id = $1 AND message LIKE $2`,
      [fixtureRoomId, `%${title}%`]
    );
    if (gameIds.length) {
      await query(
        `DELETE FROM host_audit_log WHERE room_id = $1 AND target_id = ANY($2::text[])`,
        [fixtureRoomId, gameIds]
      );
    }
  });
  await installAuditFailureTrigger("mini_game_started");

  const failed = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/mini-games`,
    headers: { "x-user-id": hostUserId },
    payload: { answer: "2468", title }
  });
  assert.equal(failed.statusCode, 500, failed.body);
  assert.equal((await query(
    `SELECT 1 FROM room_mini_games WHERE room_id = $1 AND title = $2`,
    [fixtureRoomId, title]
  )).rowCount, 0);
  assert.equal((await query(
    `SELECT 1 FROM timeline_logs WHERE room_id = $1 AND message LIKE $2`,
    [fixtureRoomId, `%${title}%`]
  )).rowCount, 0);

  await dropAuditFailureTrigger();
  const retry = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/mini-games`,
    headers: { "x-user-id": hostUserId },
    payload: { answer: "2468", title }
  });
  assert.equal(retry.statusCode, 200, retry.body);
});

test("room settings and audit commit or roll back together", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  context.after(dropAuditFailureTrigger);
  const before = await query(`SELECT settings FROM rooms WHERE id = $1`, [fixtureRoomId]);
  const priorSettings = before.rows[0].settings ?? {};
  context.after(async () => {
    await query(`UPDATE rooms SET settings = $2::jsonb WHERE id = $1`, [
      fixtureRoomId,
      JSON.stringify(priorSettings)
    ]);
  });
  const nextValue = !Boolean(priorSettings.hostVoiceListen);
  await installAuditFailureTrigger("room_settings_updated");

  const failed = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/settings`,
    headers: { "x-user-id": hostUserId },
    payload: { settings: { hostVoiceListen: nextValue } }
  });
  assert.equal(failed.statusCode, 500, failed.body);
  const afterFailure = await query(`SELECT settings FROM rooms WHERE id = $1`, [fixtureRoomId]);
  assert.deepEqual(afterFailure.rows[0].settings, priorSettings);

  await dropAuditFailureTrigger();
  const retry = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fixtureRoomId}/settings`,
    headers: { "x-user-id": hostUserId },
    payload: { settings: { hostVoiceListen: nextValue } }
  });
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(retry.json().settings.hostVoiceListen, nextValue);
});

test("players cannot mutate host game controls", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const title = `Forbidden ${Date.now()}`;
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/mini-games`,
    headers: { "x-user-id": playerUserId },
    payload: { answer: "2468", title }
  });
  assert.equal(response.statusCode, 403, response.body);
  assert.equal((await query(
    `SELECT 1 FROM room_mini_games WHERE room_id = $1 AND title = $2`,
    [fixtureRoomId, title]
  )).rowCount, 0);
});
