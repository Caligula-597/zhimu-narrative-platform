import assert from "node:assert/strict";
import test from "node:test";
import cheese from "../../fixtures/cases/cheese-6p/package.mjs";
import qinglou from "../../fixtures/cases/qinglou-561/package.mjs";
import { assertMechanismPackage } from "../../shared/mechanism-package.js";
import { normalizeMiniGameTemplate } from "../../shared/mini-game-protocol.js";
import { normalizeMaterialBookletBody } from "../src/creator-bible-contract.js";

const PACKAGE_FORMAT = "zhimu-world-package";
const PACKAGE_VERSION = 1;

function assertCasePackage(pkg, label) {
  assert.equal(pkg.format, PACKAGE_FORMAT, `${label} format`);
  assert.equal(Number(pkg.version), PACKAGE_VERSION, `${label} version`);
  const data = pkg.data;
  assert.ok(data.world?.name, `${label} world.name`);
  assert.equal(data.roles.length, 6, `${label} roles`);
  assert.ok(data.chapters.length >= 3, `${label} chapters`);
  assert.ok(data.sections.length >= 18, `${label} sections`);
  assert.ok(data.clues.length >= 6, `${label} clues`);
  assert.ok(data.materialBooklets.length >= 3, `${label} booklets`);
  assert.equal(data.roleArchives.length, 6, `${label} archives`);
  assert.ok(data.miniGameTemplates.length >= 2, `${label} mini-games`);
  assertMechanismPackage(data.mechanismPackage);
  for (const booklet of data.materialBooklets) {
    const normalized = normalizeMaterialBookletBody(booklet);
    assert.ok(normalized.title, `${label} booklet title`);
    assert.ok(normalized.pages.length >= 1, `${label} booklet pages`);
  }
  for (const template of data.miniGameTemplates) {
    const normalized = normalizeMiniGameTemplate(template);
    assert.ok(normalized.pluginKey, `${label} mini-game plugin`);
    assert.ok(normalized.answer, `${label} mini-game answer`);
  }
}

test("cheese-6p case package is import-shaped", () => {
  assertCasePackage(cheese, "cheese-6p");
  assert.match(String(cheese.meta?.caseKey || "cheese-6p"), /cheese/);
});

test("qinglou-561 case package is import-shaped", () => {
  assertCasePackage(qinglou, "qinglou-561");
  assert.match(String(qinglou.meta?.caseKey || "qinglou-561"), /qinglou|561/);
});
