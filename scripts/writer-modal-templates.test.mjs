import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { htmlFragment } from "../shared/safe-dom.js";
import {
  creatorPreviewModalHtml,
  documentParserModalHtml,
  publishImpactModalHtml,
  deliveryExportModalHtml,
  plainTextImportPreviewHtml,
  storyAssistantModalHtml,
  worldLogModalHtml
} from "../src/views/writer-modal-templates.js";

test("writer modal templates preserve required interaction hooks", () => {
  assert.match(worldLogModalHtml(), /data-log-refresh/);
  assert.match(storyAssistantModalHtml(), /data-assistant-analyze/);
  assert.match(creatorPreviewModalHtml(htmlFragment("<select data-safe-control></select>")), /data-preview-body/);
  assert.match(publishImpactModalHtml(htmlFragment("<select data-safe-control></select>")), /data-impact-body/);
  assert.match(deliveryExportModalHtml(), /data-delivery-run/);
  assert.match(plainTextImportPreviewHtml(), /Markdown \/ TXT/);
});

test("writer template fragment slots reject unreviewed raw strings", () => {
  assert.throws(() => creatorPreviewModalHtml("<select></select>"), /htmlFragment/);
  assert.throws(() => documentParserModalHtml("<option>role</option>"), /htmlFragment/);
});

test("Writer view has no direct HTML sinks", async () => {
  const source = await fs.readFile(new URL("../src/views/writer.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML/);
});
