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
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html><title>app</title>");
  fs.writeFileSync(path.join(docsDir, "CREATOR_GUIDE.md"), "# Guide\n\nHello");
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
});
