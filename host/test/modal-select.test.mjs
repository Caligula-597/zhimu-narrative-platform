import assert from "node:assert/strict";
import test from "node:test";
import { studioSelect } from "../src/components/modal.js";

test("studioSelect preserves the selected option when editing", () => {
  const html = studioSelect(
    "触发模式",
    "ruleMode",
    [
      { id: "automatic", name: "自动执行" },
      { id: "manual", name: "仅手动触发" }
    ],
    "manual"
  );

  assert.match(html, /value="manual" selected/);
  assert.doesNotMatch(html, /value="automatic" selected/);
});
