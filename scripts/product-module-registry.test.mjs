import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_PRODUCT_MODULES,
  PRODUCT_VIEW_MODULES,
  productModule,
  productModuleForWorld,
  productModuleFromShellMode
} from "../src/products/product-registry.js";

test("three active products are registered as parallel modules", () => {
  assert.deepEqual(
    ACTIVE_PRODUCT_MODULES.map((product) => product.domain.key),
    ["murder_mystery", "tabletop_rpg", "board_game"]
  );
  for (const product of ACTIVE_PRODUCT_MODULES) {
    assert.equal(typeof product.shell.summarizeWorld, "function");
    assert.equal(typeof product.library.hint, "function");
    assert.equal(typeof product.runtime.activate, "function");
    assert.equal(productModuleFromShellMode(product.domain.shellMode), product);
  }
});

test("product view ownership is disjoint", () => {
  const ownedViews = ACTIVE_PRODUCT_MODULES.flatMap((product) => Object.keys(product.viewModules));
  assert.equal(new Set(ownedViews).size, ownedViews.length);
  assert.deepEqual(Object.keys(PRODUCT_VIEW_MODULES).sort(), [...ownedViews].sort());
  assert.ok(Object.hasOwn(productModule("murder_mystery").viewModules, "writer"));
  assert.deepEqual(Object.keys(productModule("tabletop_rpg").viewModules), ["tabletopMap"]);
  assert.deepEqual(Object.keys(productModule("board_game").viewModules), ["boardGame"]);
});

test("lightweight world rows resolve directly to their owning module", () => {
  assert.equal(productModuleForWorld({ creation_type: "tabletop_rpg" }).domain.key, "tabletop_rpg");
  assert.equal(productModuleForWorld({ creation_type: "board_game" }).library.catalogAvailable, false);
  assert.equal(productModuleForWorld({ creation_type: "murder_mystery" }).library.loadRoomCounts, true);
});

test("each runtime action stays inside its product module", () => {
  const navigated = [];
  productModule("tabletop_rpg").runtime.activate({ go: (view) => navigated.push(view) });
  assert.deepEqual(navigated, ["tabletopMap"]);

  const actions = [];
  productModule("board_game").runtime.activate({
    R: { handle: (action) => actions.push(action) },
    go: () => {},
    uiStore: { get: () => ({ view: "boardGame" }), set: () => {} }
  });
  assert.deepEqual(actions, ["board-tab-select"]);
});
