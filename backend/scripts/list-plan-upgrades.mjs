#!/usr/bin/env node
import pg from "pg";
import "dotenv/config";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});
await client.connect();
const rows = await client.query(`
  SELECT pur.*
  FROM plan_upgrade_requests pur
  ORDER BY pur.created_at DESC
  LIMIT 30
`);
const stats = await client.query(
  `SELECT status, COUNT(*)::int AS n FROM plan_upgrade_requests GROUP BY status ORDER BY status`
);
console.log(JSON.stringify({ stats: stats.rows, requests: rows.rows }, null, 2));
await client.end();
