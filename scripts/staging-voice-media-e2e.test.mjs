import assert from "node:assert/strict";
import test from "node:test";
import {
  readVoiceE2eConfig,
  REQUIRED_VOICE_E2E_ENV,
} from "./staging-voice-media-e2e.mjs";

test("staging voice gate lists every required isolated credential", () => {
  assert.deepEqual(REQUIRED_VOICE_E2E_ENV, [
    "VOICE_E2E_API_URL",
    "VOICE_E2E_HOST_URL",
    "VOICE_E2E_PLAY_URL",
    "VOICE_E2E_WORLD_ID",
    "VOICE_E2E_ROOM_ID",
    "VOICE_E2E_HOST_TOKEN",
    "VOICE_E2E_PLAYER_A_TOKEN",
    "VOICE_E2E_PLAYER_B_TOKEN",
  ]);
  assert.throws(() => readVoiceE2eConfig({}), /missing staging voice environment/u);
});

test("staging voice gate normalizes URLs without exposing tokens in public config fields", () => {
  const config = readVoiceE2eConfig({
    VOICE_E2E_API_URL: "https://api.staging.example/",
    VOICE_E2E_HOST_URL: "https://host.staging.example/",
    VOICE_E2E_PLAY_URL: "https://play.staging.example/",
    VOICE_E2E_WORLD_ID: "world-1",
    VOICE_E2E_ROOM_ID: "room-1",
    VOICE_E2E_HOST_TOKEN: "host-secret",
    VOICE_E2E_PLAYER_A_TOKEN: "player-a-secret",
    VOICE_E2E_PLAYER_B_TOKEN: "player-b-secret",
    VOICE_E2E_EVIDENCE_DIR: "output/voice-contract-test",
  });
  assert.equal(config.apiUrl, "https://api.staging.example");
  assert.equal(config.hostUrl, "https://host.staging.example");
  assert.equal(config.playUrl, "https://play.staging.example");
  assert.equal(JSON.stringify({
    apiUrl: config.apiUrl,
    hostUrl: config.hostUrl,
    playUrl: config.playUrl,
    roomId: config.roomId,
  }).includes("secret"), false);
});
