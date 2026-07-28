import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  hostConsoleUrl,
  hostRoomIdFromSearch,
  playerJoinUrl
} from "../shared/portal-links.js";

test("portal links preserve the room or invite context with canonical parameters", () => {
  assert.equal(
    hostConsoleUrl("https://host.example.com/", "room / 1"),
    "https://host.example.com/?room=room%20%2F%201"
  );
  assert.equal(
    playerJoinUrl("https://play.example.com/", "JOIN / 1"),
    "https://play.example.com/?join=JOIN%20%2F%201"
  );
  assert.equal(hostConsoleUrl("https://host.example.com/", ""), "https://host.example.com");
  assert.equal(playerJoinUrl("https://play.example.com/", ""), "https://play.example.com");
});

test("Host accepts old Creator roomId links while preferring the canonical room key", () => {
  assert.equal(hostRoomIdFromSearch("?room=canonical&roomId=legacy"), "canonical");
  assert.equal(hostRoomIdFromSearch("?roomId=legacy"), "legacy");
  assert.equal(hostRoomIdFromSearch(new URLSearchParams("room=room-1")), "room-1");
});

test("Creator and Host surfaces use the shared cross-portal contract", () => {
  const creatorLinks = fs.readFileSync(new URL("../src/runtime/invite-links.js", import.meta.url), "utf8");
  const firstRun = fs.readFileSync(new URL("../src/components/first-run-chooser.js", import.meta.url), "utf8");
  const roomWorkspace = fs.readFileSync(new URL("../src/views/rooms.js", import.meta.url), "utf8");
  const hostLifecycle = fs.readFileSync(new URL("../host/src/runtime/host-lifecycle-controller.js", import.meta.url), "utf8");
  const hostHeader = fs.readFileSync(new URL("../host/src/components/header.js", import.meta.url), "utf8");
  const hostApi = fs.readFileSync(new URL("../host/src/api.js", import.meta.url), "utf8");
  const playApi = fs.readFileSync(new URL("../play/src/api.js", import.meta.url), "utf8");
  const hostStyles = fs.readFileSync(new URL("../host/src/styles.css", import.meta.url), "utf8");

  assert.match(creatorLinks, /buildHostConsoleUrl\(base, id\)/);
  assert.doesNotMatch(creatorLinks, /\?roomId=/);
  assert.match(firstRun, /playSiteOrigin/);
  assert.doesNotMatch(firstRun, /playSiteUrl|playOrigin\?\./);
  assert.match(roomWorkspace, /data-action="open-player-portal"[\s\S]*?data-invite-code/);
  assert.match(roomWorkspace, /data-action="open-host-console"[\s\S]*?data-room-id/);
  assert.ok(
    roomWorkspace.indexOf("const DEFAULT_ROOM_CONTENT_POLICY") < roomWorkspace.indexOf("createRoomWorkspaceState();"),
    "room workspace defaults must initialize before the initial workspace state"
  );
  assert.match(hostLifecycle, /state\.pendingRoomId/);
  assert.match(hostLifecycle, /await enterPendingRoom\(\)/);
  assert.match(hostLifecycle, /if \(state\.user && getWorldId\(\) && getRoomId\(\)\)/);
  assert.match(hostHeader, /getPlayerJoinUrl\(room\?\.invite_code\)/);
  assert.match(hostHeader, /aria-label="打开创作者端"/);
  assert.match(hostStyles, /\.host-nav-link,\s*\.host-room-switch\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(hostApi, /viteEnv\.DEV\s*\?\s*"http:\/\/127\.0\.0\.1:4173"/);
  assert.match(hostApi, /viteEnv\.DEV\s*\?\s*"http:\/\/127\.0\.0\.1:5174"/);
  assert.match(playApi, /viteEnv\.DEV\s*\?\s*"http:\/\/127\.0\.0\.1:4173"/);
});
