import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function migration(name) {
  return fs.readFileSync(path.join(root, "migrations", name), "utf8");
}

test("room experience migration is a versioned reusable extension boundary", () => {
  const sql = migration("110_room_experience_states.sql");
  assert.match(sql, /CREATE TABLE room_experience_states/u);
  assert.match(sql, /schema_version integer NOT NULL DEFAULT 1/u);
  assert.match(sql, /revision bigint NOT NULL DEFAULT 1/u);
  assert.match(sql, /CHECK \(jsonb_typeof\(payload\) = 'object'\)/u);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/u);
  assert.match(sql, /room_experience_states_expiry_idx/u);
});

test("communication and mini-game upgrades retain stable forward-compatible contracts", () => {
  const communication = migration("111_communication_templates.sql");
  assert.match(communication, /public_statement/u);
  assert.match(communication, /visibility IN \([^)]*'public'/su);
  assert.match(communication, /room_private_actions_public_idx/u);

  const miniGame = migration("112_mini_game_protocol.sql");
  for (const column of ["protocol_version", "deadline_at", "revision", "settlement"]) {
    assert.match(miniGame, new RegExp(`\\b${column}\\b`, "u"));
  }
  for (const status of ["active", "completed", "failed", "timed_out", "skipped"]) {
    assert.match(miniGame, new RegExp(`'${status}'`, "u"));
  }
  assert.match(miniGame, /room_mini_games_active_deadline_idx/u);
});
