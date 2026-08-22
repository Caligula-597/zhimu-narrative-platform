import { pool } from "../src/db.js";
const worlds = await pool.query(`SELECT id, name FROM worlds ORDER BY created_at DESC LIMIT 10`);
console.log(worlds.rows);
const clues = await pool.query(
  `SELECT world_id, count(*)::int AS c FROM clues GROUP BY world_id ORDER BY c DESC`
);
console.log(clues.rows);
await pool.end();
