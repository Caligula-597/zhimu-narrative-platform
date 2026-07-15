import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("production launch contract enforces Trusted Types", () => {
  const env = fs.readFileSync(path.join(root, "backend/.env.production.example"), "utf8");
  const ops = fs.readFileSync(path.join(root, "docs/ops/LAUNCH_ENV.md"), "utf8");
  for (const source of [env, ops]) {
    assert.match(source, /^CSP_MODE=enforce$/m);
    assert.match(source, /^TRUSTED_TYPES_ENFORCE=true$/m);
    assert.match(source, /^TRUSTED_TYPES_REPORT_ONLY=false$/m);
  }
});

test("Writer and Director use fragment-guarded template boundaries", () => {
  for (const file of ["src/views/writer.js", "src/views/director.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /htmlFragment/);
    assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/);
  }
});
