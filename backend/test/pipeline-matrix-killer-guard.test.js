import assert from "node:assert/strict";
import test from "node:test";
import { scanKillerSpoilers, tokensFromForbiddenFact } from "../src/pipeline-matrix-killer-guard.js";

test("tokensFromForbiddenFact splits phrases", () => {
  const tokens = tokensFromForbiddenFact("暗格存在与走私动机");
  assert.ok(tokens.includes("暗格存在与走私动机".replace(/\s/g, "")));
  assert.ok(tokens.some((t) => t.includes("走私")));
});

test("scanKillerSpoilers passes innocent role", () => {
  const r = scanKillerSpoilers("你怀疑方远在撒谎。", {
    spoilerContract: { forbiddenFacts: ["走私动机"] },
    actIndex: 0,
    isKiller: false,
    finalActIndex: 2
  });
  assert.equal(r.passed, true);
});

test("scanKillerSpoilers flags killer confession patterns", () => {
  const body = "你想起昨天配了钥匙胚，频率干扰的事已经记录在日志里。";
  const r = scanKillerSpoilers(body, {
    spoilerContract: { forbiddenFacts: ["走私动机", "钥匙胚"] },
    actIndex: 0,
    isKiller: true,
    finalActIndex: 2
  });
  assert.equal(r.passed, false);
  assert.ok(r.violations.length >= 1);
});

test("scanKillerSpoilers ignores 推开门", () => {
  const r = scanKillerSpoilers("你推开门，盐雾灌进来。", {
    spoilerContract: { forbiddenFacts: [] },
    actIndex: 0,
    isKiller: true,
    finalActIndex: 2
  });
  assert.equal(r.passed, true);
});

test("scanKillerSpoilers allows killer final act", () => {
  const body = "你承认设置了机关，周沉因此坠亡。";
  const r = scanKillerSpoilers(body, {
    spoilerContract: { forbiddenFacts: [] },
    actIndex: 2,
    isKiller: true,
    finalActIndex: 2
  });
  assert.equal(r.passed, true);
});
