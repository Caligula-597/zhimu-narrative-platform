import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "site", "public", "assets");
const indexHtml = readFileSync(path.join(root, "site", "index.html"), "utf8");

const REQUIRED = [
  "zhimu-screenshot-creator.png",
  "zhimu-screenshot-host.png",
  "zhimu-screenshot-play.png",
  "zhimu-screenshot-archive.png",
  "zhimu-product-hero.png"
];

for (const name of REQUIRED) {
  test(`site asset exists: ${name}`, () => {
    assert.ok(existsSync(path.join(assets, name)), `missing ${name} — run npm run capture:site-screenshots`);
  });
}

test("showcase section uses per-end PNGs not placeholder SVG", () => {
  assert.match(indexHtml, /zhimu-screenshot-creator\.png/);
  assert.match(indexHtml, /zhimu-screenshot-host\.png/);
  assert.match(indexHtml, /zhimu-screenshot-play\.png/);
  assert.match(indexHtml, /zhimu-screenshot-archive\.png/);
  assert.doesNotMatch(indexHtml, /site-preview\.svg/);
});
