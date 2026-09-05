/**
 * P7.2.5 Runtime Code Health — layer / FSM / view DTO boundary tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMechanismTransition,
  normalizeMechanismExecution,
} from "../shared/playable-mechanism-execution.js";
import { canonicalPlayableErrorCode } from "../shared/playable-runtime-errors.js";
import { applyRuntimeEffect, applyRuntimeEffects } from "../shared/playable-runtime-effects.js";
import {
  buildHostPlayableView,
  buildPlayerPlayableView,
  buildRuntimePublicSummary,
  createPlayableRuntimeState,
  assignPlayableRole,
  startPlayableSession,
  advancePlayableStage,
} from "../shared/playable-content-runtime.js";
import { compileWarehouseSixFixture } from "../shared/playable-project-compiler.js";

const FIXED = () => "2026-09-05T15:00:00.000Z";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("error aliases canonicalize", () => {
  assert.equal(canonicalPlayableErrorCode("WRONG_STAGE"), "NOT_CURRENT_STAGE");
  assert.equal(canonicalPlayableErrorCode("MECHANISM_ALREADY_SETTLED"), "ALREADY_SETTLED");
  assert.equal(canonicalPlayableErrorCode("NOT_CURRENT_STAGE"), "NOT_CURRENT_STAGE");
});

test("mechanism execution FSM allows READY→RUNNING→SETTLED only", () => {
  assert.doesNotThrow(() => assertMechanismTransition("READY", "RUNNING"));
  assert.doesNotThrow(() => assertMechanismTransition("RUNNING", "SETTLED"));
  assert.doesNotThrow(() => assertMechanismTransition("SETTLED", "SETTLED"));
  assert.throws(() => assertMechanismTransition("SETTLED", "RUNNING"), (e) => e.code === "INVALID_TRANSITION");
  assert.throws(() => assertMechanismTransition("READY", "SETTLED"), (e) => e.code === "INVALID_TRANSITION");
  const exec = normalizeMechanismExecution({ status: "RUNNING", runtimeInstanceId: "x" }, "p1");
  assert.equal(exec.placementId, "p1");
  assert.equal(exec.status, "RUNNING");
});

test("applyRuntimeEffect is the single write entry used by batch", () => {
  const base = {
    permissionGrants: [],
    keyStates: {},
    appliedEffectKeys: [],
    playableSnapshot: { roles: [{ id: "role_a", type: "PLAYER" }], permissions: [] },
  };
  const one = applyRuntimeEffect(base, {
    effect: { type: "STATE_APPLY", key: "storage_room", value: "UNLOCKED_FOR_WINNER" },
    placementId: "p",
    outcomeId: "o",
    effectIndex: 0,
    targetRoleId: "role_a",
    now: FIXED,
  });
  assert.equal(one.applied, true);
  assert.equal(one.runtime.keyStates.storage_room, "UNLOCKED_FOR_WINNER");
  const again = applyRuntimeEffect(one.runtime, {
    effect: { type: "STATE_APPLY", key: "storage_room", value: "UNLOCKED_FOR_WINNER" },
    placementId: "p",
    outcomeId: "o",
    effectIndex: 0,
    targetRoleId: "role_a",
    now: FIXED,
  });
  assert.equal(again.applied, false);
  assert.equal(again.runtime.appliedEffectKeys.length, 1);

  const batch = applyRuntimeEffects(base, {
    effects: [{ type: "PERMISSION_GRANT", permissionId: "storage_room_access", target: "WINNER" }],
    placementId: "p",
    outcomeId: "o",
    winnerRoleId: "role_a",
    now: FIXED,
  });
  assert.equal(batch.permissionGrants.length, 1);
});

test("host/player views hide internal JSONB fields", () => {
  let runtime = createPlayableRuntimeState({
    roomId: "r",
    playableProject: compileWarehouseSixFixture({ now: FIXED }),
    now: FIXED,
  });
  for (const role of ["role_a", "role_b", "role_c", "role_d", "role_e", "role_f"]) {
    runtime = assignPlayableRole(runtime, { userId: `u_${role}`, playableRoleId: role, now: FIXED });
  }
  runtime = startPlayableSession(runtime, { now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED });
  const host = buildHostPlayableView(runtime);
  const player = buildPlayerPlayableView(runtime, { playableRoleId: "role_a" });
  const summary = buildRuntimePublicSummary(runtime);
  for (const banned of ["mechanismExecutions", "permissionGrants", "keyStates", "playableSnapshot", "appliedEffectKeys"]) {
    assert.equal(banned in host, false, `host leaked ${banned}`);
    assert.equal(banned in player, false, `player leaked ${banned}`);
    assert.equal(banned in summary, false, `summary leaked ${banned}`);
  }
  assert.ok(host.playerRoles?.length === 6);
  assert.ok(host.placements.every((p) => "canStart" in p && "canSettle" in p));
});

test("layer files do not let UI import mechanismExecutions", () => {
  const hostUi = fs.readFileSync(path.join(root, "host/src/views/host-playable-workspace.js"), "utf8");
  const playUi = fs.readFileSync(path.join(root, "play/src/views/game-home-views.js"), "utf8");
  assert.equal(/mechanismExecutions/.test(hostUi), false);
  assert.equal(/permissionGrants/.test(hostUi), false);
  assert.equal(/playableSnapshot/.test(hostUi), false);
  assert.equal(/mechanismExecutions/.test(playUi), false);
  assert.equal(/permissionGrants/.test(playUi), false);

  const bridge = fs.readFileSync(path.join(root, "shared/playable-mechanism-bridge.js"), "utf8");
  assert.match(bridge, /applyRuntimeEffects/);
  assert.equal(/permissionGrants\.push/.test(bridge), false);
  assert.equal(/keyStates\[/.test(bridge), false);
});
