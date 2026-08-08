import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { compileMechanismPackage } from "../src/mechanism-package.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

function fixturePackage() {
  return compileMechanismPackage({
    semanticConstitution: { facts: [], authorizationGrants: [], branchEvents: [], worldRules: [] },
    causalTimeline: [],
    entities: [],
    resources: [],
    players: [
      { key: "role-captain", publicGoal: "核对密令" },
      { key: "role-observer", publicGoal: "旁观复核" },
    ],
    evidenceGraph: { evidence: [], conclusions: [] },
    chapterBeats: [{
      chapterKey: "round-1",
      title: "核对代理授权",
      goal: "确认数字代理的授权范围",
      playerAction: "讨论授权是否覆盖正式比赛",
      genreMechanicUse: "赛事程序复核",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: [],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
      decision: {
        key: "decision-auth",
        stateKey: "state-auth",
        question: "是否承认本次代理授权？",
        options: [{
          key: "accept",
          choiceText: "承认授权",
          effects: [
            { targetType: "state", targetKey: "state-auth", operation: "set", value: "accepted" },
            {
              targetType: "clue",
              targetKey: "clue-order",
              operation: "grant",
              roleKey: "role-captain",
              consequence: "向队长发放密令残页"
            }
          ]
        }]
      }
    }],
    endingLogic: {
      stateVariables: [{
        key: "state-auth",
        valueType: "enum",
        initialValue: "unknown",
        allowedValues: ["unknown", "accepted"],
        setInChapterKey: "round-1"
      }],
      defaultRouteKey: "ending-default",
      conflictResolution: "highest-priority",
      routes: [{
        key: "ending-accepted",
        title: "授权获得承认",
        priority: 10,
        requirements: [{ targetType: "state", targetKey: "state-auth", operator: "equals", value: "accepted" }]
      }, {
        key: "ending-default",
        title: "等待复核",
        priority: 0,
        isDefault: true,
        requirements: []
      }]
    }
  });
}

async function createFixture(context, app) {
  const marker = randomUUID();
  const observerUser = (await query(
    `INSERT INTO users (display_name, email) VALUES ($1, $2) RETURNING id`,
    ["机制旁观者", `mechanism-observer-${marker}@example.test`]
  )).rows[0];
  const world = (await query(
    `INSERT INTO worlds (owner_user_id, name, settings)
     VALUES ($1, $2, '{"worldMode":"scripted"}'::jsonb)
     RETURNING id`,
    [hostUserId, `mechanism-sync-${marker}`]
  )).rows[0];
  context.after(async () => {
    await query("DELETE FROM rooms WHERE world_id = $1", [world.id]);
    await query("DELETE FROM worlds WHERE id = $1", [world.id]);
    await query("DELETE FROM users WHERE id = $1", [observerUser.id]);
  });
  await query(
    "INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')",
    [world.id, hostUserId]
  );
  const role = (await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
     VALUES ($1, '队长', '公开身份', '私人身份', 1, '{"deepseekRoleKey":"role-captain"}'::jsonb)
     RETURNING id`,
    [world.id]
  )).rows[0];
  const observerRole = (await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
     VALUES ($1, '观察员', '公开身份', '私人身份', 2, '{"deepseekRoleKey":"role-observer"}'::jsonb)
     RETURNING id`,
    [world.id]
  )).rows[0];
  const clue = (await query(
    `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
     VALUES ($1, '密令残页', '只应由队长看到', '机制结算测试', 'role',
       '{"proposalKey":"clue-order"}'::jsonb)
     RETURNING id`,
    [world.id]
  )).rows[0];
  const packageValue = fixturePackage();
  await query(
    `INSERT INTO world_mechanism_packages (world_id, schema_version, source, package)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [world.id, packageValue.schemaVersion, packageValue.source, JSON.stringify(packageValue)]
  );
  const roomResponse = await app.inject({
    method: "POST",
    url: `/api/worlds/${world.id}/rooms`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": `mechanism-room-${marker}`
    },
    payload: { name: "三端机制同步房" }
  });
  assert.equal(roomResponse.statusCode, 201, roomResponse.body);
  const room = roomResponse.json();
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
     VALUES ($1, $2, 'player', $3)`,
    [room.id, playerUserId, role.id]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
     VALUES ($1, $2, 'player', $3)`,
    [room.id, observerUser.id, observerRole.id]
  );
  return {
    roomId: room.id,
    targetRoleId: role.id,
    observerRoleId: observerRole.id,
    observerUserId: observerUser.id,
    clueId: clue.id
  };
}

test("host mechanism actions commit and player receives only the safe synchronized projection", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const {
    roomId,
    targetRoleId,
    observerUserId,
    clueId
  } = await createFixture(context, app);
  const hostHeaders = {
    "x-user-id": hostUserId,
    "idempotency-key": `mechanism-initialize-${randomUUID()}`
  };

  const initialized = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/mechanism-runtime/initialize`,
    headers: hostHeaders,
    payload: {}
  });
  assert.equal(initialized.statusCode, 201, initialized.body);
  assert.equal(initialized.json().state.revision, 1);
  const hostDecision = initialized.json().state.availableDecisions[0];
  assert.ok(hostDecision?.key);
  assert.ok(hostDecision?.options?.[0]?.key);

  const playerState = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/current-state`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(playerState.statusCode, 200, playerState.body);
  const projection = playerState.json().mechanism;
  assert.equal(projection.status, "running");
  assert.equal(projection.revision, 1);
  assert.equal(projection.currentRound.title, "核对代理授权");
  assert.equal(projection.decisions[0].options[0].choiceText, "承认授权");
  const serialized = JSON.stringify(projection);
  for (const hidden of ["state-auth", "decision-auth", "effects", "states", "resources", "evidence"]) {
    assert.equal(serialized.includes(hidden), false, `${hidden} leaked to Player`);
  }

  const overridden = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/mechanism-runtime/actions`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": `mechanism-override-${randomUUID()}`
    },
    payload: {
      expectedRevision: 1,
      action: {
        type: "override",
        reason: "主持人确认线下授权凭证已经完成复核",
        effects: [{ targetType: "state", targetKey: "state-auth", operation: "set", value: "accepted" }]
      }
    }
  });
  assert.equal(overridden.statusCode, 200, overridden.body);
  assert.equal(overridden.json().state.revision, 2);

  const decisionIdempotencyKey = `mechanism-decision-${randomUUID()}`;
  const decisionPayload = {
    expectedRevision: 2,
    action: {
      type: "decision",
      decisionKey: hostDecision.key,
      optionKey: hostDecision.options[0].key
    }
  };
  const decided = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/mechanism-runtime/actions`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": decisionIdempotencyKey
    },
    payload: decisionPayload
  });
  assert.equal(decided.statusCode, 200, decided.body);
  assert.equal(decided.json().state.revision, 3);
  assert.deepEqual(decided.json().contentGrants, [{
    contentType: "clue",
    clueId,
    clueName: "密令残页",
    roleSlotId: targetRoleId,
    roleName: "队长",
    status: "granted",
    acquiredAt: decided.json().contentGrants[0].acquiredAt
  }]);

  const replayed = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/mechanism-runtime/actions`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": decisionIdempotencyKey
    },
    payload: decisionPayload
  });
  assert.equal(replayed.statusCode, 200, replayed.body);
  assert.deepEqual(replayed.json().contentGrants, decided.json().contentGrants);

  const ownership = await query(
    `SELECT COUNT(*)::int AS count, MIN(metadata->>'source') AS source
     FROM clue_ownership
     WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
    [roomId, targetRoleId, clueId]
  );
  assert.equal(ownership.rows[0].count, 1);
  assert.equal(ownership.rows[0].source, "mechanism_settlement");
  const actionLogs = await query(
    `SELECT COUNT(*)::int AS count, MIN(metadata->'contentGrants'->0->>'status') AS status
     FROM room_mechanism_action_log
     WHERE room_id = $1 AND action_type = 'decision'`,
    [roomId]
  );
  assert.equal(actionLogs.rows[0].count, 1);
  assert.equal(actionLogs.rows[0].status, "granted");
  const audit = await query(
    `SELECT metadata FROM host_audit_log
     WHERE room_id = $1 AND action = 'mechanism_decision'
     ORDER BY created_at DESC LIMIT 1`,
    [roomId]
  );
  assert.equal(audit.rows[0].metadata.contentGrants[0].clueId, clueId);

  const targetHome = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(targetHome.statusCode, 200, targetHome.body);
  assert.equal(targetHome.json().clues.some((clue) => clue.id === clueId), true);

  const observerHome = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/player-home`,
    headers: { "x-user-id": observerUserId }
  });
  assert.equal(observerHome.statusCode, 200, observerHome.body);
  assert.equal(observerHome.json().clues.some((clue) => clue.id === clueId), false);

  const completed = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/mechanism-runtime/actions`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": `mechanism-advance-${randomUUID()}`
    },
    payload: { expectedRevision: 3, action: { type: "advance" } }
  });
  assert.equal(completed.statusCode, 200, completed.body);
  assert.equal(completed.json().state.status, "completed");

  const finalPlayerState = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/current-state`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(finalPlayerState.statusCode, 200, finalPlayerState.body);
  assert.equal(finalPlayerState.json().mechanism.status, "completed");
  assert.equal(finalPlayerState.json().mechanism.ending.title, "授权获得承认");
});
