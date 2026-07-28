import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = (name) => new URL(`../src/routes/${name}`, import.meta.url);

test("mother manuscript uses creator-reader authorization instead of public world-reader access", async () => {
  const source = await readFile(routeUrl("story-manuscript-routes.js"), "utf8");
  const handler = source.match(
    /app\.get\("\/api\/worlds\/:worldId\/story-manuscript"[\s\S]*?\n  \}\);/
  )?.[0];

  assert.ok(handler, "story manuscript GET handler must remain discoverable");
  assert.match(handler, /requireWorldRole\(actorId, worldId, WORLD_CREATOR_READER_ROLES\)/);
  assert.doesNotMatch(handler, /requireWorldReader/);
});

test("rule listing excludes public catalog viewers", async () => {
  const source = await readFile(routeUrl("rules-routes.js"), "utf8");
  const handler = source.match(/app\.get\("\/api\/worlds\/:worldId\/rules"[\s\S]*?\n  \}\);/)?.[0];

  assert.ok(handler, "rule-list GET handler must remain discoverable");
  assert.match(handler, /\["owner", "editor", "reviewer", "host"\]/);
  assert.doesNotMatch(handler, /"viewer"|requireWorldReader/);
});

test("world asset listing excludes public catalog viewers", async () => {
  const source = await readFile(routeUrl("asset-routes.js"), "utf8");
  const handler = source.match(/app\.get\("\/api\/worlds\/:worldId\/assets"[\s\S]*?\n  \}\);/)?.[0];

  assert.ok(handler, "asset-list GET handler must remain discoverable");
  assert.match(handler, /\["owner", "editor", "reviewer", "host"\]/);
  assert.doesNotMatch(handler, /"viewer"|requireWorldReader/);
});

test("reviewers may inspect private asset downloads without granting that access to viewers", async () => {
  const source = await readFile(new URL("../src/routes/world-access-service.js", import.meta.url), "utf8");

  assert.match(source, /wm\.role IN \('owner', 'editor', 'reviewer', 'host'\)/);
  assert.doesNotMatch(source, /wm\.role IN \([^\n]*'viewer'/);
});

test("world-level remedy scripts require an internal creator role", async () => {
  const source = await readFile(routeUrl("batch-b-routes.js"), "utf8");
  const handler = source.match(
    /app\.get\("\/api\/worlds\/:worldId\/segment-remedies"[\s\S]*?\n  \}\);/
  )?.[0];

  assert.ok(handler, "segment-remedies GET handler must remain discoverable");
  assert.match(handler, /\["owner", "editor", "reviewer"\]/);
  assert.doesNotMatch(handler, /"viewer"|"host"|requireWorldReader/);
});

test("creator search and graph references require an internal creator role", async () => {
  for (const filename of ["search-routes.js", "studio-graph-routes.js"]) {
    const source = await readFile(routeUrl(filename), "utf8");
    assert.match(source, /WORLD_CREATOR_READER_ROLES/, filename);
    assert.doesNotMatch(source, /requireWorldReader/, filename);
  }
});

test("creator readiness and runtime analytics exclude public catalog viewers", async () => {
  const source = await readFile(routeUrl("world-readiness-routes.js"), "utf8");

  assert.match(source, /WORLD_CREATOR_READER_ROLES/);
  assert.doesNotMatch(source, /requireWorldReader|"viewer"|"host"/);
});

test("creator snapshots never export live room invitation credentials", async () => {
  const source = await readFile(new URL("../src/world-snapshot-service.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /invite_code/);
  assert.match(source, /'id', r\.id, 'name', r\.name, 'status', r\.status/);
});

test("studio snapshots separate public, operational and draft visibility", async () => {
  const source = await readFile(new URL("../src/studio-snapshot-service.js", import.meta.url), "utf8");

  assert.match(source, /wm\.role IN \('owner', 'editor', 'reviewer'\) AS can_read_draft_content/);
  assert.match(source, /wm\.role IN \('owner', 'editor', 'reviewer', 'host'\) AS can_read_operational_content/);
  assert.match(source, /AND \(SELECT can_read_operational_content FROM world_row\)/);
  assert.match(source, /AND \(SELECT can_read_draft_content FROM world_row\)[\s\S]*?ORDER BY created_at DESC/);
  assert.match(source, /THEN r\.invite_code ELSE NULL END AS invite_code/);
});
