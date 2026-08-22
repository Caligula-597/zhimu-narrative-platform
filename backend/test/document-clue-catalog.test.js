import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCityRumorClueCards,
  extractCharacterClueCards,
  extractQinglouClueCardCatalog
} from "../src/document-clue-catalog.js";

const CITY = [
  "城闻线索：",
  "1被埋男尸：面目全非。",
  "2府南河下游男尸：黑麻袋。 3迷魂香：杀人之香。",
  "4 九还散：放入酒中。",
  "10莫寒房间：少了两个黑麻袋。",
  "11莫寒房间：匕首满是血迹。",
  "衙门令：",
  "可去三地。"
].join("\n");

const CHAR = [
  "★线索列表★",
  "齐剑心：",
  "1今晚被邀酒。",
  "2身配玉剑。",
  "杜霄元：",
  "1家中有皇书。",
  "开本前准备"
].join("\n");

test("city rumor cards split inline numbers and keep 10+ indexes", () => {
  const cards = extractCityRumorClueCards(CITY);
  assert.equal(cards.length, 6);
  assert.deepEqual(
    cards.map((item) => item.index),
    [1, 2, 3, 4, 10, 11]
  );
  assert.ok(cards.some((item) => item.title.startsWith("莫寒房间")));
  assert.ok(cards.some((item) => item.title === "九还散"));
});

test("character clue cards stop before opening-flow steps", () => {
  const cards = extractCharacterClueCards(CHAR);
  assert.equal(cards.length, 3);
  assert.ok(cards.every((item) => item.kind === "character"));
  assert.ok(cards.some((item) => item.title.includes("齐剑心")));
  assert.equal(
    cards.some((item) => /发本|开本/.test(item.body)),
    false
  );
});

test("qinglou catalog merges city and character cards", () => {
  const cards = extractQinglouClueCardCatalog(`${CITY}\n${CHAR}`, "");
  assert.ok(cards.length >= 8);
  assert.ok(cards.some((item) => item.kind === "city_rumor"));
  assert.ok(cards.some((item) => item.kind === "character"));
});
