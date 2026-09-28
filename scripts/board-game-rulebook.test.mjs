import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_GAME_PRESET_CATALOG, createBoardGamePreset } from "../shared/board-game-variant-presets.js";
import { BOARD_GAME_MECHANISM_CATALOG } from "../shared/ruins-auction-preset.js";
import { BOARD_GAME_COUNCIL_CATALOG } from "../shared/mist-council-preset.js";
import { BOARD_GAME_WORKSHOP_CATALOG } from "../shared/season-workshop-preset.js";
import { BOARD_GAME_ARCHIVE_CATALOG } from "../shared/echo-archive-preset.js";
import { BOARD_GAME_REFERENCE_CATALOG } from "../shared/reference-board-game-presets.js";

const REQUIRED_RULEBOOK_FIELDS = Object.freeze([
  "objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"
]);

test("每个已登记桌游都提供完整说明书", () => {
  const catalogs = [
    ...BOARD_GAME_PRESET_CATALOG.map((preset) => ({ ...preset, create: () => createBoardGamePreset(preset.id) })),
    ...BOARD_GAME_MECHANISM_CATALOG,
    ...BOARD_GAME_COUNCIL_CATALOG,
    ...BOARD_GAME_WORKSHOP_CATALOG,
    ...BOARD_GAME_ARCHIVE_CATALOG
    , ...BOARD_GAME_REFERENCE_CATALOG
  ];
  for (const preset of catalogs) {
    const design = preset.create();
    for (const field of REQUIRED_RULEBOOK_FIELDS) {
      assert.equal(typeof design.rulebook?.[field], "string", `${preset.id}: 缺少说明书字段 ${field}`);
      assert.ok(design.rulebook[field].trim().length >= 12, `${preset.id}: 说明书字段 ${field} 过短`);
    }
  }
});
