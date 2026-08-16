import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "examples", "pending-review", "未归还", "complete-package");
const narrativeRoot = path.join(packageRoot, "narrative");
const readNarrative = (relativePath) => readFile(path.join(narrativeRoot, relativePath), "utf8");

const roleDirs = (await readdir(narrativeRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

async function roleTexts(rolePrefix) {
  const dir = roleDirs.find((name) => name.startsWith(rolePrefix));
  assert.ok(dir, `missing narrative role ${rolePrefix}`);
  const files = (await readdir(path.join(narrativeRoot, dir)))
    .filter((name) => name.endsWith(".md"))
    .sort();
  const texts = await Promise.all(files.map((file) => readNarrative(`${dir}/${file}`)));
  return { dir, files, texts };
}

test("narrative layer has four separately sealed role books", async () => {
  assert.deepEqual(roleDirs.map((name) => name.slice(0, 2)), ["R1", "R2", "R3", "R4"]);
  for (const role of ["R1", "R2", "R3", "R4"]) {
    const { files, texts } = await roleTexts(role);
    assert.deepEqual(files.map((name) => name.slice(0, 2)), ["00", "01", "02", "03"]);
    assert.ok(texts[0].length > 2000, `${role} opening is too thin`);
    assert.ok(texts.slice(1).every((text) => text.length > 750), `${role} has an underwritten act`);
    assert.match(texts[3], /我愿意付出的代价是/);
  }
});

test("each role keeps a distinct narrative grammar", async () => {
  const [r1, r2, r3, r4] = await Promise.all(["R1", "R2", "R3", "R4"].map(roleTexts));
  assert.match(r1.texts[0], /索书号：无/);
  assert.match(r1.texts[0], /馆藏状态：待核/);
  assert.match(r2.texts[0], /未封口的袋子/);
  assert.match(r2.texts[0], /湿鞋/);
  assert.match(r3.texts[0], /【画面】/);
  assert.match(r3.texts[0], /时间线/);
  assert.match(r4.texts[0], /表层/);
  assert.match(r4.texts[0], /水痕第一层/);
});

test("shared scenes keep exact anchors while changing point of view", async () => {
  const roles = await Promise.all(["R1", "R2", "R3", "R4"].map(roleTexts));
  for (const { texts } of roles) {
    assert.match(texts[0], /照片外面的人算不算在场/);
    assert.match(texts[0], /先让馆活下来，复杂的以后补/);
  }
  for (const role of roles.slice(0, 3)) {
    assert.match(role.texts[0], /经馆方历史档案核实/);
  }
});

test("later evidence does not leak through the wrong role narrative", async () => {
  const [r1, r2, r3, r4] = await Promise.all(["R1", "R2", "R3", "R4"].map(roleTexts));
  assert.equal(r1.texts.slice(0, 2).join("\n").includes("沈启明看见她经过装车口"), false);
  assert.equal(r2.texts.slice(0, 2).join("\n").includes("没有一份允许今夜完整上传"), false);
  assert.equal(r4.texts.slice(0, 2).join("\n").includes("沈启明看见并放行"), false);
  assert.match(r3.texts[2], /自己看见何岚抱箱经过却没有拦/);
  assert.match(r4.texts[2], /不能证明沈启明看见/);
});

test("every role performs a unique causal action instead of waiting for reveal", async () => {
  const [r1, r2, r3, r4] = await Promise.all(["R1", "R2", "R3", "R4"].map(roleTexts));
  assert.match(r1.texts[1], /预分配册/);
  assert.match(r1.texts[2], /E07/);
  assert.match(r2.texts[1], /E02/);
  assert.match(r2.texts[2], /23:20/);
  assert.match(r3.texts[1], /E04/);
  assert.match(r3.texts[2], /E09 两部分一起提交/);
  assert.match(r4.texts[1], /允许封闭查验/);
  assert.match(r4.texts[3], /E10/);
  assert.match(r4.texts[3], /E11/);
});

test("the timeline is consistent with the compact role packets", async () => {
  const [r1, r2] = await Promise.all(["R1", "R2"].map(roleTexts));
  assert.match(r1.texts[0], /2026 年 9 月 17 日/);
  assert.match(r1.texts[0], /一周后的 9 月 24 日/);
  assert.match(r2.texts[0], /2026 年 9 月 24 日/);
  assert.match(r2.texts[0], /2026 年 10 月 3 日/);
});

test("narrative package retains the original-world isolation", async () => {
  const files = [
    "00-叙事总设计.md",
    "01-共同事件与交叉矩阵.md",
    "02-叙事回收与防串词边界.md",
    "03-四线交叉剧情图谱.md",
  ];
  const roleFiles = (await Promise.all(roleDirs.map(async (dir) => (
    (await readdir(path.join(narrativeRoot, dir))).map((file) => `${dir}/${file}`)
  )))).flat();
  const corpus = (await Promise.all([...files, ...roleFiles].map(readNarrative))).join("\n");
  for (const forbidden of ["雾港回声", "停雪", "周沉", "顾晚", "林潮", "方策", "唐野", "灯塔公馆"]) {
    assert.equal(corpus.includes(forbidden), false, `legacy term leaked: ${forbidden}`);
  }
});

test("the narrative graph connects shared history, four agencies, and four outcomes", async () => {
  const graph = await readNarrative("03-四线交叉剧情图谱.md");
  assert.match(graph, /```mermaid/);
  for (const role of ["梁芷", "沈闻川", "周慕", "何溪"]) assert.match(graph, new RegExp(role));
  for (const act of ["第一幕", "第二幕", "第三幕"]) assert.match(graph, new RegExp(act));
  for (const ending of ["延续", "带限制的修复", "越权公开", "分裂或暂停"]) assert.match(graph, new RegExp(ending));
});
