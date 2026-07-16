/**
 * Track direct innerHTML usage for XSS audit (Trusted Beta TB-1).
 * Usage: npm run audit:innerhtml
 * Product code must have no direct sinks. shared/safe-dom.js is the single
 * reviewed primitive and has an exact, fail-closed budget.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src", "host/src", "play/src", "frontend", "site", "shared", "app.js"].map((p) => join(root, p));
const ASSIGN_RE = /\.innerHTML\s*=/g;
const READ_RE = /\.innerHTML(?!\s*=)/g;
const MAX = 0;
const REVIEWED_SINKS = new Map([
  ["shared/safe-dom.js", { assigns: 2, reads: 0 }]
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
  const content = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join("\n");
  const assigns = content.match(ASSIGN_RE)?.length ?? 0;
  const reads = content.match(READ_RE)?.length ?? 0;
  return { assigns, reads, total: assigns + reads };
}

const files = [];
for (const dir of SCAN_DIRS) walkFiles(dir, files);

let productAssignTotal = 0;
let productReadTotal = 0;
const hotspots = [];
const reviewed = [];

for (const file of files) {
  const { assigns, reads, total } = scanFile(file);
  if (!total) continue;
  const relativeFile = toPosixRel(file);
  const sinkBudget = REVIEWED_SINKS.get(relativeFile);
  if (sinkBudget) {
    reviewed.push({ file: relativeFile, assigns, reads, total });
  } else {
    productAssignTotal += assigns;
    productReadTotal += reads;
    hotspots.push({ file: relativeFile, assigns, reads, total });
  }
}

hotspots.sort((a, b) => b.total - a.total);

console.log(
  `innerHTML product audit: ${productAssignTotal} assignments, ${productReadTotal} reads `
  + `(${productAssignTotal + productReadTotal} total)`
);
console.log("Unreviewed hotspots:");
for (const row of hotspots.slice(0, 12)) {
  console.log(`  ${row.total}\t${row.file} (${row.assigns} assign, ${row.reads} read)`);
}

for (const [file, budget] of REVIEWED_SINKS) {
  const row = reviewed.find((entry) => entry.file === file) ?? { assigns: 0, reads: 0 };
  if (row.assigns !== budget.assigns || row.reads !== budget.reads) {
    console.error(
      `\nReviewed sink ${file} changed: ${row.assigns} assignments/${row.reads} reads; `
      + `expected ${budget.assigns}/${budget.reads}. Re-review the primitive before changing its budget.`
    );
    process.exit(1);
  }
  console.log(`Reviewed sink: ${file} (${row.assigns} assign, ${row.reads} read)`);
}

if (productAssignTotal + productReadTotal > MAX) {
  console.error(`\n✗ unreviewed innerHTML total ${productAssignTotal + productReadTotal} exceeds max ${MAX}`);
  console.error("  Route writes through shared/safe-dom.js; do not raise the product budget without review.");
  process.exit(1);
}

console.log(`\n✓ unreviewed innerHTML within budget (max ${MAX})`);
