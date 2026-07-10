import assert from "node:assert/strict";
import test from "node:test";
import { resolveClueKind } from "../src/clue-kind.js";

test("resolveClueKind prefers explicit kind", () => {
  assert.equal(resolveClueKind({ clueKind: "misdirect" }), "misdirect");
  assert.equal(resolveClueKind({ metadata: { clueKind: "deep" } }), "deep");
});

test("resolveClueKind maps legacy importance", () => {
  assert.equal(resolveClueKind({ importance: "red_herring" }), "misdirect");
  assert.equal(resolveClueKind({ importance: "prerequisite" }), "verify");
  assert.equal(resolveClueKind({ importance: "finale_key" }), "deep");
});

test("resolveClueKind defaults to general", () => {
  assert.equal(resolveClueKind({}), "general");
  assert.equal(resolveClueKind({ clueKind: "invalid" }), "general");
});

test("resolveClueKind infers from draft text heuristics", () => {
  assert.equal(resolveClueKind({ name: "误导线索", text: "故意嫁祸给管家" }), "misdirect");
  assert.equal(resolveClueKind({ name: "旧照片", text: "记录当晚出入" }), "deep");
  assert.equal(resolveClueKind({ draftType: "investigation_point", name: "搜查书桌" }), "verify");
});
