import { createHash } from "node:crypto";

/** Keep hashes stable across Git checkout line-ending policies. */
export function canonicalMigrationSql(sql) {
  return String(sql).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function migrationChecksum(sql) {
  return createHash("sha256").update(canonicalMigrationSql(sql), "utf8").digest("hex");
}

export function validateMigrationFilenames(files) {
  const seen = new Map();
  for (const filename of files) {
    const match = /^(\d{3})_[a-z0-9][a-z0-9_]*\.sql$/.exec(filename);
    if (!match) {
      throw new Error(`Invalid migration filename: ${filename}; expected NNN_snake_case.sql`);
    }
    const sequence = Number(match[1]);
    if (seen.has(sequence)) {
      throw new Error(`Duplicate migration sequence ${match[1]}: ${seen.get(sequence)}, ${filename}`);
    }
    seen.set(sequence, filename);
  }

  const sequences = [...seen.keys()].sort((a, b) => a - b);
  for (let index = 0; index < sequences.length; index += 1) {
    const expected = index + 1;
    if (sequences[index] !== expected) {
      throw new Error(`Migration sequence gap: expected ${String(expected).padStart(3, "0")}, found ${String(sequences[index]).padStart(3, "0")}`);
    }
  }
}

/** Pure comparison used by the runner and unit tests. */
export function planMigrationIntegrity(fileEntries, appliedRows) {
  const local = new Map(fileEntries.map((entry) => [entry.filename, entry.checksum]));
  const applied = new Map(appliedRows.map((row) => [row.filename, row.checksum || null]));
  const unknown = [...applied.keys()].filter((filename) => !local.has(filename));
  const drifted = [];
  const baseline = [];

  for (const [filename, checksum] of local) {
    if (!applied.has(filename)) continue;
    const recorded = applied.get(filename);
    if (!recorded) baseline.push({ filename, checksum });
    else if (recorded !== checksum) drifted.push({ filename, expected: recorded, actual: checksum });
  }

  const pending = [...local.keys()].filter((filename) => !applied.has(filename));
  return { unknown, drifted, baseline, pending };
}
