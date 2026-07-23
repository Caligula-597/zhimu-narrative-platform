import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  storyAssistantModalHtml,
  worldLogModalHtml
} from "../src/views/writer-modal-templates.js";

test("writer modal templates preserve required interaction hooks", () => {
  assert.match(worldLogModalHtml(), /data-log-refresh/);
  assert.match(storyAssistantModalHtml(), /data-assistant-analyze/);
});

test("migrated Writer tools have no dormant modal templates", async () => {
  const source = await fs.readFile(new URL("../src/views/writer-modal-templates.js", import.meta.url), "utf8");
  for (const marker of [
    "data-preview-body",
    "data-impact-body",
    "data-delivery-run",
    "data-document-parse",
    "data-story-manuscript",
    "data-import-submit"
  ]) {
    assert.doesNotMatch(source, new RegExp(marker));
  }
});

test("Writer view has no direct HTML sinks", async () => {
  const source = await fs.readFile(new URL("../src/views/writer.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML/);
});
