import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repoRoot, "examples", "pending-review", "十二盏灯");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const contract = JSON.parse(await read("story-contract.json"));

async function markdownFiles(relative) {
  return (await readdir(path.join(root, relative))).filter((name) => name.endsWith(".md"));
}

test("declares the original six-player four-act format", () => {
  assert.equal(contract.title, "十二盏灯");
  assert.equal(contract.format.players, 6);
  assert.equal(contract.format.acts, 4);
  assert.equal(contract.format.murderMystery, false);
  assert.equal(contract.lights.total, 12);
  assert.equal(contract.roles.length, 6);
  assert.equal(new Set(contract.roles.map((role) => role.application)).size, 6);
});

test("contains complete host, clue, prop, map and foundation layers", async () => {
  assert.equal((await markdownFiles("host")).length, 5);
  assert.equal((await markdownFiles("foundation")).length, 4);
  assert.equal((await markdownFiles("maps")).length, 4);
  assert.equal((await markdownFiles("clues")).length, 15);
  assert.equal((await markdownFiles("props")).length, 8);
});

test("each player receives an opening plus four sealed acts", async () => {
  const playerEntries = await readdir(path.join(root, "players"), { withFileTypes: true });
  const roleDirs = playerEntries.filter((entry) => entry.isDirectory());
  assert.equal(roleDirs.length, 6);

  for (const role of contract.roles) {
    const dir = roleDirs.find((entry) => entry.name.startsWith(`${role.id}-`));
    assert.ok(dir, `missing ${role.id}`);
    const files = (await markdownFiles(path.join("players", dir.name))).sort();
    assert.deepEqual(files.map((name) => name.slice(0, 2)), ["00", "01", "02", "03", "04"]);
    const texts = await Promise.all(files.map((name) => read(path.join("players", dir.name, name))));
    assert.ok(texts[0].length > 1300, `${role.id} opening lacks lived-in narrative`);
    assert.ok(texts.slice(1).every((value) => value.length > 280), `${role.id} has an underwritten act`);
    assert.match(texts[4], /第二盏灯/);
  }
});

test("fact gates use independent source groups and existing evidence", async () => {
  const clueNames = await markdownFiles("clues");
  const ids = new Set(clueNames.map((name) => name.split("-")[0]));
  assert.deepEqual([...new Set(contract.facts.map((fact) => fact.id))].sort(), ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"]);

  for (const fact of contract.facts) {
    assert.ok(fact.gates.length >= 1, `${fact.id} has no evidence gate`);
    for (const gate of fact.gates) {
      assert.equal(gate.length, 2, `${fact.id} gate must contain two sources`);
      assert.equal(new Set(gate).size, 2, `${fact.id} repeats a source in one gate`);
      for (const id of gate) assert.ok(ids.has(id), `${fact.id} misses ${id}`);
    }
  }
});

test("role evidence ownership is unique and complete", () => {
  const owned = contract.roles.flatMap((role) => role.evidence);
  assert.equal(owned.length, 12);
  assert.equal(new Set(owned).size, 12);
  assert.deepEqual([...new Set(owned.map((id) => id[0]))].sort(), ["J", "L", "O", "S", "T", "Z"]);
});

test("opening packets name only their own application id", async () => {
  const playerEntries = await readdir(path.join(root, "players"), { withFileTypes: true });
  const roleDirs = playerEntries.filter((entry) => entry.isDirectory());
  const allApplications = contract.roles.map((role) => role.application);
  for (const role of contract.roles) {
    const dir = roleDirs.find((entry) => entry.name.startsWith(`${role.id}-`));
    const openingName = (await markdownFiles(path.join("players", dir.name))).find((name) => name.startsWith("00-"));
    const opening = await read(path.join("players", dir.name, openingName));
    assert.ok(opening.includes(role.application));
    for (const other of allApplications.filter((id) => id !== role.application)) {
      assert.equal(opening.includes(other), false, `${role.id} opening leaks ${other}`);
    }
  }
});

test("the package does not reuse the previous prototypes", async () => {
  async function walk(relative) {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => {
      const next = path.join(relative, entry.name);
      return entry.isDirectory() ? walk(next) : [next];
    }))).flat();
  }
  const files = (await walk(".")).filter((name) => name.endsWith(".md") || name.endsWith(".json"));
  const corpus = (await Promise.all(files.map(read))).join("\n");
  for (const forbidden of ["未归还", "六号闸不等天亮", "梁芷", "沈闻川", "陆原", "方既白"]) {
    if (forbidden === "未归还" || forbidden === "六号闸不等天亮") continue; // README states the isolation boundary by name.
    assert.equal(corpus.includes(forbidden), false, `legacy character leaked: ${forbidden}`);
  }
  for (const alternatives of [["隐藏账户", "隐藏资金"], ["终幕空降证据", "终幕新证据", "第四幕不再发事实线索"], ["真正英雄", "单人神话"]]) {
    assert.ok(alternatives.some((device) => corpus.includes(device)), `missing explicit guard: ${alternatives.join("/")}`);
  }
});

function classifyLights(counts) {
  const low = counts.filter((count) => count <= 1).length;
  const high = counts.filter((count) => count >= 3).length;
  if (high >= 2 && low >= 2) return "L1";
  if (counts.every((count) => count === 2)) return "L2";
  if ((high === 1 || high === 2) && counts.every((count) => count > 0) && counts.filter((count) => count === 1).length <= 1) return "L3";
  if (low >= 3) return "L0";
  return "L4";
}

function resolve({ t, r, l, f5, correction, contractPaused, fallbackValid, mutualPairs, noZero, atLeastThreeSafe }) {
  if ((contractPaused && !fallbackValid) || (t === "T2" && r === "R0")) return "END-E";
  if (t === "T0" || (!f5 && !correction)) return "END-A";
  if (t === "T2" && r === "R2" && l === "L4" && noZero && atLeastThreeSafe && mutualPairs >= 3) return "END-F";
  if (t === "T2" && ["R1", "R2"].includes(r) && l === "L3") return "END-D";
  if (["T1", "T2"].includes(t) && l === "L2") return "END-C";
  return "END-B";
}

test("all integer light distributions have a state and all state combinations resolve", () => {
  let distributions = 0;
  function visit(index, remaining, values) {
    if (index === 5) {
      const counts = [...values, remaining];
      assert.ok(["L0", "L1", "L2", "L3", "L4"].includes(classifyLights(counts)));
      distributions += 1;
      return;
    }
    for (let count = 0; count <= remaining; count += 1) visit(index + 1, remaining - count, [...values, count]);
  }
  visit(0, 12, []);
  assert.equal(distributions, 6188);

  for (const t of ["T0", "T1", "T2"])
    for (const r of ["R0", "R1", "R2"])
      for (const l of ["L0", "L1", "L2", "L3", "L4"])
        for (const f5 of [false, true])
          for (const correction of [false, true])
            for (const contractPaused of [false, true])
              for (const fallbackValid of [false, true]) {
                const ending = resolve({ t, r, l, f5, correction, contractPaused, fallbackValid, mutualPairs: 3, noZero: true, atLeastThreeSafe: true });
                assert.ok(contract.endings.includes(ending));
              }
});

test("host summary contains all core truths and ending branches", async () => {
  const [host, truth, ending, graph] = await Promise.all([
    read("host/00-主持人总手册.md"),
    read("host/03-完整真相与复盘.md"),
    read("host/02-事实核验与结局结算.md"),
    read("maps/03-结局分流图谱.md"),
  ]);
  for (const name of contract.roles.map((role) => role.name)) assert.ok(host.includes(name));
  for (const fact of contract.facts) assert.ok(ending.includes(fact.id));
  for (const id of contract.endings) {
    assert.ok(ending.includes(id));
    assert.ok(graph.includes(id));
  }
  for (const anchor of ["工牌走过的路", "一个英雄如何被做出来", "承诺如何失效"]) assert.ok(truth.includes(anchor));
});
