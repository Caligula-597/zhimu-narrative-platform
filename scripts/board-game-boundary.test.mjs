import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const loaderSource = fs.readFileSync(new URL("../src/products/board-game/view-manifest.js", import.meta.url), "utf8");
const boardViewSource = fs.readFileSync(new URL("../src/views/board-game.js", import.meta.url), "utf8");

test("board-game editor remains a lazy-loaded product module", () => {
  assert.doesNotMatch(appSource, /views\/board-game(?:-playground)?\.js/u);
  assert.match(loaderSource, /import\("\.\/shell\.css"\)/u);
  assert.match(loaderSource, /import\("\.\.\/\.\.\/views\/board-game\.js"\)/u);
  assert.match(loaderSource, /import\("\.\.\/\.\.\/runtime\/actions-board-game\.js"\)/u);
});

test("board-game view does not import narrative authoring modules", () => {
  assert.doesNotMatch(boardViewSource, /views\/(?:writer|clues|studio|creator-cockpit)|actions-(?:writer|clues|studio|creator-cockpit)|narrative-profile/u);
  assert.match(boardViewSource, /shared\/board-game-design\.js/u);
  assert.match(boardViewSource, /\.\/board-game-playground\.js/u);
});

test("board-game editor binds a fixed number of delegated field listeners", () => {
  assert.match(boardViewSource, /root\.addEventListener\("input", handleBoardGameEditorInput\)/u);
  assert.match(boardViewSource, /root\.addEventListener\("change", handleBoardGameEditorChange\)/u);
  assert.doesNotMatch(boardViewSource, /querySelectorAll\("\[data-board-(?:design|component|state|asset|entry|variable|mechanism|condition|effect|simulation|rulebook)-field\]"\)/u);
});
