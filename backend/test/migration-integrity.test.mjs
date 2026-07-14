import assert from "node:assert/strict";
import test from "node:test";
import {
  migrationChecksum,
  planMigrationIntegrity,
  validateMigrationFilenames
} from "../scripts/migration-integrity.mjs";

test("migration checksum is stable across checkout line endings and BOM", () => {
  const lf = "CREATE TABLE example (id int);\n";
  assert.equal(migrationChecksum(lf), migrationChecksum(`\uFEFF${lf.replaceAll("\n", "\r\n")}`));
  assert.notEqual(migrationChecksum(lf), migrationChecksum("CREATE TABLE example (id bigint);\n"));
});

test("migration filenames must be valid, unique and contiguous", () => {
  assert.doesNotThrow(() => validateMigrationFilenames(["001_initial.sql", "002_add_rooms.sql"]));
  assert.throws(() => validateMigrationFilenames(["001_initial.sql", "003_gap.sql"]), /sequence gap/);
  assert.throws(() => validateMigrationFilenames(["001_a.sql", "001_b.sql"]), /Duplicate migration sequence/);
  assert.throws(() => validateMigrationFilenames(["1_bad.sql"]), /Invalid migration filename/);
});

test("integrity plan separates baselines, drift, pending and unknown files", () => {
  const plan = planMigrationIntegrity(
    [
      { filename: "001_initial.sql", checksum: "new-a" },
      { filename: "002_rooms.sql", checksum: "same-b" },
      { filename: "003_pending.sql", checksum: "new-c" }
    ],
    [
      { filename: "001_initial.sql", checksum: null },
      { filename: "002_rooms.sql", checksum: "old-b" },
      { filename: "099_removed.sql", checksum: "old-z" }
    ]
  );

  assert.deepEqual(plan.baseline, [{ filename: "001_initial.sql", checksum: "new-a" }]);
  assert.deepEqual(plan.drifted, [{ filename: "002_rooms.sql", expected: "old-b", actual: "same-b" }]);
  assert.deepEqual(plan.pending, ["003_pending.sql"]);
  assert.deepEqual(plan.unknown, ["099_removed.sql"]);
});
