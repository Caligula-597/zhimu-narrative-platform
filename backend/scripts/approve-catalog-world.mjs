/**
 * CLI wrapper for ops catalog approve (uses catalog-review-ops).
 * Usage: OPS_API_TOKEN=... node scripts/approve-catalog-world.mjs <world-id>
 * Or with DATABASE_URL for direct DB (legacy).
 */
import { approveCatalogReview } from "../src/catalog-review-ops.js";
import { pool } from "../src/db.js";

const worldId = process.argv[2];
if (!worldId) {
  console.error("Usage: node scripts/approve-catalog-world.mjs <world-id>");
  process.exit(1);
}

try {
  const row = await approveCatalogReview(worldId);
  console.log(JSON.stringify(row, null, 2));
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
} finally {
  await pool.end();
}
