#!/usr/bin/env node
/** Assign a plan tier to a user by email. Usage: node scripts/set-user-plan.mjs user@example.com beta */
import { pool, query } from "../src/db.js";
import { setUserPlan, PLAN_DEFAULTS } from "../src/plans.js";
import { applyInternalBetaPrivileges } from "../src/internal-accounts.js";

const [emailArg, planArg] = process.argv.slice(2);
if (!emailArg || !planArg) {
  console.error("Usage: node scripts/set-user-plan.mjs <email> <plan>");
  console.error("Plans:", Object.keys(PLAN_DEFAULTS).join(", "));
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const planCode = planArg.trim().toLowerCase();
if (!PLAN_DEFAULTS[planCode]) {
  console.error(`Unknown plan: ${planCode}`);
  process.exit(1);
}

try {
  const row = await query(`SELECT id FROM users WHERE lower(email) = $1 AND user_kind = 'registered'`, [email]);
  if (!row.rowCount) {
    console.error(`No registered user for ${email}`);
    process.exit(1);
  }
  const userId = row.rows[0].id;
  await setUserPlan(userId, planCode);
  if (planCode === "beta") await applyInternalBetaPrivileges(userId, email);
  console.log(`Set ${email} → plan ${planCode}`);
} finally {
  await pool.end();
}
