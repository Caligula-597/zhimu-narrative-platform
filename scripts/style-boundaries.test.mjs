import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("Host depends on shared UI primitives, not Creator global CSS", async () => {
  const [hostStyles, creatorStyles] = await Promise.all([
    read("host/src/styles.css"),
    read("styles.css")
  ]);

  assert.match(hostStyles, /shared\/styles\/app-primitives\.css/);
  assert.doesNotMatch(hostStyles, /\.\.\/\.\.\/styles\.css/);
  assert.match(creatorStyles, /shared\/styles\/app-primitives\.css/);
});

test("shared UI primitives stay free of portal feature selectors", async () => {
  const primitives = await read("shared/styles/app-primitives.css");
  assert.doesNotMatch(primitives, /\.(?:host-|diagnostic-|constitution-|playtest-)/);
});

test("lazy Creator views own their feature CSS", async () => {
  const creatorStyles = await read("styles.css");
  const views = [
    ["story-diagnostics", ".diagnostic-page"],
    ["creative-constitution", ".constitution-page"],
    ["ai-playtest-lab", ".ai-playtest-page"]
  ];

  for (const [name, rootSelector] of views) {
    const [moduleSource, featureStyles] = await Promise.all([
      read(`src/views/${name}.js`),
      read(`src/views/${name}.css`)
    ]);
    assert.match(moduleSource, new RegExp(`import ["']\\./${name}\\.css["']`));
    for (const [otherName] of views) {
      if (otherName !== name) {
        assert.ok(!moduleSource.includes(`./${otherName}.js`), `${name}.js must not eagerly import ${otherName}.js`);
      }
    }
    assert.ok(featureStyles.includes(rootSelector), `${name}.css must own ${rootSelector}`);
    assert.ok(!creatorStyles.includes(rootSelector), `${rootSelector} must not return to styles.css`);
  }
});

test("playtest loading animation is self-contained", async () => {
  const styles = await read("src/views/ai-playtest-lab.css");
  assert.match(styles, /animation:\s*playtest-spin/);
  assert.match(styles, /@keyframes playtest-spin/);
});
