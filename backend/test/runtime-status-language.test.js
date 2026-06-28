import assert from "node:assert/strict";
import test from "node:test";
import {
  clueStatusFromRuntime,
  playerStatusFromRuntime,
  roomStatusFromRuntime,
  runtimeStatus
} from "../src/runtime-status-language.js";

test("runtimeStatus normalizes known statuses and falls back safely", () => {
  assert.deepEqual(runtimeStatus("room", "CONNECTED"), {
    key: "connected",
    label: "实时连接",
    tone: "published"
  });
  assert.deepEqual(runtimeStatus("player", "missing", { label: "未知玩家", tone: "draft" }), {
    key: "missing",
    label: "未知玩家",
    tone: "draft"
  });
  assert.equal(runtimeStatus("clue", "").label, "未知");
});

test("roomStatusFromRuntime prioritizes live connection and active room", () => {
  assert.equal(roomStatusFromRuntime({ connected: true, hasActiveRoom: true }).key, "connected");
  assert.equal(roomStatusFromRuntime({ hasActiveRoom: true, hasRooms: true }).key, "active");
  assert.equal(roomStatusFromRuntime({ hasRooms: true }).key, "ready");
  assert.equal(roomStatusFromRuntime({}).key, "empty");
});

test("playerStatusFromRuntime keeps host-facing priority stable", () => {
  assert.equal(playerStatusFromRuntime({ joined: true, stuck: true }).key, "stuck");
  assert.equal(playerStatusFromRuntime({ joined: true, waiting: true }).key, "waiting");
  assert.equal(playerStatusFromRuntime({ complete: true }).key, "complete");
  assert.equal(playerStatusFromRuntime({ joined: true }).key, "joined");
  assert.equal(playerStatusFromRuntime({}).key, "offline");
});

test("clueStatusFromRuntime handles visibility, sharing, and incomplete audit", () => {
  assert.equal(clueStatusFromRuntime({ incomplete: true, visibility: "public" }).key, "incomplete");
  assert.equal(clueStatusFromRuntime({ key: true }).key, "key");
  assert.equal(clueStatusFromRuntime({ shared: true }).key, "shared");
  assert.equal(clueStatusFromRuntime({ read: true }).key, "read");
  assert.equal(clueStatusFromRuntime({ visibility: "public" }).key, "public");
  assert.equal(clueStatusFromRuntime({ visibility: "role" }).key, "private");
});
