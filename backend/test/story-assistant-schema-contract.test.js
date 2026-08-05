import assert from "node:assert/strict";
import test from "node:test";

import {
  deepseekPipelineMatrixHostSchema,
  deepseekPipelineMatrixPlayerScriptSchema,
  deepseekPipelineMatrixTruthSchema
} from "../src/routes/schemas/ai.js";

test("matrix pipeline schema accepts every setting emitted by the creator wizard", () => {
  const setting = deepseekPipelineMatrixTruthSchema.body.properties.setting.properties;
  for (const key of [
    "literaryStyle",
    "mysteryStyle",
    "killerAwareness",
    "matrixMode",
    "eraPreset",
    "eraNotes"
  ]) {
    assert.ok(setting[key], `missing creator setting schema: ${key}`);
  }
});

test("matrix pipeline schema accepts host and script generation controls", () => {
  assert.ok(deepseekPipelineMatrixHostSchema.body.properties.allActs);
  assert.deepEqual(
    deepseekPipelineMatrixPlayerScriptSchema.body.properties.scriptGenerationMode.enum,
    ["structured", "narrative"]
  );
});
