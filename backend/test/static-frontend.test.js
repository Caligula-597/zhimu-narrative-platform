import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";

test("SERVE_STATIC serves /docs/*.md and does not SPA-fallback docs to index.html", async (context) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zhimu-static-"));
  const root = path.join(tmp, "dist");
  const docsDir = path.join(root, "docs");
  const assetsDir = path.join(root, "assets");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html><title>app</title>");
  fs.writeFileSync(path.join(docsDir, "CREATOR_GUIDE.md"), "# Guide\n\nHello");
  fs.writeFileSync(path.join(assetsDir, "writer-AbC123.js"), "export {};");
  context.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const prevStatic = process.env.SERVE_STATIC;
  const prevRoot = process.env.STATIC_ROOT;
  process.env.SERVE_STATIC = "true";
  process.env.STATIC_ROOT = root;

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(async () => {
    await app.close();
    if (prevStatic === undefined) delete process.env.SERVE_STATIC;
    else process.env.SERVE_STATIC = prevStatic;
    if (prevRoot === undefined) delete process.env.STATIC_ROOT;
    else process.env.STATIC_ROOT = prevRoot;
  });

  const ok = await app.inject({ method: "GET", url: "/docs/CREATOR_GUIDE.md" });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.headers["content-type"] || "", /markdown/i);
  assert.match(ok.body, /# Guide/);

  const missing = await app.inject({ method: "GET", url: "/docs/DOES_NOT_EXIST.md" });
  assert.equal(missing.statusCode, 404);
  assert.ok(!/<!doctype/i.test(missing.body));
  assert.equal(missing.headers["cache-control"], "no-store");

  const index = await app.inject({ method: "GET", url: "/" });
  assert.equal(index.statusCode, 200);
  assert.equal(index.headers["cache-control"], "public, max-age=0, must-revalidate");
  assert.equal(index.headers["x-robots-tag"], "noindex, nofollow, noarchive");

  const asset = await app.inject({ method: "GET", url: "/assets/writer-AbC123.js" });
  assert.equal(asset.statusCode, 200);
  assert.equal(asset.headers["cache-control"], "public, max-age=31536000, immutable");
  assert.equal(asset.headers["x-robots-tag"], "noindex, nofollow, noarchive");

  const missingAsset = await app.inject({ method: "GET", url: "/assets/writer-old.js" });
  assert.equal(missingAsset.statusCode, 404);
  assert.equal(missingAsset.headers["cache-control"], "no-store");
});
