import assert from "node:assert/strict";
import test from "node:test";
import {
  scanDuplicatePassages,
  scanInternalMarkers,
  scanPovConsistency,
  scanUnregisteredCharacterNames
} from "../src/pipeline-matrix-script-gates.js";

const characterArchives = {
  roles: [
    { key: "role-1", name: "方既白 · 工程师" },
    { key: "role-2", name: "岑见潮 · 调度员" }
  ]
};
const truthBible = {
  victim: "陆原",
  physicalTimeline: [{ participants: ["陆原", "方既白"] }]
};

test("scanInternalMarkers rejects authoring state leaked into player prose", () => {
  assert.equal(scanInternalMarkers("[规定疑惑] 谁改了记录？").passed, false);
  assert.equal(scanInternalMarkers("公开完整报告，后台写入 state-access。 ").passed, false);
  assert.equal(scanInternalMarkers("你翻开报告，没有立刻表态。").passed, true);
});

test("scanPovConsistency ignores dialogue pronouns but rejects narration drift", () => {
  assert.equal(scanPovConsistency("你抬起头。岑见潮说：『我不同意。』", "second").passed, true);
  assert.equal(scanPovConsistency("你抬起头。\n\n我按下确认键。", "second").passed, false);
  assert.equal(scanPovConsistency("方既白说完，重新看向屏幕。", "second", "方既白 · 运行主任").passed, false);
  assert.equal(scanPovConsistency("责任链记录里写着方既白的名字。", "second", "方既白 · 运行主任").passed, true);
  assert.equal(scanPovConsistency("方[既]白说完后离开。", "second", "方[既]白 · 代号角色").passed, false);
});

test("scanDuplicatePassages rejects repeated narrative paragraphs", () => {
  const paragraph = "你沿着闸门外廊走了一圈，先核对压力曲线，再把异常读数抄进值班簿。回到控制室时，屏幕上的潮窗只剩下一半。";
  assert.equal(scanDuplicatePassages(`${paragraph}\n\n${paragraph}`).passed, false);
  assert.equal(scanDuplicatePassages(`${paragraph}\n\n岑见潮没有接你的话，只把下一张调度表推过来。`).passed, true);
});

test("scanUnregisteredCharacterNames allows roster and victim but rejects invented people", () => {
  const good = scanUnregisteredCharacterNames(
    "方既白说完后，岑见潮没有回答。陆原的死亡记录仍在桌上。",
    characterArchives,
    truthBible
  );
  assert.equal(good.passed, true);

  const ordinaryPhrase = scanUnregisteredCharacterNames(
    "你没有立刻回应，和此刻的警报相比，程序争执显得太轻。",
    characterArchives,
    truthBible
  );
  assert.equal(ordinaryPhrase.passed, true);

  const bad = scanUnregisteredCharacterNames(
    "沈念在哭，吴福抖着手递来一张旧纸。",
    characterArchives,
    truthBible
  );
  assert.equal(bad.passed, false);
  assert.deepEqual(bad.violations.map((item) => item.name).sort(), ["吴福", "沈念"]);
});
