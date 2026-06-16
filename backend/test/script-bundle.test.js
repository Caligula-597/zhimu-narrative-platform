import test from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import {
  classifyBundleEntry,
  matchRoleSlotByName,
  parseBundleTitleHints,
  summarizeBundleInventory
} from "../src/script-bundle-classify.js";
import { analyzeScriptBundleBuffer, extractScriptBundleZip, safeBundleEntryPath } from "../src/script-bundle-zip.js";
import { throwErr } from "../src/api-errors.js";

function buildSampleZip() {
  const zip = new AdmZip();
  zip.addFile(
    "172-水上之谜 (7人开放)/人物剧本/卞夫人.pdf",
    Buffer.from("%PDF-1.4 sample", "utf8")
  );
  zip.addFile(
    "172-水上之谜 (7人开放)/调查线索/长秋宫1.jpg",
    Buffer.from("fake-jpeg-bytes", "utf8")
  );
  zip.addFile(
    "172-水上之谜 (7人开放)/组织者手册.docx",
    Buffer.from("docx-placeholder", "utf8")
  );
  zip.addFile(
    "172-水上之谜 (7人开放)/公共.pdf",
    Buffer.from("%PDF public", "utf8")
  );
  return zip.toBuffer();
}

test("parseBundleTitleHints extracts world name and player count", () => {
  const hints = parseBundleTitleHints("172-水上之谜 (7人开放)");
  assert.equal(hints.worldName, "水上之谜");
  assert.equal(hints.playerCount, 7);
});

test("classifyBundleEntry recognizes role, clue and host files", () => {
  assert.equal(classifyBundleEntry("水上之谜/人物剧本/卞夫人.pdf").category, "role_script");
  assert.equal(classifyBundleEntry("水上之谜/调查线索/长秋宫1.jpg").category, "clue");
  assert.equal(classifyBundleEntry("水上之谜/组织者手册.docx").category, "host_manual");
  assert.equal(classifyBundleEntry("水上之谜/公共.pdf").category, "public_script");
});

test("matchRoleSlotByName matches fuzzy role labels", () => {
  const roles = [{ id: "r1", name: "卞夫人" }];
  assert.equal(matchRoleSlotByName(roles, "卞夫人.pdf")?.id, "r1");
});

test("extractScriptBundleZip reads supported files and root folder", () => {
  const extracted = extractScriptBundleZip(buildSampleZip());
  assert.equal(extracted.rootFolder, "172-水上之谜 (7人开放)");
  assert.equal(extracted.files.length, 4);
  assert.ok(extracted.files.every((file) => file.buffer.length > 0));
});

test("analyzeScriptBundleBuffer returns inventory summary", () => {
  const analysis = analyzeScriptBundleBuffer(buildSampleZip());
  assert.equal(analysis.suggestedWorldName, "水上之谜");
  assert.equal(analysis.suggestedPlayerCount, 7);
  assert.ok(analysis.inventory.length >= 4);
  assert.ok(analysis.summary.role_script >= 1);
  assert.ok(analysis.summary.clue >= 1);
});

test("safeBundleEntryPath rejects traversal segments", () => {
  assert.throws(
    () => safeBundleEntryPath("bundle/../../escape.txt"),
    (error) => error.code === "SCRIPT_BUNDLE_ENTRY_INVALID"
  );
});

test("summarizeBundleInventory aggregates categories", () => {
  const items = [
    classifyBundleEntry("a/人物剧本/甲.pdf"),
    classifyBundleEntry("a/调查线索/卡1.jpg")
  ];
  const summary = summarizeBundleInventory(items);
  assert.equal(summary.counts.role_script, 1);
  assert.equal(summary.counts.clue, 1);
  assert.deepEqual(summary.roleNames, ["甲"]);
});

test("throwErr exposes script bundle codes", () => {
  assert.throws(() => throwErr("SCRIPT_BUNDLE_EMPTY"), (error) => error.code === "SCRIPT_BUNDLE_EMPTY");
});
