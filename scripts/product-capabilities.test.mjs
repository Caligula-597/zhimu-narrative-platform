import assert from "node:assert/strict";
import test from "node:test";
import {
  productAllowsShellView,
  productHomeView,
  productSupportsView,
  productToolCapabilities
} from "../shared/product-capabilities.js";

test("three product lines expose isolated detailed tools", () => {
  assert.equal(productSupportsView("murder_mystery", "clues"), true);
  assert.equal(productSupportsView("murder_mystery", "tabletopMap"), false);
  assert.equal(productSupportsView("tabletop_rpg", "tabletopMap"), true);
  assert.equal(productSupportsView("tabletop_rpg", "writer"), false);
  assert.equal(productSupportsView("tabletop_rpg", "studio"), false);
  assert.equal(productSupportsView("tabletop_rpg", "rules"), false);
  assert.equal(productSupportsView("tabletop_rpg", "archive"), false);
  assert.equal(productSupportsView("tabletop_rpg", "boardGame"), false);
  assert.equal(productSupportsView("board_game", "boardGame"), true);
  assert.equal(productSupportsView("board_game", "tabletopMap"), false);
  assert.deepEqual(productToolCapabilities("board_game").dedicated, ["boardGame"]);
  assert.deepEqual(productToolCapabilities("board_game").shared, []);
  assert.equal(productSupportsView("board_game", "writer"), false);
  assert.equal(productSupportsView("board_game", "rules"), false);
  assert.equal(productSupportsView("board_game", "archive"), false);
});

test("board-game projects use an isolated shell and home view", () => {
  assert.equal(productHomeView("board_game"), "boardGame");
  assert.equal(productAllowsShellView("board_game", "boardGame"), true);
  assert.equal(productAllowsShellView("board_game", "creatorCockpit"), false);
  assert.equal(productAllowsShellView("board_game", "writer"), false);
  assert.equal(productAllowsShellView("board_game", "settings"), false);
  assert.equal(productAllowsShellView("board_game", "account"), true);
  assert.equal(productHomeView("murder_mystery"), "creatorCockpit");
  assert.equal(productAllowsShellView("murder_mystery", "boardGame"), false);
});

test("tabletop projects never fall back to murder-mystery authoring", () => {
  assert.equal(productHomeView("tabletop_rpg"), "tabletopMap");
  assert.equal(productAllowsShellView("tabletop_rpg", "tabletopMap"), true);
  assert.equal(productAllowsShellView("tabletop_rpg", "creatorCockpit"), false);
  assert.equal(productAllowsShellView("tabletop_rpg", "writer"), false);
  assert.equal(productAllowsShellView("tabletop_rpg", "rooms"), false);
  assert.equal(productAllowsShellView("tabletop_rpg", "settings"), false);
});
