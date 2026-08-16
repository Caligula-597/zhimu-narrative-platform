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
    "src/views/writer-player-preview-view.js",
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

test("creator production surfaces lazy-load the AI script pipeline launcher", () => {
  const loader = read("src/runtime/view-loader.js");
  const actions = read("src/runtime/actions.js");
  const launcher = read("src/runtime/actions-pipeline.js");
  const panels = read("src/views/creator-cockpit-panels.js");
  const pipelineOpen = read("src/views/pipeline-wizard-open.js");
  const browserFixture = read("scripts/browser-fixture-api.mjs");

  assert.match(loader, /creatorCockpit:[\s\S]*actions-pipeline\.js/u);
  assert.match(loader, /production:[\s\S]*actions-pipeline\.js/u);
  assert.match(actions, /zhimuActionsPipeline\?\.handlePipelineAction/u);
  assert.match(launcher, /action !== "deepseek-pipeline"/u);
  assert.match(launcher, /writer\.openDeepseekPipeline\(\)/u);
  assert.match(pipelineOpen, /\["setup", "truth", "characters", "clues", "matrix", "host", "scripts", "evaluate", "sync"\]/u);
  assert.doesNotMatch(panels, /AI 悬疑创作/u);
  assert.match(browserFixture, /story-manuscript/u);
});

test("pipeline evaluation surfaces local repair routing instead of writing every issue back to setup", () => {
  const html = read("src/views/pipeline-wizard-html.js");
  const open = read("src/views/pipeline-wizard-open.js");
  const session = read("src/views/pipeline-wizard-session.js");
  assert.match(html, /局部返工计划/u);
  assert.match(html, /100 局策略压力测试/u);
  assert.match(html, /关键真相整局还原/u);
  assert.match(html, /精确对象/u);
  assert.match(html, /strategy\.claimBoundary/u);
  assert.match(html, /对抗性桌测/u);
  assert.match(html, /前往最早返工层/u);
  assert.match(open, /applyPipelineRepairPlan/u);
  assert.match(open, /generationProvenance/u);
  assert.match(session, /REPAIR_STAGE_TO_LAYER/u);
  assert.match(session, /staleArtifacts/u);
  assert.doesNotMatch(open, /已追加.*额外的矛盾冲突/u);
});

test("AI script pipeline becomes a single-column, horizontally navigable workspace on narrow screens", () => {
  const styles = read("styles.css");
  assert.match(styles, /@media\(max-width:820px\)[\s\S]*\.pipeline-wizard-title-row \{ flex-direction:column/u);
  assert.match(styles, /\.pipeline-wizard-body \{ grid-template-columns:1fr; grid-template-rows:auto minmax\(0,1fr\)/u);
  assert.match(styles, /\.pipeline-wizard-side \.pipeline-ladder \{ display:grid; grid-auto-flow:column/u);
  assert.match(styles, /\.modal\.pipeline-wizard-modal \{ width:100%; max-width:none; height:calc\(100dvh - 12px\)/u);
});
