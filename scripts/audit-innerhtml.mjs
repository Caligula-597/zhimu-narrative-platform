/**
 * Track innerHTML usage for XSS audit (Trusted Beta TB-1).
 * Usage: npm run audit:innerhtml
 * Fails when count exceeds AUDIT_INNERHTML_MAX (default 0).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src", "host/src", "play/src", "frontend", "app.js"].map((p) => join(root, p));
const ASSIGN_RE = /\.innerHTML\s*=/g;
const READ_RE = /\.innerHTML(?!\s*=)/g;
const MAX = Number(process.env.AUDIT_INNERHTML_MAX || 0);
const FILE_MAX = new Map([
  ["src/views/writer.js", 0],
  ["src/views/director.js", 0],
  ["src/components/creator-guide.js", 0],
  ["src/runtime/global-search.js", 0],
  ["src/views/pipeline-wizard-open.js", 0],
  ["src/views/platform-runtime.js", 0],
  ["src/views/player.js", 0],
  ["src/views/account.js", 0],
  ["src/views/archive.js", 0],
  ["src/views/settings.js", 0]
]);

function toPosixRel(file) {
  return relative(root, file).replace(/\\/g, "/");
}

function walkFiles(path, out = []) {
  try {
    const stat = readdirSync(path, { withFileTypes: true });
    for (const entry of stat) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walkFiles(full, out);
      } else if (/\.(js|mjs|html)$/.test(entry.name)) {
        out.push(full);
      }
    }
  } catch {
    if (/\.(js|mjs|html)$/.test(path)) out.push(path);
  }
  return out;
}

function scanFile(file) {
  const content = readFileSync(file, "utf8");
  const assigns = content.match(ASSIGN_RE)?.length ?? 0;
  const reads = content.match(READ_RE)?.length ?? 0;
  return { assigns, reads, total: assigns + reads };
}

const files = [];
for (const dir of SCAN_DIRS) walkFiles(dir, files);

let assignTotal = 0;
let readTotal = 0;
const hotspots = [];

for (const file of files) {
  const { assigns, reads, total } = scanFile(file);
  if (!total) continue;
  assignTotal += assigns;
  readTotal += reads;
  hotspots.push({ file: toPosixRel(file), assigns, reads, total });
}

hotspots.sort((a, b) => b.total - a.total);

console.log(`innerHTML audit: ${assignTotal} assignments, ${readTotal} reads (${assignTotal + readTotal} total)`);
console.log("Top hotspots:");
for (const row of hotspots.slice(0, 12)) {
  console.log(`  ${row.total}\t${row.file} (${row.assigns} assign, ${row.reads} read)`);
}

for (const row of hotspots) {
  const limit = FILE_MAX.get(row.file);
  if (limit != null && row.total > limit) {
    console.error(`\ninnerHTML hotspot ${row.file}=${row.total} exceeds file budget ${limit}`);
    process.exit(1);
  }
}

if (assignTotal + readTotal > MAX) {
  console.error(`\n✗ innerHTML total ${assignTotal + readTotal} exceeds max ${MAX}`);
  console.error("  Fix XSS sinks or raise AUDIT_INNERHTML_MAX after review.");
  process.exit(1);
}

console.log(`\n✓ innerHTML within budget (max ${MAX})`);
