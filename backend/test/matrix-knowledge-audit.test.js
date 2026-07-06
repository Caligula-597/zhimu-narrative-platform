import assert from "node:assert/strict";
import test from "node:test";
import {
  collectPriorRoleKnowledge,
  scanKnowledgeLeakHeuristic,
  validateKnowledgeBoundaryAudit
} from "../src/prompts/matrix-knowledge-audit.js";

test("collectPriorRoleKnowledge gathers earlier acts only", () => {
  const actOutlines = {
    "role-1": {
      ch1: { knowledgeSources: [{ fact: "听到闷响", source: "亲耳" }], unknowns: ["机关原理"] },
      ch2: { knowledgeSources: [{ fact: "看见钟停", source: "亲眼" }] }
    }
  };
  const prior = collectPriorRoleKnowledge(actOutlines, "role-1", "ch2", { chapterKeys: ["ch1", "ch2", "ch3"] });
  assert.ok(prior.facts.some((f) => f.includes("闷响")));
  assert.ok(prior.unknowns.some((u) => u.includes("机关")));
});

test("scanKnowledgeLeakHeuristic flags ungrounded 想起叔父曾教", () => {
  const body = "你想起叔父曾教你用细绳和配重绳制作简易机构。";
  const r = scanKnowledgeLeakHeuristic(body, {
    actOutline: { knowledgeSources: [{ fact: "看见遗嘱", source: "亲眼" }] },
    priorKnowledgeFacts: [],
    priorScriptBodies: ["大雪封山，你端药至书斋。"]
  });
  assert.equal(r.passed, false);
  assert.ok(r.hits.some((h) => h.type === "ungrounded_recall"));
});

test("scanKnowledgeLeakHeuristic allows grounded recall from prior script", () => {
  const body = "你想起叔父曾教你用细绳做机关。";
  const r = scanKnowledgeLeakHeuristic(body, {
    actOutline: { knowledgeSources: [] },
    priorKnowledgeFacts: [],
    priorScriptBodies: ["叔父曾教你用细绳和配重绳做机关捉弄仆人。"]
  });
  assert.equal(r.passed, true);
});

test("validateKnowledgeBoundaryAudit fails on high leaks", () => {
  const out = validateKnowledgeBoundaryAudit({
    passed: false,
    verdict: "越界",
    leaks: [{ excerpt: "x", claim: "y", severity: "high", reason: "无前幕铺垫" }]
  });
  assert.equal(out.passed, false);
  assert.equal(out.leaks[0].severity, "high");
});
