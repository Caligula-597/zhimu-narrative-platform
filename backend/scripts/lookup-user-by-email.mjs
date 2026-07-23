#!/usr/bin/env node
import pg from "pg";
import "dotenv/config";
import {
  resolveDatabaseSsl,
  resolveDatabaseUrl
} from "../src/database-connection-options.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/lookup-user-by-email.mjs user@example.com");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({
  connectionString: resolveDatabaseUrl(),
  ssl: resolveDatabaseSsl()
});
await client.connect();
const user = await client.query(
  `SELECT id, email, display_name, user_kind, created_at FROM users WHERE lower(email) = lower($1)`,
  [email]
);
let plan = null;
if (user.rowCount) {
  const planRes = await client.query(
    `SELECT plan_code, updated_at FROM user_plans WHERE user_id = $1`,
    [user.rows[0].id]
  );
  plan = planRes.rows[0] || null;
}
console.log(JSON.stringify({ user: user.rows[0] || null, plan }, null, 2));
await client.end();
