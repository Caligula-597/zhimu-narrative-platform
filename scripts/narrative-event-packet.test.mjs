import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFactionAct1World,
  classifyClause,
  clauseProvenanceGate,
  compileNarrativeIr,
  compilePublicBriefing,
  crossRoleSimilarityGate,
  detectInternalIdentifierLeak,
  extractPublicContext,
  payloadForRenderer,
  surfaceOf
} from "../shared/world-engine/index.js";

test("public context extracts shared dock facts once", () => {
  const world = buildFactionAct1World();
  const pub = extractPublicContext(world.ledger, world);
  assert.ok(pub.some((row) => row.publicId === "PUBLIC_01"));
  assert.ok(pub.some((row) => row.token === "shared_capacity_blocked"));
  assert.match(compilePublicBriefing(pub), /潮水窗口/);
});

test("private packets do not restate public slogans and keep expand windows", () => {
  const world = buildFactionAct1World();
  const zhao = compileNarrativeIr(world.ledger, "CHAR_004", world);
  const min = compileNarrativeIr(world.ledger, "CHAR_003", world);
  const zhaoBody = JSON.stringify(zhao.events);
  assert.equal(/潮水不等人|潮汐/.test(zhaoBody), false);
  assert.ok(zhao.events.some((row) => row.trigger && row.response && row.then));
  assert.ok(zhao.events.some((row) => row.then?.second_operation === "not_started"));
  const wu = compileNarrativeIr(world.ledger, "CHAR_002", world);
  assert.equal(zhao.events[0].response.type, "reject_second_job");
  assert.equal(wu.events[0].response.type, "answer_capacity");
  assert.equal(zhao.events[0].trigger.type, "issue_request");
  assert.equal(wu.events[0].trigger.source, "赵石");
  const payload = payloadForRenderer(min, world.ledger);
  const json = JSON.stringify(payload);
  assert.equal(detectInternalIdentifierLeak(json), false);
  assert.match(json, /四号库那本仓单/);
  assert.match(json, /48/);
  assert.equal(surfaceOf(world.ledger, "OBJ_004"), "四号库那本仓单");
});

test("renderer payload never contains machine ids", () => {
  const world = buildFactionAct1World();
  for (const character of world.ledger.characters) {
    const ir = compileNarrativeIr(world.ledger, character.id, world);
    const payload = payloadForRenderer(ir, world.ledger);
    assert.equal(detectInternalIdentifierLeak(JSON.stringify(payload)), false, character.id);
    assert.ok(ir.events.length >= 1, character.id);
  }
});

test("clause gate rejects leaked ids, atmosphere glue and literary backfill", () => {
  assert.equal(classifyClause("后来。"), "CONNECTIVE");
  const lamp = clauseProvenanceGate("调度室的日光灯嗡嗡作响，我坐在桌前。");
  assert.ok(lamp.some((row) => row.code === "unsupported_world_detail"));
  const leaked = clauseProvenanceGate("一件是OBJ_004，另一件是OBJ_005。");
  assert.ok(leaked.some((row) => row.code === "internal_identifier_leak"));
  const hao = clauseProvenanceGate("调度室的灯光白晃晃的，照得人眼睛发酸。保温杯里的水已经凉了。每一步都踩在时间的节拍上。这场与潮水的赛跑，才刚刚开始。");
  const codes = new Set(hao.map((row) => row.code));
  assert.ok(codes.has("unsupported_world_detail"));
  assert.ok(codes.has("unsupported_interpretation"));
  assert.ok(codes.has("literary_surface_backfill"));
});

test("cross-role gate flags paraphrased tide slogans in private views", () => {
  const issues = crossRoleSimilarityGate([
    { characterId: "CHAR_001", text: "潮水不等人，今晚只能开一钩。" },
    { characterId: "CHAR_002", text: "潮水窗口不等人，离港手续还差几道章。" },
    { characterId: "CHAR_004", text: "潮汐不会等人，人手就这些。" },
    { characterId: "CHAR_008", text: "海水涨落不等人，必须把船送走。" }
  ], [{ publicId: "PUBLIC_01", surface: "今晚作业必须赶在本轮潮水窗口结束前完成。" }]);
  const codes = issues.map((row) => row.code);
  assert.ok(codes.includes("same_public_fact_reexplained_in_private_views"));
  assert.ok(codes.includes("private_view_homogenization"));
});
