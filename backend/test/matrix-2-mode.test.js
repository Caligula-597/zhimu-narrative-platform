import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveMatrixMode,
  buildMatrixModeProfile,
  isLayerEnabled,
  formatMatrixOutlineInstructions,
  listMatrixModeOptions,
  buildMatrix20OutlineSchema
} from "../src/prompts/matrix-2-mode.js";
import { resolveEraPreset, buildEraSettingCard, listEraPresetOptions } from "../src/prompts/matrix-era-setting.js";
import { validateCreativeSetting } from "../src/prompts/creative-input.js";

test("resolveMatrixMode accepts Chinese labels", () => {
  assert.equal(resolveMatrixMode("本格"), "honkaku");
  assert.equal(resolveMatrixMode("变格"), "henkaku");
  assert.equal(resolveMatrixMode("honkaku"), "honkaku");
});

test("honkaku disables L4 supernatural", () => {
  const p = buildMatrixModeProfile({ matrixMode: "honkaku" });
  assert.equal(isLayerEnabled(p, "L4"), false);
  assert.equal(p.layers.L1.includesSupernatural, false);
  assert.equal(p.layers.L3.allowHallucination, false);
});

test("henkaku enables L4 and hallucination", () => {
  const p = buildMatrixModeProfile({ matrixMode: "henkaku" });
  assert.equal(isLayerEnabled(p, "L4"), true);
  assert.equal(p.layers.L1.includesSupernatural, true);
  assert.equal(p.layers.L3.allowHallucination, true);
});

test("validateCreativeSetting wires matrixMode and era", () => {
  const s = validateCreativeSetting({
    theme: "测试",
    matrixMode: "本格",
    eraPreset: "灯塔",
    literaryStyle: "cinematic"
  });
  assert.equal(s.matrixMode, "honkaku");
  assert.equal(s.eraPreset, "lighthouse-industrial");
  assert.ok(s.matrixModeLabel.includes("本格"));
});

test("era preset lighthouse matches 雾港", () => {
  const card = buildEraSettingCard({ eraPreset: "lighthouse-industrial" });
  assert.ok(card.vocabulary.includes("灯塔"));
  assert.ok(card.taboos.includes("GPS"));
});

test("outline schema differs by mode", () => {
  const hon = buildMatrix20OutlineSchema(buildMatrixModeProfile({ matrixMode: "honkaku" }), "role-1", "ch1");
  const hen = buildMatrix20OutlineSchema(buildMatrixModeProfile({ matrixMode: "henkaku" }), "role-1", "ch1");
  assert.deepEqual(hon.matrix20.mechanicalTriggers, []);
  assert.ok(hen.matrix20.mechanicalTriggers.length >= 1);
  assert.ok(formatMatrixOutlineInstructions(buildMatrixModeProfile({ matrixMode: "henkaku" })).includes("Subjective_Hallucination"));
});

test("list options non-empty", () => {
  assert.ok(listMatrixModeOptions().length >= 2);
  assert.ok(listEraPresetOptions().length >= 6);
});
