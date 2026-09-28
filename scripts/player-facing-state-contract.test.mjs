import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTION_OWNERSHIP,
  auditStructuredClaims,
  auditPlayerFacingText,
  buildStageResolvedRolePacket,
  buildStageResolvedState,
  isRevealAllowed,
  normalizeActionOwnership,
  validateRoleNarrativeSource,
} from "../shared/player-facing-state-contract.js";

test("ActionOwnership and StageResolvedState keep player actions contextual", () => {
  const fixed = normalizeActionOwnership({ actionId: "final-lot-sold", ownership: "SYSTEM_FIXED", phaseId: "act1" });
  const player = normalizeActionOwnership({ actionId: "bid", ownership: "PLAYER_CONTROLLED", phaseId: "act1" });
  assert.deepEqual(ACTION_OWNERSHIP, ["SYSTEM_FIXED", "PLAYER_CONTROLLED", "STATE_DERIVED", "CONDITIONAL"]);
  const packet = buildStageResolvedRolePacket({
    packet: { kind: "ROLE_SCRIPT", characterId: "A", stageIds: ["act1"] },
    roleId: "A",
    phaseId: "act1",
    playerState: { resourceOwnership: { "jade-cicada": "A", "bronze-mirror": "D" }, knowledge: { A: ["bid-visible"] } },
    actionOwnership: [fixed, player],
  });
  assert.deepEqual(packet.ownedResources, ["jade-cicada"]);
  assert.equal(packet.playerControlledActions[0].status, "CONTEXT_ONLY");
  assert.equal(packet.playerControlledActions[0].mustNotNarrateAsOccurred, true);
  assert.deepEqual(buildStageResolvedState({ playerState: packet.stageResolvedState, phaseId: "act1", audience: "A" }).ownedResources, ["jade-cicada"]);
});

test("RevealSchedule is audience and phase scoped", () => {
  const entry = { factId: "G_MODIFIED_DOSSIER", audience: "G", fromPhase: "act4" };
  assert.equal(isRevealAllowed(entry, { audience: "G", phaseId: "act1" }), false);
  assert.equal(isRevealAllowed(entry, { audience: "G", phaseId: "act4" }), true);
  assert.equal(isRevealAllowed({ ...entry, audience: "PUBLIC" }, { audience: "A", phaseId: "act4" }), true);
});

test("structured state claims reject ownership and player-action contradictions", () => {
  const result = { sections: [{ stageId: "act2", claims: [
    { type: "RESOURCE_OWNERSHIP", resourceId: "jade-cicada", ownerRoleId: "D", sourceRef: "state:act2" },
    { type: "PLAYER_ACTION", actionId: "bid", occurred: true },
  ] }] };
  const audit = auditStructuredClaims({
    result,
    roleId: "D",
    playerState: { resourceOwnership: { "jade-cicada": "A" } },
    actionOwnership: [{ actionId: "bid", ownership: "PLAYER_CONTROLLED" }],
  });
  assert.deepEqual(audit.issues.map((issue) => issue.code), ["STATE_FACT_CONTRADICTION", "PLAYER_CONTROLLED_ACTION_PREEMPTED"]);
});

test("post-render text audit catches the historical failure classes", () => {
  const audit = auditPlayerFacingText({
    text: "A和D几乎同时抬价。你选择了保持沉默，G留下的错误指向让你相信历史上真正发生过的事不能改变。玉蝉在你袖口里。",
    roleId: "D",
    entityMap: { A: "顾沉舟", B: "林砚秋", C: "沈知微", D: "霍清和", E: "陆闻笙", F: "秦昭", G: "祁衡" },
    playerState: { resourceOwnership: { "jade-cicada": "A" }, resourceNames: { "jade-cicada": "玉蝉" } },
    revealSchedule: { entries: [{ factId: "G_MODIFIED_DOSSIER", audience: "G", fromPhase: "act4", publicPatterns: ["G留下的错误指向"] }] },
  });
  const codes = new Set(audit.issues.map((issue) => issue.code));
  assert.ok(codes.has("INTERNAL_ROLE_ID_LEAK"));
  assert.ok(codes.has("PLAYER_CONTROLLED_ACTION_PREEMPTED"));
  assert.ok(codes.has("STATE_FACT_CONTRADICTION"));
  assert.ok(codes.has("REVEAL_TIMING_VIOLATION"));
});

test("RoleNarrativeSource has a positive upstream supply contract", () => {
  const sparse = validateRoleNarrativeSource({ whyHere: "今晚有事", personalStake: ["名声"], biasOrMisbelief: ["误判"] });
  assert.equal(sparse.ok, false);
  const rich = validateRoleNarrativeSource({
    preGameHistoryEvents: ["h1", "h2", "h3"],
    relationshipEdges: ["r1", "r2", "r3"],
    privateSecrets: ["s1", "s2"],
    biasOrMisbelief: ["b1"],
    personalStake: ["stake"],
    whyHere: "有一个明确的来由",
    openingKnowledge: ["k1"],
  });
  assert.equal(rich.ok, true);
});

test("post-render text audit catches direct player action narration", () => {
  const audit = auditPlayerFacingText({
    roleId: "A",
    stageId: "act1",
    text: "玉蝉上台时你举牌，随后你加价。",
    playerState: { resourceOwnership: { "jade-cicada": null }, resourceNames: { "jade-cicada": "玉蝉" } },
  });
  assert.ok(audit.issues.some((issue) => issue.code === "PLAYER_CONTROLLED_ACTION_PREEMPTED"));
});
