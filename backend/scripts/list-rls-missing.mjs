import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const sql = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
  .join("\n");

const created = [
  ...new Set(
    [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)]
      .map((m) => m[1])
      .filter((t) => t !== "schema_migrations")
  )
].sort();

const body = sql.match(/rls_tables\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/i)?.[1] ?? "";
const covered = [...new Set([...body.matchAll(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g)].map((m) => m[1]))].sort();

console.log(created.filter((t) => !covered.includes(t)).join("\n"));
