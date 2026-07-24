import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  STORY_ASSISTANT_MAX_NODES,
  normalizeStoryAssistantResult,
  storyAnalysisIsCurrent,
  storyAssistantCounts,
  storySourceFingerprint,
  validateStoryAssistantSource
} from "../src/views/writer-story-assistant-model.js";
import { storyAssistantWorkspaceHtml } from "../src/views/writer-story-assistant-view.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("story source validation and fingerprint bind previews to exact trimmed text", () => {
  assert.deepEqual(validateStoryAssistantSource(" \n "), {
    source: "",
    errors: ["请先输入或粘贴剧情文本"]
  });
  const source = "场景：旧灯塔";
  const fingerprint = storySourceFingerprint(source);
  assert.equal(fingerprint, storySourceFingerprint(source));
  assert.notEqual(fingerprint, storySourceFingerprint(`${source}。`));
  assert.equal(storyAnalysisIsCurrent({
    analysis: { nodes: [] },
    analysisFingerprint: fingerprint,
    draft: { text: ` ${source} ` }
  }), true);
});

test("story assistant result normalization is bounded, unique and reference-safe", () => {
  const nodes = Array.from({ length: STORY_ASSISTANT_MAX_NODES + 20 }, (_, index) => ({
    key: index < 2 ? "duplicate" : `node-${index}`,
    type: index % 3 === 0 ? "clue" : index % 3 === 1 ? "investigation_point" : 'bad" onclick="x',
    name: index === 0 ? "<script>alert(1)</script>" : `节点 ${index}`,
    text: `正文 ${index}`
  }));
  const result = normalizeStoryAssistantResult({
    nodes,
    edges: [
      { fromKey: "duplicate", toKey: "node-2", label: "<img src=x>" },
      { fromKey: "missing", toKey: "node-2" },
      { fromKey: "node-2", toKey: "node-2" }
    ],
    suggestions: ["<script>建议</script>"]
  });
  assert.equal(result.nodes.length, STORY_ASSISTANT_MAX_NODES);
  assert.equal(new Set(result.nodes.map((node) => node.key)).size, STORY_ASSISTANT_MAX_NODES);
  assert.equal(result.nodes[2].type, "scene");
  assert.deepEqual(result.edges.map(({ fromKey, toKey }) => ({ fromKey, toKey })), [
    { fromKey: "duplicate", toKey: "node-2" }
  ]);
  assert.equal(storyAssistantCounts(result).total, STORY_ASSISTANT_MAX_NODES);
});

test("story structure workspace escapes remote content and exposes only routed actions", () => {
  const source = "场景：旧灯塔";
  const session = {
    type: "story-assistant",
    draft: { text: source },
    analysisFingerprint: storySourceFingerprint(source),
    analysis: normalizeStoryAssistantResult({
      nodes: [{ key: "scene-1", type: "scene", name: "<script>alert(1)</script>", text: "<img src=x>" }],
      edges: [],
      suggestions: ["<b>建议</b>"]
    }),
    savingAction: "",
    error: "",
    importArmed: false
  };
  const html = storyAssistantWorkspaceHtml(
    { world: { name: "<svg onload=x>" } },
    session
  );
  assert.match(html, /data-writer-tool="story-assistant"/);
  assert.match(html, /data-action="writer-story-analyze"/);
  assert.match(html, /data-action="writer-story-import"/);
  assert.match(html, /不会创建章节、角色、私人分幕或自动化规则/);
  assert.doesNotMatch(html, /<script>|<img|<svg|class="modal|modal-backdrop/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("story assistant API and backend keep world, size and append-only boundaries explicit", () => {
  const api = read("src/api/ai.js");
  const controller = read("src/views/writer-story-assistant-workspace.js");
  const routes = read("backend/src/routes/story-assistant-routes.js");
  const schemas = read("backend/src/routes/schemas/ai.js");
  const classifier = read("backend/src/routes/world-story-service.js");
  const service = read("backend/src/story-manuscript-service.js");
  assert.match(api, /worldWrite\(`\/worlds\/\$\{worldId\}\/story-assistant\/import`/);
  assert.match(api, /worldId,\s*method: "POST"/);
  assert.match(controller, /worldId: session\.worldId/);
  assert.match(controller, /idempotencyKey: session\.requestId/);
  assert.match(controller, /session\.requestId = ""/);
  assert.match(controller, /session\.requestId = zhimuApi\.createIdempotencyKey\(\)/);
  assert.match(controller, /if \(!session\.importArmed\)/);
  assert.match(routes, /storyAssistantAnalyzeSchema/);
  assert.match(routes, /storyAssistantImportSchema/);
  assert.equal((schemas.match(/maxLength:\s*500_000/g) || []).length >= 2, true);
  assert.match(classifier, /blocks\.slice\(0, 80\)/);
  assert.match(service, /INSERT INTO scenes/);
  assert.match(service, /INSERT INTO clues/);
  assert.match(service, /INSERT INTO investigation_points/);
  assert.match(service, /INSERT INTO story_graph_edges/);
  assert.match(service, /source: "story_assistant"/);
});
