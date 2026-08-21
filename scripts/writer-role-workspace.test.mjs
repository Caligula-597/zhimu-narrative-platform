import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  normalizeWriterCollections,
  writerRoleSectionSummary
} from "../src/views/writer-role-model.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("writer role summaries tolerate sparse and legacy section bodies", () => {
  assert.equal(writerRoleSectionSummary({ id: "sparse" }), "");
  assert.equal(writerRoleSectionSummary({ body: null }), "");
  assert.equal(writerRoleSectionSummary({ body: "正文" }), "正文");

  const longBody = "段".repeat(101);
  assert.equal(writerRoleSectionSummary({ body: longBody }), `${"段".repeat(100)}...`);
});

test("writer role summaries preserve image-page descriptions", () => {
  assert.equal(
    writerRoleSectionSummary({ metadata: { contentMode: "pages", pageAssetIds: ["a", "b"] } }),
    "图片分幕 · 2 页"
  );
});

test("writer collections normalize partial studio payloads", () => {
  const roles = [{ id: "role-1" }];
  assert.deepEqual(normalizeWriterCollections({ roles }), {
    roles,
    sections: [],
    chapters: [],
    versions: []
  });
  assert.deepEqual(normalizeWriterCollections(null), {
    roles: [],
    sections: [],
    chapters: [],
    versions: []
  });
});

test("browser QA fixture serves role archives without filling sparse section bodies", () => {
  const fixtureSource = readFileSync(path.join(root, "scripts", "browser-fixture-api.mjs"), "utf8");
  const workspaceStart = fixtureSource.indexOf("const workspacePreview = {");
  const workspaceEnd = fixtureSource.indexOf("\n};\n\nconst dashboard", workspaceStart);
  const workspaceFixture = fixtureSource.slice(workspaceStart, workspaceEnd);

  assert.match(fixtureSource, /path === `\/api\/worlds\/\$\{worldId\}\/bible\/role-archives`/);
  assert.match(fixtureSource, /return sendJson\(response, 200, \{ archives: \[\] \}\)/);
  assert.ok(workspaceStart >= 0 && workspaceEnd > workspaceStart, "workspace fixture should be locatable");
  assert.match(workspaceFixture, /sections:\s*\[[\s\S]*?id: "section-1"[\s\S]*?publication_status: "testing"/);
  assert.doesNotMatch(workspaceFixture, /\bbody:/);
});
