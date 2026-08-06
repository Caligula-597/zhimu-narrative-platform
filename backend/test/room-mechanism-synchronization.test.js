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
    players: [],
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
          effects: [{ targetType: "state", targetKey: "state-auth", operation: "set", value: "accepted" }]
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
  const world = (await query(
    `INSERT INTO worlds (owner_user_id, name, settings)
     VALUES ($1, $2, '{"worldMode":"scripted"}'::jsonb)
     RETURNING id`,
    [hostUserId, `mechanism-sync-${marker}`]
  )).rows[0];
  context.after(async () => {
    await query("DELETE FROM rooms WHERE world_id = $1", [world.id]);
    await query("DELETE FROM worlds WHERE id = $1", [world.id]);
  });
  await query(
    "INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')",
    [world.id, hostUserId]
  );
  const role = (await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '队长', '公开身份', '私人身份', 1) RETURNING id`,
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
  return { roomId: room.id };
}

test("host mechanism actions commit and player receives only the safe synchronized projection", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const { roomId } = await createFixture(context, app);
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

  const decided = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/host/mechanism-runtime/actions`,
    headers: {
      "x-user-id": hostUserId,
      "idempotency-key": `mechanism-decision-${randomUUID()}`
    },
    payload: {
      expectedRevision: 2,
      action: {
        type: "decision",
        decisionKey: hostDecision.key,
        optionKey: hostDecision.options[0].key
      }
    }
  });
  assert.equal(decided.statusCode, 200, decided.body);
  assert.equal(decided.json().state.revision, 3);

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
