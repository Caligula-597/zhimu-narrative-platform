import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "examples", "pending-review", "未归还", "complete-package");
const readText = (relativePath) => readFile(path.join(packageRoot, relativePath), "utf8");
const contract = JSON.parse(await readText("story-contract.json"));

const roleDirNames = await readdir(path.join(packageRoot, "roles"));
const clueFileNames = (await readdir(path.join(packageRoot, "clues"))).filter((name) => name.endsWith(".md"));
const hostFileNames = (await readdir(path.join(packageRoot, "host"))).filter((name) => name.endsWith(".md"));
const mapFileNames = (await readdir(path.join(packageRoot, "maps"))).filter((name) => name.endsWith(".md"));

test("complete package has the declared format and no legacy contamination", async () => {
  assert.equal(contract.title, "未归还");
  assert.equal(contract.packageStatus, "narrative_human_table_pending");
  assert.equal(contract.format.players, 4);
  assert.equal(contract.format.acts, 3);
  assert.deepEqual(contract.actionLayers, ["submit_for_verification", "accession", "external_publication"]);

  const allPaths = [
    "README.md",
    "00-剧情合理性审查.md",
    ...clueFileNames.map((name) => `clues/${name}`),
    ...hostFileNames.map((name) => `host/${name}`),
    ...mapFileNames.map((name) => `maps/${name}`),
    ...(await Promise.all(roleDirNames.map(async (dir) => (
      (await readdir(path.join(packageRoot, "roles", dir))).map((name) => `roles/${dir}/${name}`)
    )))).flat(),
  ];
  const corpus = (await Promise.all(allPaths.map(readText))).join("\n");
  for (const forbidden of ["雾港回声", "停雪", "周沉", "顾晚", "林潮", "方策", "唐野", "灯塔公馆"]) {
    assert.equal(corpus.includes(forbidden), false, `legacy term leaked: ${forbidden}`);
  }
});

test("package contains twelve standalone clues with unique ids", async () => {
  assert.equal(clueFileNames.length, 12);
  assert.equal(contract.clues.length, 12);
  const contractIds = contract.clues.map((clue) => clue.id).sort();
  assert.deepEqual(contractIds, Array.from({ length: 12 }, (_, index) => `E${String(index + 1).padStart(2, "0")}`));

  for (const clue of contract.clues) {
    const fileName = clueFileNames.find((name) => name.startsWith(`${clue.id}-`));
    assert.ok(fileName, `missing standalone clue file ${clue.id}`);
    const text = await readText(`clues/${fileName}`);
    assert.match(text, new RegExp(`^# ${clue.id}｜`, "m"));
    assert.match(text, /### 核验边界/);
    assert.equal(text.includes("持有人："), true, `${clue.id} lacks holder label`);
    assert.equal(text.includes("可提交核验") || clue.holder === "PUBLIC", true, `${clue.id} lacks act label`);
  }
});

test("all clue holders and act releases are complete and non-duplicated", () => {
  const clueIds = contract.clues.map((clue) => clue.id);
  const actIds = Object.values(contract.actClues).flat();
  assert.deepEqual([...actIds].sort(), [...clueIds].sort());
  assert.equal(new Set(actIds).size, 12);

  for (const [actId, ids] of Object.entries(contract.actClues)) {
    const expectedAct = Number(actId.slice(1));
    for (const clueId of ids) {
      const clue = contract.clues.find((item) => item.id === clueId);
      assert.equal(clue.act, expectedAct, `${clueId} is in the wrong act`);
      assert.ok(clue.holder === "PUBLIC" || contract.roles.some((role) => role.id === clue.holder));
    }
  }
});

test("every fact requires independent source groups and declared clue support", () => {
  for (const fact of contract.facts) {
    assert.equal(fact.required.length >= 2, true, `${fact.id} lacks a two-source gate`);
    const requiredClues = fact.required.map((id) => contract.clues.find((clue) => clue.id === id));
    assert.equal(requiredClues.every(Boolean), true, `${fact.id} references a missing clue`);
    assert.equal(new Set(requiredClues.map((clue) => clue.sourceGroup)).size, requiredClues.length, `${fact.id} is same-source corroboration`);
    for (const clue of requiredClues) {
      assert.equal(clue.supports.includes(fact.id), true, `${clue.id} does not declare ${fact.id}`);
    }
    if (fact.oneOf) {
      assert.equal(fact.oneOf.length >= 2, true);
      for (const clueId of fact.oneOf) {
        assert.equal(contract.clues.find((clue) => clue.id === clueId)?.supports.includes(fact.id), true);
      }
    }
  }
});

test("four roles each receive an opening and three sealed act packets", async () => {
  assert.equal(roleDirNames.length, 4);
  for (const role of contract.roles) {
    const dirName = roleDirNames.find((name) => name.startsWith(`${role.id}-`));
    assert.ok(dirName, `missing role directory ${role.id}`);
    const files = (await readdir(path.join(packageRoot, "roles", dirName))).filter((name) => name.endsWith(".md")).sort();
    assert.deepEqual(files.map((name) => name.slice(0, 2)), ["00", "01", "02", "03"]);
    const texts = await Promise.all(files.map((name) => readText(`roles/${dirName}/${name}`)));
    assert.equal(texts.every((text) => text.length > 350), true, `${role.id} has an underwritten act`);
    assert.match(texts[2], /现在才打开/);
    assert.equal(texts[3].includes("终局动作") || texts[3].includes("四个终局动作") || texts[3].includes("三个终局动作"), true);
    for (const action of role.finalActions) {
      assert.equal(texts[3].includes(action), true, `${role.id} final packet lacks ${action}`);
    }
  }
});

test("role information gates do not leak other holders' later evidence", async () => {
  const roleText = async (roleId, prefix) => {
    const dirName = roleDirNames.find((name) => name.startsWith(`${roleId}-`));
    const fileName = (await readdir(path.join(packageRoot, "roles", dirName))).find((name) => name.startsWith(prefix));
    return readText(`roles/${dirName}/${fileName}`);
  };

  const [r1a1, r2a1, r3a1, r4a1] = await Promise.all([
    roleText("R1", "01"), roleText("R2", "01"), roleText("R3", "01"), roleText("R4", "01")
  ]);
  assert.equal(r1a1.includes("沈启明看见她经过装车口"), false);
  assert.equal(r2a1.includes("没有一份允许今夜完整上传"), false);
  assert.equal(r3a1.includes("洪损未回收是我故意写的"), false);
  assert.equal(r4a1.includes("沈启明看见并放行"), false);
});

test("the repaired ending contract is deterministic and closes known loopholes", () => {
  assert.deepEqual(contract.endingOrder, ["END-C", "END-B", "END-A", "END-D"]);
  const repair = contract.endings["END-B"].requires;
  for (const gate of ["verified_count>=5", "verified:F1", "verified:F2", "verified:F6", "correction_gate_available", "R1:L2", "R2:S2", "R3:Z2", "R4:H2"]) {
    assert.equal(repair.includes(gate), true, `END-B missing ${gate}`);
  }
  assert.equal(contract.endings["END-A"].requires.includes("not:R3:Z3"), true);
});

function resolveEnding({ verified, gate, r1, r2, r3, r4 }) {
  if (r3 === "Z3" && r4 === "H4") return "END-C";
  if (
    verified.length >= 5
    && ["F1", "F2", "F6"].every((id) => verified.includes(id))
    && gate
    && r1 === "L2" && r2 === "S2" && r3 === "Z2" && r4 === "H2"
  ) return "END-B";
  if (r1 === "L1" && r2 === "S1" && r3 !== "Z3") return "END-A";
  return "END-D";
}

test("representative action combinations resolve to the authored outcomes", () => {
  assert.equal(resolveEnding({ verified: ["F1", "F2", "F3", "F4", "F5", "F6"], gate: true, r1: "L2", r2: "S2", r3: "Z3", r4: "H4" }), "END-C");
  assert.equal(resolveEnding({ verified: ["F1", "F2", "F3", "F5", "F6"], gate: true, r1: "L2", r2: "S2", r3: "Z2", r4: "H2" }), "END-B");
  assert.equal(resolveEnding({ verified: ["F2"], gate: false, r1: "L1", r2: "S1", r3: "Z4", r4: "H3" }), "END-A");
  assert.equal(resolveEnding({ verified: ["F1", "F2", "F3", "F4", "F5", "F6"], gate: true, r1: "L2", r2: "S2", r3: "Z3", r4: "H2" }), "END-D", "raw publication without box handover is not A or C");
  assert.equal(resolveEnding({ verified: ["F2", "F3", "F4"], gate: false, r1: "L3", r2: "S3", r3: "Z4", r4: "H3" }), "END-D");
});

test("host truth and clue text repair ownership, attendance, and evidence provenance", async () => {
  const [audit, host, e02, e04, e06] = await Promise.all([
    readText("00-剧情合理性审查.md"),
    readText("host/00-主持总册.md"),
    readText("clues/E02-口述项目装箱与移交单.md"),
    readText("clues/E04-未刊接触印样与现场笔记.md"),
    readText("clues/E06-何岚保管日志.md"),
  ]);
  assert.match(audit, /为什么第 17 箱属于公共材料/);
  assert.match(audit, /为什么四个人今晚必须在场/);
  assert.match(e02, /永久保存/);
  assert.match(e02, /不得以保管权代替传播授权/);
  assert.match(e04, /记者家属授权/);
  assert.match(e06, /项目办公室早就撤了/);
  assert.match(host, /只有他能处理冠名、纠正条款和资金冻结/);
});

test("maps cover the complete flow, facts, relationships, and ending branches", async () => {
  assert.equal(mapFileNames.length, 4);
  const mapTexts = await Promise.all(mapFileNames.map((name) => readText(`maps/${name}`)));
  assert.equal(mapTexts.every((text) => text.includes("```mermaid")), true);
  const corpus = mapTexts.join("\n");
  for (const fact of contract.facts) assert.equal(corpus.includes(fact.id), true, `maps miss ${fact.id}`);
  for (const clue of contract.clues) assert.equal(corpus.includes(clue.id), true, `maps miss ${clue.id}`);
  for (const ending of ["A", "B", "C", "D"]) assert.equal(corpus.includes(`${ending}｜`) || corpus.includes(`${ending} `), true, `maps miss ending ${ending}`);
  for (const role of contract.roles) assert.equal(corpus.includes(role.name), true, `maps miss ${role.name}`);
});
