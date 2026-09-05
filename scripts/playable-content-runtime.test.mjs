/**
 * P7.1 Content Runtime — visibility, stage advance, fixture full session.
 * Pure shared module (no DB).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileWarehouseSixFixture } from "../shared/playable-project-compiler.js";
import {
  PlayableContentRuntimeError,
  createPlayableRuntimeState,
  assignPlayableRole,
  startPlayableSession,
  releaseContentUnit,
  releaseClue,
  advancePlayableStage,
  finishPlayableSession,
  markContentRead,
  resolveVisibleContent,
  fetchContentUnitForRole,
  fetchClueForRole,
  buildHostPlayableView,
  buildPlayerPlayableView,
  normalizePlayableRuntimeState,
} from "../shared/playable-content-runtime.js";

const FIXED = () => "2026-09-05T12:00:00.000Z";
const ROOM = "room-fixture-warehouse-six";

function readyProject(overrides = {}) {
  const pp = compileWarehouseSixFixture({ now: FIXED, ...overrides });
  assert.equal(pp.status, "READY");
  return pp;
}

function assignAllSix(runtime) {
  const roles = ["role_a", "role_b", "role_c", "role_d", "role_e", "role_f"];
  let next = runtime;
  for (let i = 0; i < roles.length; i++) {
    next = assignPlayableRole(next, {
      userId: `user_${roles[i]}`,
      playableRoleId: roles[i],
      now: FIXED,
    });
  }
  return next;
}

function ids(units) {
  return new Set(units.map((u) => u.id));
}

test("start requires READY playable", () => {
  const pp = readyProject();
  pp.status = "STALE";
  assert.throws(
    () => createPlayableRuntimeState({ roomId: ROOM, playableProject: pp }),
    (e) => e instanceof PlayableContentRuntimeError && e.code === "PLAYABLE_NOT_READY",
  );
});

test("start freezes snapshot independent of later project mutation", () => {
  const pp = readyProject();
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: pp, now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  const frozenFp = runtime.playableFingerprint;
  const frozenRev = runtime.playableProjectRevision;
  const stage1Text = runtime.playableSnapshot.contentUnits.find((c) => c.id === "cu_a_s1").content;

  pp.revision = 999;
  pp.source = { ...(pp.source || {}), fingerprint: "mutated-after-start" };
  pp.contentUnits.find((c) => c.id === "cu_a_s1").content = "TAMPERED";

  assert.equal(runtime.playableFingerprint, frozenFp);
  assert.equal(runtime.playableProjectRevision, frozenRev);
  assert.equal(
    runtime.playableSnapshot.contentUnits.find((c) => c.id === "cu_a_s1").content,
    stage1Text,
  );
  assert.notEqual(stage1Text, "TAMPERED");
});

test("role assignment isolation + duplicate rejected", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignPlayableRole(runtime, { userId: "u1", playableRoleId: "role_a", now: FIXED });
  assert.throws(
    () => assignPlayableRole(runtime, { userId: "u2", playableRoleId: "role_a", now: FIXED }),
    (e) => e.code === "ROLE_TAKEN",
  );
  assert.throws(
    () => assignPlayableRole(runtime, { userId: "u1", playableRoleId: "role_b", now: FIXED }),
    (e) => e.code === "USER_ALREADY_ASSIGNED",
  );
  assert.throws(
    () => assignPlayableRole(runtime, { userId: "u3", playableRoleId: "role_host", now: FIXED }),
    (e) => e.code === "HOST_NOT_ASSIGNABLE",
  );
});

test("unassigned player start rejected", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignPlayableRole(runtime, { userId: "u1", playableRoleId: "role_a", now: FIXED });
  assert.throws(() => startPlayableSession(runtime, { now: FIXED }), (e) => e.code === "UNASSIGNED_ROLES");
});

test("AUTO_ON_STAGE / HOST_RELEASE / CONDITION_UNLOCK", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });

  const aVisible = ids(resolveVisibleContent({ runtime, roleId: "role_a" }));
  assert.ok(aVisible.has("cu_a_s1"));
  assert.ok(aVisible.has("cu_public_s1"));
  assert.ok(aVisible.has("cu_ab_shared_s1"));
  assert.ok(!aVisible.has("cu_a_s2"));
  assert.ok(!aVisible.has("cu_a_s2_win"));

  const blood = fetchClueForRole(runtime, { roleId: "role_a", clueId: "clue_blood_photo" });
  assert.equal(blood.ok, false);
  assert.equal(blood.code, "FORBIDDEN");

  runtime = releaseClue(runtime, { clueId: "clue_blood_photo", now: FIXED });
  assert.ok(fetchClueForRole(runtime, { roleId: "role_a", clueId: "clue_blood_photo" }).ok);

  assert.throws(
    () => releaseClue(runtime, { clueId: "clue_burned_ledger", now: FIXED }),
    (e) => e.code === "CONDITION_LOCKED" || e.code === "NOT_CURRENT_STAGE" || e.code === "WRONG_STAGE",
  );

  assert.ok(!ids(resolveVisibleContent({ runtime, roleId: "role_a" })).has("cu_a_s2_win"));
});

test("PRIVATE SHARED PUBLIC HOST_ONLY + unauthorized fetch", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });

  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_a", contentUnitId: "cu_a_s1" }).ok, true);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_a", contentUnitId: "cu_b_s1" }).ok, false);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_a", contentUnitId: "cu_host_host_s1" }).ok, false);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_a", contentUnitId: "cu_a_s3" }).ok, false);

  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_a", contentUnitId: "cu_ab_shared_s1" }).ok, true);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_b", contentUnitId: "cu_ab_shared_s1" }).ok, true);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_c", contentUnitId: "cu_ab_shared_s1" }).ok, false);

  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_c", contentUnitId: "cu_public_s1" }).ok, true);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_host", contentUnitId: "cu_host_host_s1" }).ok, true);
});

test("release clue idempotent + audience", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  runtime = releaseClue(runtime, { clueId: "clue_blood_photo", now: FIXED });
  const rev = runtime.revision;
  runtime = releaseClue(runtime, { clueId: "clue_blood_photo", now: FIXED });
  assert.equal(runtime.revision, rev);
  assert.equal(runtime.releasedClueIds.filter((id) => id === "clue_blood_photo").length, 1);
});

test("stage advance host path opens AUTO; player cannot conceptually advance without API", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  assert.equal(runtime.currentStageId, "stage_1");
  runtime = advancePlayableStage(runtime, { now: FIXED });
  assert.equal(runtime.currentStageId, "stage_2");
  assert.ok(ids(resolveVisibleContent({ runtime, roleId: "role_a" })).has("cu_a_s2"));
  assert.ok(ids(resolveVisibleContent({ runtime, roleId: "role_a" })).has("cu_a_s1"));
  assert.ok(!ids(resolveVisibleContent({ runtime, roleId: "role_a" })).has("cu_a_s3"));

  const host = buildHostPlayableView(runtime);
  assert.equal(host.placements.some((p) => p.id.includes("m03")), true);
  const m03 = host.placements.find((p) => p.id.includes("m03"));
  assert.equal(m03?.canStart, true);
  assert.equal(m03?.canSettle, false);
  assert.equal(m03?.status, "READY");
  assert.ok(Array.isArray(host.playerRoles));
  assert.equal(host.playerRoles.length, 6);
  assert.equal("permissionGrants" in host, false);
  assert.equal("keyStates" in host, false);
});

test("read receipt + persistence roundtrip shape", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  runtime = markContentRead(runtime, {
    roleId: "role_a",
    contentUnitId: "cu_a_s1",
    userId: "user_role_a",
    now: FIXED,
  });
  const json = JSON.parse(JSON.stringify(runtime));
  const restored = normalizePlayableRuntimeState(json);
  assert.equal(restored.readReceipts.length, 1);
  assert.equal(restored.currentStageId, "stage_1");
  assert.ok(ids(resolveVisibleContent({ runtime: restored, roleId: "role_a" })).has("cu_a_s1"));
});

test("fixture complete pure-text session Stage1→Final", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  assert.equal(runtime.status, "RUNNING");
  assert.equal(runtime.currentStageId, "stage_1");

  for (const role of ["role_a", "role_b", "role_c", "role_d", "role_e", "role_f"]) {
    const v = buildPlayerPlayableView(runtime, { playableRoleId: role });
    const letter = role.slice(-1);
    assert.ok(v.contentUnits.some((u) => u.id === `cu_${letter}_s1`));
    assert.ok(v.contentUnits.some((u) => u.id === "cu_public_s1"));
    assert.ok(!v.contentUnits.some((u) => String(u.id).startsWith("cu_host_")));
    assert.ok(!v.contentUnits.some((u) => u.stageId === "stage_2"));
  }

  runtime = releaseClue(runtime, { clueId: "clue_blood_photo", now: FIXED });
  assert.ok(fetchClueForRole(runtime, { roleId: "role_d", clueId: "clue_blood_photo" }).ok);

  runtime = advancePlayableStage(runtime, { now: FIXED }); // → 2
  const playerA = buildPlayerPlayableView(runtime, { playableRoleId: "role_a" });
  assert.ok(playerA.placements.some((p) => /库房|竞价|M03/i.test(p.title + p.note) || p.id.includes("m03")));
  assert.equal(playerA.placements.find((p) => p.id.includes("m03"))?.status, "READY");
  assert.equal(playerA.placements.every((p) => p.canBid === false), true);
  assert.equal("permissionGrants" in playerA, false);
  assert.equal("keyStates" in playerA, false);
  assert.ok(!ids(resolveVisibleContent({ runtime, roleId: "role_a" })).has("cu_a_s2_win"));

  runtime = advancePlayableStage(runtime, { now: FIXED }); // → 3
  runtime = releaseClue(runtime, { clueId: "clue_key_fragment", now: FIXED });
  assert.ok(fetchClueForRole(runtime, { roleId: "role_a", clueId: "clue_key_fragment" }).ok);

  runtime = advancePlayableStage(runtime, { now: FIXED }); // → 4
  const hostFinal = buildHostPlayableView(runtime);
  const m09 = hostFinal.placements.find((p) => p.id.includes("m09") || /指认|投票/i.test(p.title || ""));
  assert.ok(m09);
  assert.equal(m09.status, "READY");
  assert.equal(m09.canStart, true);
  assert.equal(hostFinal.canConfirmEnding, false);
  assert.throws(
    () => finishPlayableSession(runtime, { now: FIXED }),
    (e) => e.code === "NOT_READY_TO_SETTLE" || e.code === "ENDING_MISSING",
  );
});

test("source revision independence across two runtimes", () => {
  const pp5 = readyProject();
  pp5.revision = 5;
  pp5.source = { ...(pp5.source || {}), fingerprint: "fp-rev-5" };
  let roomA = createPlayableRuntimeState({ roomId: "room-a", playableProject: pp5, now: FIXED });
  roomA = assignAllSix(roomA);
  roomA = startPlayableSession(roomA, { now: FIXED });

  const pp6 = readyProject();
  pp6.revision = 6;
  pp6.source = { ...(pp6.source || {}), fingerprint: "fp-rev-6" };
  let roomB = createPlayableRuntimeState({ roomId: "room-b", playableProject: pp6, now: FIXED });
  roomB = assignAllSix(roomB);
  roomB = startPlayableSession(roomB, { now: FIXED });

  assert.equal(roomA.playableProjectRevision, 5);
  assert.equal(roomA.playableFingerprint, "fp-rev-5");
  assert.equal(roomB.playableProjectRevision, 6);
  assert.equal(roomB.playableFingerprint, "fp-rev-6");
});
