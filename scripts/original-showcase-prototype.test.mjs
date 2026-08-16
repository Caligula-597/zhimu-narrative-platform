import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storyRoot = path.join(root, "examples", "pending-review", "未归还");
const prototypeRoot = path.join(storyRoot, "prototype-v1");

const readText = (relativePath) => readFile(path.join(prototypeRoot, relativePath), "utf8");
const readJson = async (absolutePath) => JSON.parse(await readFile(absolutePath, "utf8"));

const [foundation, prototype] = await Promise.all([
  readJson(path.join(storyRoot, "logic-contract.json")),
  readJson(path.join(prototypeRoot, "prototype-contract.json")),
]);

test("prototype stays isolated from every named legacy story element", async () => {
  const paths = Object.values(prototype.documents).flat();
  const texts = await Promise.all(paths.map(readText));
  const corpus = texts.join("\n");

  assert.equal(prototype.isolation.usesPreviousStoryContent, false);
  for (const term of prototype.isolation.forbiddenLegacyTerms) {
    assert.equal(corpus.includes(term), false, `legacy term leaked into prototype: ${term}`);
  }
});

test("prototype contains exactly three host guides, eight evidence packets, and four role packets", async () => {
  assert.equal(prototype.documents.host.length, 3);
  assert.equal(prototype.documents.evidence.length, 8);
  assert.equal(prototype.documents.roles.length, 4);

  const paths = Object.values(prototype.documents).flat();
  const texts = await Promise.all(paths.map(readText));
  assert.equal(texts.every((text) => text.trim().length > 200), true);
});

test("start-here distribution assigns all sources to the correct act and holder", async () => {
  const startHere = await readText("START-HERE.md");
  const expectedAssignments = {
    R1: { 1: ["E01", "E03"], 2: ["E07"] },
    R2: { 1: ["E02"], 2: ["E05", "E08"] },
    R3: { 1: ["E04"], 2: ["E09"] },
    R4: { 2: ["E06"], 3: ["E10", "E11"] },
  };

  for (const [roleId, acts] of Object.entries(expectedAssignments)) {
    for (const [act, sourceIds] of Object.entries(acts)) {
      for (const sourceId of sourceIds) {
        const source = foundation.evidence.find((item) => item.id === sourceId);
        assert.equal(source.initialHolder, roleId);
        assert.equal(source.actAvailable, Number(act));
        assert.equal(startHere.includes(sourceId), true, `${sourceId} missing from start-here distribution`);
      }
    }
  }
  assert.match(startHere, /E09（A\/B 不可拆）/);
});

test("all twelve evidence sources appear once and remain assigned to their canon holders and acts", async () => {
  const evidenceTexts = await Promise.all(prototype.documents.evidence.map(readText));
  const headingIds = evidenceTexts.flatMap((text) => [...text.matchAll(/^## (E\d{2})(?:-[A-Z])?｜/gm)].map((match) => match[1]));
  const uniqueHeadingIds = [...new Set(headingIds)].sort();
  const canonIds = foundation.evidence.map((item) => item.id).sort();

  assert.deepEqual(uniqueHeadingIds, canonIds);

  const distributedSources = prototype.distribution.flatMap((packet) =>
    packet.sources.map((source) => ({
      id: source.id,
      holder: source.holder,
      act: packet.act,
      packet: packet.packet,
    })),
  );

  assert.equal(distributedSources.length, 12);
  assert.equal(new Set(distributedSources.map((item) => item.id)).size, 12);

  for (const source of distributedSources) {
    const canon = foundation.evidence.find((item) => item.id === source.id);
    const packet = foundation.gameplayPackets.find((item) => item.id === source.packet);
    assert.ok(canon, `missing canon source ${source.id}`);
    assert.ok(packet, `missing canon packet ${source.packet}`);
    assert.equal(source.holder, canon.initialHolder, `${source.id} holder drifted`);
    assert.equal(source.act, canon.actAvailable, `${source.id} act drifted`);
    assert.equal(packet.evidence.includes(source.id), true, `${source.id} is in the wrong packet`);
  }
});

test("first-act evidence does not leak the later custody and consent answers", async () => {
  const [p01, p02, p03, p04, p05] = await Promise.all([
    readText("evidence/P01-编号对照.md"),
    readText("evidence/P02-抢救现场.md"),
    readText("evidence/P03-今夜签约.md"),
    readText("evidence/P04-暂缓与报损.md"),
    readText("evidence/P05-保管日志.md"),
  ]);

  for (const forbidden of ["何岚带走", "沈启明知情", "没有拦", "洪损未回收"]) {
    assert.equal(p01.includes(forbidden), false, `P01 leaked: ${forbidden}`);
  }
  for (const forbidden of ["2001-017", "受访授权", "故意写的"]) {
    assert.equal(p02.includes(forbidden), false, `P02 leaked: ${forbidden}`);
  }
  for (const forbidden of ["何岚带走", "沈启明在装车口", "十二份授权结果"]) {
    assert.equal(p03.includes(forbidden), false, `P03 leaked: ${forbidden}`);
  }
  for (const forbidden of ["何岚带走", "沈启明亲眼", "完整录音"]) {
    assert.equal(p04.includes(forbidden), false, `P04 over-proved: ${forbidden}`);
  }
  for (const forbidden of ["沈启明看见", "沈启明知情", "沈启明没有拦"]) {
    assert.equal(p05.includes(forbidden), false, `P05 over-proved: ${forbidden}`);
  }
});

test("role packets expose playable tasks while preserving explicit unknowns and sealed later evidence", async () => {
  const roles = await Promise.all(prototype.documents.roles.map(async (rolePath) => ({
    rolePath,
    text: await readText(rolePath),
  })));

  const requiredUnknowns = {
    R1: ["不知道第 17 箱是否还在", "没有见过沈启明的纠正信"],
    R2: ["不知道第 17 箱是否留存至今", "没有听过沈启明 2024 年完整录音"],
    R3: ["不知道第 17 箱现在是否存在", "没见过何岚的保管日志"],
    R4: ["不知道沈启明当年是否亲眼看见", "没见过他的纠正信或完整录音"],
  };

  for (const { rolePath, text } of roles) {
    const roleId = path.basename(rolePath).slice(0, 2);
    assert.match(text, /^## 你的三个主动任务$/m, `${roleId} lacks active tasks`);
    const taskSection = text.split("## 你的三个主动任务")[1].split("## ")[0];
    assert.equal([...taskSection.matchAll(/^\d\. /gm)].length, 3, `${roleId} must have exactly three act-one tasks`);
    assert.match(text, /不得拆开|现在不得拆开|不得提前展示/, `${roleId} lacks a later-evidence seal`);
    for (const unknown of requiredUnknowns[roleId]) {
      assert.equal(text.includes(unknown), true, `${roleId} missing explicit unknown: ${unknown}`);
    }
  }
});

test("host gate keeps every verification rule aligned with the foundation contract", async () => {
  const host = await readText("host/01-事实核验与结算.md");

  for (const [factId, gate] of Object.entries(prototype.verification)) {
    assert.equal(host.includes(factId), true, `${factId} missing from host verification card`);
    for (const sourceId of gate.requiredPublicSources) {
      assert.equal(host.includes(sourceId), true, `${factId} host gate missing ${sourceId}`);
    }

    const canon = foundation.facts.find((fact) => fact.id === factId);
    assert.deepEqual(gate.requiredPublicSources, canon.requiredEvidence, `${factId} required sources drifted`);
  }

  assert.match(host, /玩家口述、私人剧本和主持提示均不能替代来源/);
  assert.match(host, /只按门槛打勾/);
});

function verifiedFact(factId, publicSourceIds) {
  const gate = prototype.verification[factId];
  const publicSources = new Set(publicSourceIds);
  return gate.requiredPublicSources.every((sourceId) => publicSources.has(sourceId))
    && (!gate.oneOfPublicSources || gate.oneOfPublicSources.some((sourceId) => publicSources.has(sourceId)));
}

test("compound fact gates accept either declared motive source but never the base pair alone", () => {
  assert.equal(verifiedFact("F4", ["E05", "E07"]), false);
  assert.equal(verifiedFact("F4", ["E05", "E07", "E08"]), true);
  assert.equal(verifiedFact("F4", ["E05", "E07", "E09"]), true);
  assert.equal(verifiedFact("F4", ["E05", "E08", "E09"]), false);
});

test("each role keeps one non-transferable final power with at least three choices", async () => {
  assert.equal(prototype.roleAgency.length, 4);
  for (const role of prototype.roleAgency) {
    assert.equal(role.cannotBeSubstituted, true, `${role.role} became substitutable`);
    assert.equal(role.finalPower.length >= 3, true, `${role.role} lacks meaningful final choices`);
    assert.equal(role.minimumActOneTasks, 3);
  }

  const host = await readText("host/00-开场与场控.md");
  assert.match(host, /不能被多数票覆盖/);
  assert.match(host, /不能抢夺卡片、代替签字/);
});

test("multi-part source cards are indivisible once their holder releases them", async () => {
  const [readme, host, p07] = await Promise.all([
    readText("README.md"),
    readText("host/00-开场与场控.md"),
    readText("evidence/P07-完整录音.md"),
  ]);

  assert.match(readme, /A\/B 小节是一张不可拆分的卡/);
  assert.match(host, /提交 E09，就同时提交录音转写与剪辑时间线/);
  assert.match(p07, /^## E09-A｜/m);
  assert.match(p07, /^## E09-B｜/m);
});

test("refusal changes the state without forcing a reveal or aborting the session", async () => {
  const [host, hexi] = await Promise.all([
    readText("host/00-开场与场控.md"),
    readText("roles/R4-何溪-第一幕.md"),
  ]);

  assert.match(host, /若何溪拒绝说/);
  assert.match(host, /游戏继续/);
  assert.match(host, /不要由主持替她揭底/);
  assert.match(hexi, /游戏继续，箱已寻回的状态不会被主持代为确认/);
  assert.match(hexi, /拒绝不是玩坏/);
  assert.match(hexi, /E01 与 E02 仍可证明 17 号在 2001 年真实存在/);
  assert.equal(verifiedFact("F2", ["E01", "E02"]), true, "R4 refusal cannot invalidate independent public sources");
});

test("the timed funding gate has a deterministic no-response consequence without host substitution", async () => {
  const host = await readText("host/00-开场与场控.md");
  const r2 = prototype.roleAgency.find((role) => role.role === "R2");

  assert.equal(r2.actTwoGate.includes("no_response"), true);
  assert.match(host, /拒绝答复或倒计时结束仍不选/);
  assert.match(host, /主持不得代选/);
  assert.match(host, /第 9\.3 条资格同样关闭/);
});

test("best ending needs evidence, the timed correction gate, and all four signed actions", async () => {
  const sourceEnding = foundation.endings.find((ending) => ending.id === "END-B");
  const prototypeEnding = prototype.endingRequirements["END-B"];
  assert.deepEqual(prototypeEnding, sourceEnding.requirements);
  assert.deepEqual(prototype.endingResolutionOrder, foundation.endingResolutionOrder);

  for (const requirement of [
    "verified_facts>=5",
    "R2:correction_gate_available",
    "R1:sign_with_correction",
    "R2:activate_correction",
    "R3:air_corrected_summary",
    "R4:conditional_deposit",
  ]) {
    assert.equal(prototypeEnding.includes(requirement), true, `END-B missing ${requirement}`);
  }
});

test("evidence language preserves the ownership-publication distinction", async () => {
  const [p05, p08, host] = await Promise.all([
    readText("evidence/P05-保管日志.md"),
    readText("evidence/P08-箱与授权.md"),
    readText("host/00-开场与场控.md"),
  ]);

  assert.match(p05, /我知道这不是我的东西/);
  assert.match(p05, /保存不是替他们同意/);
  assert.match(p08, /都可登记为公共馆藏/);
  assert.match(p08, /没有一份授权允许今夜把原始录音完整上传或直播/);
  assert.match(host, /明确区分所有权、入藏、研究查阅、摘要传播和原始录音对外发布/);
});

test("table rules distinguish closed-room verification, accession, and external publication", async () => {
  const [readme, host, settlement, r3, r4] = await Promise.all([
    readText("README.md"),
    readText("host/00-开场与场控.md"),
    readText("host/01-事实核验与结算.md"),
    readText("roles/R3-周慕-第一幕.md"),
    readText("roles/R4-何溪-第一幕.md"),
  ]);

  assert.match(readme, /“提交核验”“登记入藏”和“对外传播”/);
  assert.match(host, /提交核验.*不等于把材料交给图书馆，也不等于向公众发布/);
  assert.match(settlement, /它不等于登记入藏或对外传播/);
  assert.match(r3, /提交它不需要何溪授权/);
  assert.match(r4, /不妨碍任何人提交自己手里的来源卡做闭门核验/);
});

test("conditional exchanges must resolve immediately instead of rolling into a future round", async () => {
  const [readme, host, r2] = await Promise.all([
    readText("README.md"),
    readText("host/00-开场与场控.md"),
    readText("roles/R2-沈闻川-第一幕.md"),
  ]);

  assert.match(readme, /不能继续用同一条件拖到下一轮/);
  assert.match(host, /一旦接受，提出条件的人要立刻履行/);
  assert.match(r2, /不能承诺“下一轮再交”/);
});

test("table tool cards expose the three action layers, funding gate, clocks, and ending order", async () => {
  const tools = await readText("host/02-桌面工具卡.md");

  for (const heading of ["提交核验", "登记入藏", "对外传播", "条件板", "三幕时钟条", "23:20 基金答复卡", "主持结算速查"]) {
    assert.equal(tools.includes(heading), true, `table tools missing ${heading}`);
  }
  for (const action of ["L1", "L2", "L3", "S1", "S2", "S3", "Z1", "Z2", "Z3", "Z4", "H1", "H2", "H3", "H4"]) {
    assert.equal(tools.includes(action), true, `table tools missing ${action}`);
  }
  assert.match(tools, /周慕 Z3 \+ 何溪 H4 → C/);
  assert.match(tools, /至少五项事实.*L2 \+ S2 \+ Z2 \+ H2 → B/);
  assert.match(tools, /梁芷 L1 \+ 沈闻川 S1.*→ A/);
  assert.match(tools, /其余 → D/);
});

function resolveEnding({ verifiedFacts, correctionGateAvailable, r1, r2, r3, r4 }) {
  if (r3 === "publish_raw" && r4 === "unrestricted_handover") return "END-C";
  if (
    verifiedFacts >= 5
    && correctionGateAvailable
    && r1 === "sign_with_correction"
    && r2 === "activate_correction"
    && r3 === "air_corrected_summary"
    && r4 === "conditional_deposit"
  ) return "END-B";
  if (r1 === "sign" && r2 === "keep_naming") return "END-A";
  return "END-D";
}

test("representative player states resolve in the declared C-B-A-D order", () => {
  assert.equal(resolveEnding({
    verifiedFacts: 6,
    correctionGateAvailable: true,
    r1: "sign_with_correction",
    r2: "activate_correction",
    r3: "publish_raw",
    r4: "unrestricted_handover",
  }), "END-C", "raw publication must outrank the repair ending");

  assert.equal(resolveEnding({
    verifiedFacts: 5,
    correctionGateAvailable: true,
    r1: "sign_with_correction",
    r2: "activate_correction",
    r3: "air_corrected_summary",
    r4: "conditional_deposit",
  }), "END-B");

  assert.equal(resolveEnding({
    verifiedFacts: 1,
    correctionGateAvailable: false,
    r1: "sign",
    r2: "keep_naming",
    r3: "air_old_cut",
    r4: "withhold",
  }), "END-A", "defensive normal signing still causes the compromised opening ending");

  assert.equal(resolveEnding({
    verifiedFacts: 4,
    correctionGateAvailable: false,
    r1: "pause_transfer",
    r2: "freeze_grant",
    r3: "cancel_stream",
    r4: "escrow_review",
  }), "END-D");
});
