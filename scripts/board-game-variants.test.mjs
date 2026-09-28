import assert from "node:assert/strict";
import test from "node:test";
import { compileBoardGameEngine } from "../shared/board-game-engine.js";
import { BOARD_GAME_PRESET_CATALOG, createBoardGamePreset } from "../shared/board-game-variant-presets.js";

test("horizontal board-game presets all compile as runnable variants", () => {
  const rulebookFields = ["objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"];
  for (const preset of BOARD_GAME_PRESET_CATALOG) {
    const design = createBoardGamePreset(preset.id);
    const report = compileBoardGameEngine(design, 4);
    assert.equal(report.blocking, false, `${preset.id}: ${report.issues.map((issue) => issue.message).join(";")}`);
    assert.equal(design.engine.actions.find((action) => action.id === "action-secure-route").target, "unowned_region");
    assert.ok(rulebookFields.every((field) => design.rulebook[field].trim()), `${preset.id}: 说明书字段不完整`);
  }
});

