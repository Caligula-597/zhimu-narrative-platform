import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  writerToolContextPanelHtml,
  writerToolFactsHtml,
  writerToolGridPageHtml,
  writerToolGuidanceHtml,
  writerToolSurfaceHtml
} from "../src/views/writer-tool-layout.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("writer tool layout escapes typed context content and preserves safe hooks", () => {
  const facts = writerToolFactsHtml([
    { label: "<img src=x>", value: "<script>alert(1)</script>", hook: "safe-count" },
    { label: "数量", value: 0 }
  ]);
  const guidance = writerToolGuidanceHtml({
    title: "<svg onload=x>",
    text: "<b>不要执行</b>",
    className: 'safe " onclick="bad'
  });
  const context = writerToolContextPanelHtml({
    kicker: "<K>",
    title: "<TITLE>",
    intro: "<INTRO>",
    facts: [{ label: "状态", value: "<危险>" }],
    bodyHtml: guidance,
    className: 'context " onmouseover="bad'
  });
  assert.match(facts, /data-safe-count/);
  assert.match(facts, />0<\/dd>/);
  assert.doesNotMatch(`${facts}${guidance}${context}`, /<script>|<img|<svg|onclick=|onmouseover=/);
  assert.match(context, /&lt;TITLE&gt;/);
  assert.match(guidance, /&lt;b&gt;不要执行&lt;\/b&gt;/);
});

test("writer tool page centralizes surface, back action and responsive grid contracts", () => {
  const html = writerToolGridPageHtml({
    type: "story-assistant",
    className: "writer-story-workspace",
    wide: true,
    contextHtml: "<aside>context</aside>",
    contentHtml: "<main>content</main>"
  });
  assert.match(html, /data-writer-tool-workspace/);
  assert.match(html, /data-writer-tool="story-assistant"/);
  assert.match(html, /data-action="writer-tool-close"/);
  assert.match(html, /writer-tool-grid-wide/);
  assert.match(html, /writer-story-workspace/);
  assert.throws(() => writerToolSurfaceHtml({ type: 'bad" onclick="x' }), /Invalid writer tool type/);
  assert.throws(() => writerToolGridPageHtml({ type: "safe", backAction: "bad action" }), /Invalid writer tool back action/);
});

test("all Writer full-page tools consume the shared layout instead of rebuilding the shell", () => {
  const files = [
    "src/views/writer-manuscript-workspace.js",
    "src/views/writer-document-workspace.js",
    "src/views/writer-impact-workspace.js",
    "src/views/writer-package-workspace.js",
    "src/views/writer-snapshot-workspace.js",
    "src/views/writer-story-assistant-view.js",
    "src/views/writer-review-view.js",
    "src/views/writer-collaboration-view.js",
    "src/views/writer-world-logs-view.js"
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /from "\.\/writer-tool-layout\.js"/, file);
    assert.doesNotMatch(source, /<section class="writer-tool-workspace/, file);
  }
});

test("uploaded prose that misses the gate requires explicit human review before import", () => {
  const source = read("src/views/writer-document-workspace.js");
  assert.match(source, /gate\?\.decision === "manual_review" && !session\.draft\.proseReviewConfirmed/u);
  assert.match(source, /data-document-check="proseReviewConfirmed"/u);
  assert.match(source, /未确认前不会写入/u);
  assert.match(source, /不代表稿件已达到发布或精品库标准/u);
});
