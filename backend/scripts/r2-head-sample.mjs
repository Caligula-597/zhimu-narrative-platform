#!/usr/bin/env node
/**
 * B0-04 R2 restore drill — sample one active asset_files row and HeadObject on R2.
 *
 * Usage:
 *   node scripts/r2-head-sample.mjs
 *   node scripts/r2-head-sample.mjs --limit 5
 */
import pg from "pg";
import "dotenv/config";
import { R2Storage } from "../src/storage/r2-storage.js";

const { Client } = pg;
const limit = Math.max(1, Math.min(20, Number(process.argv.find((a, i) => process.argv[i - 1] === "--limit") || 1)));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const required = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error(`Missing R2 env: ${missing.join(", ")}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  await client.connect();

  const startedAt = new Date().toISOString();
  let storage;
  try {
    const result = await client.query(
      `SELECT id, object_key, byte_size, content_type
       FROM asset_files
       WHERE status = 'active' AND object_key IS NOT NULL AND object_key <> ''
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    if (!result.rowCount) {
      console.log("No active asset_files rows — skip R2 head drill (empty bucket metadata).");
      process.exit(0);
    }

    storage = new R2Storage();
    const rows = [];
    for (const row of result.rows) {
      try {
        const stat = await storage.statObject({ key: row.object_key });
        const sizeOk = Number(row.byte_size) === 0 || stat.byteSize === Number(row.byte_size);
        rows.push({
          id: row.id,
          objectKey: row.object_key,
          dbByteSize: row.byte_size,
          r2ByteSize: stat.byteSize,
          contentType: stat.contentType,
          ok: sizeOk
        });
        console.log(
          sizeOk
            ? `✔ HeadObject ${row.object_key} (${stat.byteSize} bytes)`
            : `⚠ size mismatch ${row.object_key}: db=${row.byte_size} r2=${stat.byteSize}`
        );
      } catch (error) {
        rows.push({
          id: row.id,
          objectKey: row.object_key,
          ok: false,
          error: error.message
        });
        console.error(`✘ HeadObject ${row.object_key} — ${error.message}`);
        process.exitCode = 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          passed: rows.every((r) => r.ok),
          startedAt,
          finishedAt: new Date().toISOString(),
          bucket: process.env.R2_BUCKET,
          sampled: rows.length,
          rows
        },
        null,
        2
      )
    );
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
