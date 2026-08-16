import assert from "node:assert/strict";
import test from "node:test";
import { productSupportsView, productToolCapabilities } from "../shared/product-capabilities.js";

test("three product lines expose isolated detailed tools", () => {
  assert.equal(productSupportsView("murder_mystery", "clues"), true);
  assert.equal(productSupportsView("murder_mystery", "tabletopMap"), false);
  assert.equal(productSupportsView("tabletop_rpg", "tabletopMap"), true);
  assert.equal(productSupportsView("tabletop_rpg", "boardGame"), false);
  assert.equal(productSupportsView("board_game", "boardGame"), true);
  assert.equal(productSupportsView("board_game", "tabletopMap"), false);
  assert.deepEqual(productToolCapabilities("board_game").shared, ["rules", "archive"]);
});
