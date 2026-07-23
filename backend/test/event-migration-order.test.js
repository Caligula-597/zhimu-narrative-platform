import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("container applies event migrations before starting the API", () => {
  const entrypoint = fs.readFileSync(path.join(import.meta.dirname, "..", "deploy", "docker-entrypoint-api.sh"), "utf8");
  const fullstackDockerfile = fs.readFileSync(
    path.join(import.meta.dirname, "..", "..", "deploy", "Dockerfile.fullstack"),
    "utf8"
  );
  const migrateAt = entrypoint.indexOf("node scripts/migrate.js");
  const serverAt = entrypoint.indexOf("exec node src/server.js");
  assert.ok(migrateAt >= 0 && serverAt > migrateAt, "migrations must complete before API startup");
  assert.equal(entrypoint.includes("\r"), false, "the checked-in entrypoint must use LF line endings");
  assert.match(
    fullstackDockerfile,
    /sed -i 's\/\\r\$\/\/' \.\/deploy\/docker-entrypoint-api\.sh/,
    "the fullstack image must normalize Windows line endings before startup"
  );
  assert.ok(fs.existsSync(path.join(import.meta.dirname, "..", "migrations", "065_platform_event_journal.sql")));
  assert.ok(fs.existsSync(path.join(import.meta.dirname, "..", "migrations", "066_room_event_journal_retention_index.sql")));
});
