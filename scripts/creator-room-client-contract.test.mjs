import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function section(relative, start, end) {
  const text = source(relative);
  const startAt = text.indexOf(start);
  const endAt = text.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `${relative}: missing ${start}`);
  assert.notEqual(endAt, -1, `${relative}: missing ${end}`);
  return text.slice(startAt, endAt);
}

test("main and Host room clients opt into the shared idempotency transport", () => {
  const mainApi = section("src/api/room.js", "export function createRoom", "export function updateRoomPublicListing");
  const hostApi = section("host/src/api.js", "createRoom:", "getStudio:");
  assert.match(mainApi, /idempotent:\s*true/);
  assert.match(hostApi, /idempotent:\s*true/);
});

test("creator room callers leave invite-code allocation to the server", () => {
  const mainCreate = section(
    "src/views/rooms.js",
    "export async function createParallelRoom",
    "export async function setRoomPublicListing"
  );
  const wizardCreate = section(
    "src/runtime/wizard.js",
    "export async function finishWizard",
    "registerRuntime"
  );
  const hostCreate = source("host/src/runtime/host-room-create-service.js");
  for (const runtime of [mainCreate, wizardCreate, hostCreate]) {
    assert.doesNotMatch(runtime, /createRoom\([^;\n]*inviteCode/);
  }
  assert.match(hostCreate, /apiRef\.createRoom\(\s*parsed\.payload,\s*workspace\.worldId,\s*idempotencyKey/s);
});

test("Creator room workspace sends the selected Release and restores the action after failure", () => {
  const roomView = section(
    "src/views/rooms.js",
    "export function rooms",
    "export async function refreshRoomWorkspace"
  );
  const mainCreate = section(
    "src/views/rooms.js",
    "export async function createParallelRoom",
    "export async function setRoomPublicListing"
  );
  assert.match(roomView, /data-room-draft="releaseId"/);
  assert.match(mainCreate, /releaseId:\s*state\.draft\.releaseId\s*\|\|\s*null/);
  assert.match(mainCreate, /state\.createSaving\s*=\s*true/);
  assert.match(mainCreate, /catch\s*\(error\)\s*\{[\s\S]*?state\.createSaving\s*=\s*false/);
  assert.match(mainCreate, /state\.error\s*=\s*normalizeError/);
  assert.match(mainCreate, /render\(\)/);
});

test("Creator room Release changes stay inline and preserve preview-before-apply", () => {
  const api = source("src/api/room.js");
  const roomView = source("src/views/rooms.js");
  const releaseWorkspace = source("src/views/room-release-workspace.js");
  const actions = source("src/runtime/actions-workspace.js");
  assert.match(api, /export function getRoomContentPolicy/);
  assert.match(api, /export function getRoomReleaseImpact/);
  assert.match(api, /export function applyRoomRelease/);
  assert.match(releaseWorkspace, /class="room-release-change-panel"/);
  assert.doesNotMatch(`${roomView}\n${releaseWorkspace}`, /openModal|modalBackdrop/);
  assert.match(releaseWorkspace, /impactFingerprint:\s*impact\.fingerprint/);
  assert.match(releaseWorkspace, /expectedCurrentReleaseId:/);
  assert.match(actions, /case "room-release-preview"/);
  assert.match(actions, /case "room-release-apply"/);
});

test("Creator, Host, and Player render the shared current beat contract", () => {
  const creator = source("src/views/rooms.js");
  const host = source("host/src/views/console.js");
  const player = source("play/src/views/game-home-views.js");
  assert.match(creator, /currentBeat\.position/);
  assert.match(creator, /currentBeat\?\.host\?\.dmTasks/);
  assert.match(host, /runtimeState\.currentBeat/);
  assert.match(host, /roomContentBindingPresentation\(runtimeState\.contentBinding\|\|room\.contentBinding\)/);
  assert.match(player, /currentBeat\?\.player\?\.content/);
  assert.doesNotMatch(player, /currentBeat\?\.host/);
});
