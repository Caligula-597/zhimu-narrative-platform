import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { productionArtifactGuard } from "../config/production-artifact-guard.mjs";

function createFixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "zhimu-artifact-guard-"));
  const root = path.join(parent, "dist");
  const assets = path.join(root, "assets", "nested");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>");
  fs.writeFileSync(path.join(assets, "app.js"), "console.log('ok')");
  fs.writeFileSync(path.join(assets, "app.js.map"), "{}");
  return root;
}

test("production artifact guard clears stale output before the build", () => {
  const root = createFixture();
  const guard = productionArtifactGuard({ enabled: true, outDir: root });
  guard.buildStart();
  assert.equal(fs.existsSync(path.join(root, "assets", "nested", "app.js")), false);
  assert.equal(fs.existsSync(root), true);
});

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

test("artifact guard refuses to recursively clean a non-dist directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhimu-artifact-guard-unsafe-"));
  const guard = productionArtifactGuard({ enabled: true, outDir: root });
  assert.throws(() => guard.buildStart(), /Refusing to clean unsafe production output directory/);
});

test("artifact guard removes old hashed bundles without deleting public assets", () => {
  const root = createFixture();
  const assets = path.join(root, "assets");
  fs.writeFileSync(path.join(assets, "main-current123.js"), "current");
  fs.writeFileSync(path.join(assets, "main-stale12345.js"), "stale");
  fs.writeFileSync(path.join(assets, "theme-stale12345.css"), "stale");
  fs.writeFileSync(path.join(assets, "product-image.png"), "public");

  const guard = productionArtifactGuard({ enabled: true, outDir: root });
  guard.writeBundle({}, {
    "assets/main-current123.js": { fileName: "assets/main-current123.js" }
  });

  assert.equal(fs.existsSync(path.join(assets, "main-current123.js")), true);
  assert.equal(fs.existsSync(path.join(assets, "main-stale12345.js")), false);
  assert.equal(fs.existsSync(path.join(assets, "theme-stale12345.css")), false);
  assert.equal(fs.existsSync(path.join(assets, "product-image.png")), true);
});

test("all Pages builds pin their root and clear stale output", () => {
  const configs = [
    ["site/vite.config.js", /root,\s*\n\s*publicDir:\s*"public"/],
    ["host/vite.config.mjs", /root,\s*\n\s*publicDir:\s*"public"/],
    ["play/vite.config.mjs", /root:\s*"\."/]
  ];

  for (const [relativePath, rootPattern] of configs) {
    const source = fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
    assert.match(source, rootPattern, `${relativePath} must pin the Vite root`);
    assert.match(source, /outDir:\s*"dist"/, `${relativePath} must pin the output directory`);
    assert.match(source, /emptyOutDir:\s*true/, `${relativePath} must clear stale output`);
  }
});
