import assert from "node:assert/strict";
import test from "node:test";
import {
  assemblyIssuesArePatchable,
  blueprintIssuesArePatchable
} from "../src/deepseek-outline-repair/issue-policy.js";
import { applyJsonPointerPatches } from "../src/deepseek-outline-repair/json-pointer-patch.js";

test("outline repair policy only spends patch rounds on classified issues", () => {
  assert.equal(blueprintIssuesArePatchable(["蓝图实体 objectKey 缺失"]), true);
  assert.equal(blueprintIssuesArePatchable(["蓝图结构整体无法识别"]), false);
  assert.equal(assemblyIssuesArePatchable([
    "chapterBeats[0].decision.options[0].choiceText 缺失"
  ]), true);
  assert.equal(assemblyIssuesArePatchable([
    "players[0].chapterActions[0].action 缺失或过短"
  ]), true);
  assert.equal(assemblyIssuesArePatchable([
    "章节装配不得输出蓝图字段或额外字段：truthTimeline"
  ]), false);
  assert.equal(assemblyIssuesArePatchable([
    "chapterBeats[0].decision 缺失",
    "章节装配不得输出蓝图字段或额外字段：truthTimeline"
  ]), false);
  assert.equal(assemblyIssuesArePatchable([]), false);
  assert.equal(assemblyIssuesArePatchable(Array(25).fill("chapterBeats[0] 缺失")), false);
});

test("outline JSON Pointer patches clone input and implement add replace remove", () => {
  const source = {
    items: [{ name: "first" }, { name: "second" }],
    "a/b": { "~key": 1 }
  };
  const result = applyJsonPointerPatches(source, [
    { op: "replace", path: "/items/0/name", value: "updated" },
    { op: "remove", path: "/items/1" },
    { op: "add", path: "/items/-", value: { name: "appended" } },
    { op: "replace", path: "/a~1b/~0key", value: 2 }
  ]);
  assert.deepEqual(result, {
    items: [{ name: "updated" }, { name: "appended" }],
    "a/b": { "~key": 2 }
  });
  assert.deepEqual(source, {
    items: [{ name: "first" }, { name: "second" }],
    "a/b": { "~key": 1 }
  });
});

test("outline JSON Pointer patches reject ambiguous array indexes", () => {
  const source = { items: [{ name: "first" }, { name: "second" }] };
  for (const path of [
    "/items/01/name",
    "/items/1e0/name",
    "/items/+1/name",
    "/items/ 1/name",
    "/items//name"
  ]) {
    assert.throws(
      () => applyJsonPointerPatches(source, [{ op: "replace", path, value: "unsafe" }]),
      /Invalid outline patch array index/u
    );
  }
});

test("outline JSON Pointer patches reject unsafe paths and partial oversized batches", () => {
  assert.throws(
    () => applyJsonPointerPatches({}, [{ op: "add", path: "/__proto__/polluted", value: true }]),
    /Unsafe outline patch path/u
  );
  assert.equal({}.polluted, undefined);
  assert.throws(
    () => applyJsonPointerPatches({ value: 1 }, [{ op: "replace", path: "/bad~2path", value: 2 }]),
    /Invalid outline patch pointer escape/u
  );
  assert.throws(
    () => applyJsonPointerPatches({}, Array.from({ length: 31 }, (_, index) => ({
      op: "add",
      path: `/field-${index}`,
      value: index
    }))),
    /exceeded 30 operations/u
  );
});
