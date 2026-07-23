import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { productionArtifactGuard } from "../config/production-artifact-guard.mjs";

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhimu-artifact-guard-"));
  const assets = path.join(root, "assets", "nested");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>");
  fs.writeFileSync(path.join(assets, "app.js"), "console.log('ok')");
  fs.writeFileSync(path.join(assets, "app.js.map"), "{}");
  return root;
}

test("production artifact guard removes nested source maps and preserves runtime assets", () => {
  const root = createFixture();
  productionArtifactGuard({ enabled: true, outDir: root }).closeBundle();
  assert.equal(fs.existsSync(path.join(root, "assets", "nested", "app.js.map")), false);
  assert.equal(fs.existsSync(path.join(root, "assets", "nested", "app.js")), true);
  assert.equal(fs.existsSync(path.join(root, "index.html")), true);
});

test("artifact guard leaves non-production output untouched", () => {
  const root = createFixture();
  productionArtifactGuard({ enabled: false, outDir: root }).closeBundle();
  assert.equal(fs.existsSync(path.join(root, "assets", "nested", "app.js.map")), true);
});
