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
    "src/runtime/auth-world.js",
    "export async function createParallelRoom",
    "export async function setRoomPublicListing"
  );
  const wizardCreate = section(
    "src/runtime/wizard.js",
    "export async function finishWizard",
    "registerRuntime"
  );
  const hostCreate = section(
    "host/src/runtime/host-lifecycle-controller.js",
    "async function createHostRoom",
    "async function selectRoom"
  );
  for (const runtime of [mainCreate, wizardCreate, hostCreate]) {
    assert.doesNotMatch(runtime, /createRoom\([^;\n]*inviteCode/);
  }
});

test("Creator room UI sends the selected Release and restores the action after failure", () => {
  const mainCreate = section(
    "src/runtime/auth-world.js",
    "export async function createParallelRoom",
    "export async function setRoomPublicListing"
  );
  assert.match(mainCreate, /data-room-release/);
  assert.match(mainCreate, /\{name,publicListing,releaseId\}/);
  assert.match(mainCreate, /button\.disabled=true/);
  assert.match(mainCreate, /button\.disabled=false/);
});
