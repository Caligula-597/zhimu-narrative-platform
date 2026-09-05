/**
 * P9.3 Real Writer V1 tests — mock LLM (no network), packet-bound literary output.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import {
  buildProjectStoryStateFromFixture,
  listCaseFixturePaths,
  loadCaseFixture,
} from "../shared/p8-generalization-runner.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";
import { buildProjectContextProfile } from "../shared/project-context-profile.js";
import { buildGen05GameNarrativePlan, buildGen05ContextProfile } from "../shared/game-narrative-gen05-fixture.js";
import { MockScriptWriterLlm } from "../shared/script-writer-llm-port.js";
import { RealScriptWriter } from "../shared/real-script-writer.js";
import { DeterministicTestScriptWriter } from "../shared/deterministic-test-script-writer.js";
import {
  approveCompleteScriptPackage,
  markWriterSectionsStale,
  regenerateScriptProductionJob,
  runScriptProduction,
} from "../shared/script-production-orchestrator.js";
import { buildScriptProductionPacketSet } from "../shared/script-production-packets.js";
import { enrichPacketSetWithNarrativeContext } from "../shared/script-writer-packet-enrichment.js";
import { getWriterProfile } from "../shared/script-writer-profiles.js";
import {
  createFailThenRepairHandler,
  literaryMockFromMessages,
  safetyTrapNoInventCulprit,
} from "../shared/script-writer-mock-handlers.js";
import { PACKET_KINDS } from "../shared/script-writer-result-contracts.js";

const FIXED = () => "2026-09-05T21:00:00.000Z";

function loadGenPmd(caseId) {
  const file = listCaseFixturePaths().find((p) => path.basename(p).startsWith(caseId));
  assert.ok(file, `missing fixture ${caseId}`);
  const fixture = loadCaseFixture(file);
  let state = buildProjectStoryStateFromFixture(fixture);
  state = integrateMasterOutline(state, { now: FIXED });
  return {
    fixture,
    pmd: expandProductionMasterDraft(state, {
      now: FIXED,
      title: `${fixture.caseId} ${fixture.title}`,
    }),
  };
}

function packageText(pkg) {
  const chunks = [];
  for (const s of pkg.hostScript?.sections || []) chunks.push(...(s.paragraphs || []));
  for (const list of Object.values(pkg.roleScripts || {})) {
    for (const s of list) chunks.push(...(s.paragraphs || []));
  }
  for (const s of pkg.publicScripts || []) chunks.push(...(s.paragraphs || []));
  for (const c of pkg.clues || []) chunks.push(...(c.paragraphs || []));
  for (const s of pkg.endingContent?.sections || []) chunks.push(...(s.paragraphs || []));
  return chunks.join("\n");
}

describe("P9.3 Writer profiles + port", () => {
  it("has five separated profiles with versions", () => {
    for (const kind of PACKET_KINDS) {
      const p = getWriterProfile(kind);
      assert.ok(p?.id);
      assert.ok(p.promptVersion.includes("V1"));
      assert.equal(p.constraints.mayAddCharacters, false);
    }
  });

  it("RealScriptWriter recovers once via FORMAT_REPAIR", async () => {
    const llm = new MockScriptWriterLlm({ handler: createFailThenRepairHandler() });
    const writer = new RealScriptWriter({ llm, now: FIXED });
    const packet = {
      kind: "PUBLIC_STAGE",
      stageId: "act1",
      title: "一",
      playerVisibleSummary: "大厅安静。",
      publicLines: ["灯亮了。"],
      stageIds: ["act1"],
      allowedSourceBeatIds: ["b1"],
      allowedClueIds: [],
      allowedFactIds: [],
      forbiddenFactIds: [],
      allowedKnowledgeLabels: ["大厅"],
    };
    const result = await writer.write({
      requestId: "req-repair",
      packetKind: "PUBLIC_STAGE",
      packet,
    });
    assert.ok(result.sections.length >= 1);
    assert.equal(result.writerRunMetadata.formatRepairUsed, true);
    assert.equal(result.writerRunMetadata.attemptCount, 2);
    assert.ok(result.writerRunMetadata.inputFingerprint);
    assert.ok(result.writerRunMetadata.outputFingerprint);
  });
});

describe("P9.3 Deterministic regression still green", () => {
  it("TestWriter production path unchanged for GEN-01", async () => {
    const { pmd } = loadGenPmd("GEN-01");
    const production = await runScriptProduction({
      pmd,
      writer: new DeterministicTestScriptWriter(),
      projectId: "p93-det",
      now: FIXED,
    });
    assert.ok(production.sectionStates.every((s) => s.status === "GENERATED" || s.status === "REVIEW_REQUIRED"));
    assert.equal(production.package.status, "READY_FOR_REVIEW");
    const approved = approveCompleteScriptPackage(production.package, production.validation, {
      sectionStates: production.sectionStates,
    });
    assert.equal(approved.ok, true);
  });
});

describe("P9.3 Controlled Real Writer fixtures", () => {
  it("GEN-03 keeps station nouns in rendered package", async () => {
    const { pmd } = loadGenPmd("GEN-03");
    const contextProfile = buildProjectContextProfile({
      creationSpec: { setting: { era: "SCI_FI" }, genreTags: ["科幻", "身份权限"] },
      premise: { era: "近未来空间站" },
      preferredPresetId: "SCI_FI_FACILITY",
    });
    const llm = new MockScriptWriterLlm({ handler: literaryMockFromMessages });
    const writer = new RealScriptWriter({
      llm,
      now: FIXED,
      contextRevision: contextProfile.revision,
    });
    const production = await runScriptProduction({
      pmd,
      writer,
      projectId: "p93-gen03",
      now: FIXED,
      contextProfile,
    });
    assert.notEqual(production.gate.status, "BLOCKED");
    assert.ok(production.packetSet.host.contextLexicon.some((x) => /舰员|终端|舱段/.test(x)));
    const blob = packageText(production.package);
    assert.ok(/舰员身份认证日志|权限档案终端|三级舱段授权|反应堆/.test(blob), blob.slice(0, 400));
    assert.equal(production.package.status, "READY_FOR_REVIEW");
    assert.notEqual(production.package.status, "READY_TO_COMPILE");
  });

  it("GEN-05 GAME why/stake/outcome render on READY carrier + GameNarrativePlan", async () => {
    // GEN-05 structural gate may BLOCK on OWNER_UNRESOLVED; Writer V1 renders on READY PMD carrier.
    const { pmd } = loadGenPmd("GEN-03");
    const contextProfile = buildGen05ContextProfile();
    const gameNarrativePlan = buildGen05GameNarrativePlan({ contextProfile });
    // Remap binding stages onto carrier stage ids if needed
    const stageIds = (pmd.stages || []).map((s) => s.stageId);
    gameNarrativePlan.bindings = gameNarrativePlan.bindings.map((b, i) => ({
      ...b,
      stageId: stageIds[Math.min(i + 1, stageIds.length - 1)] || b.stageId,
    }));
    const llm = new MockScriptWriterLlm({ handler: literaryMockFromMessages });
    const writer = new RealScriptWriter({
      llm,
      now: FIXED,
      contextRevision: contextProfile.revision,
      gameNarrativeRevision: gameNarrativePlan.revision,
    });
    const production = await runScriptProduction({
      pmd,
      writer,
      projectId: "p93-gen05",
      now: FIXED,
      contextProfile,
      gameNarrativePlan,
    });
    assert.notEqual(production.gate.status, "BLOCKED");
    const hostBlob = (production.package.hostScript?.sections || [])
      .flatMap((s) => s.paragraphs)
      .join("\n");
    const publicBlob = (production.package.publicScripts || [])
      .flatMap((s) => s.paragraphs)
      .join("\n");
    assert.ok(/加密拍品目录|关键证物/.test(hostBlob + publicBlob), hostBlob.slice(0, 500));
    assert.ok(/winnerCount=1|最高价者/.test(hostBlob + publicBlob));
    assert.ok(/不改写|不等于自动改写/.test(packageText(production.package)));
  });

  it("GEN-06 explicit letters appear in rendered role/clue text", async () => {
    const { pmd } = loadGenPmd("GEN-03");
    const contextProfile = buildProjectContextProfile({
      creationSpec: { setting: { era: "CONTEMPORARY" }, genreTags: ["现实", "双线"] },
      premise: { era: "当代家庭聚会" },
      preferredPresetId: "CONTEMPORARY_URBAN",
      explicitBindings: {
        identityRecord: { label: "两封没有寄出的信", kind: "RECORD" },
        centralDocument: { label: "两封没有寄出的信", kind: "RECORD" },
      },
    });
    const llm = new MockScriptWriterLlm({ handler: literaryMockFromMessages });
    const writer = new RealScriptWriter({
      llm,
      now: FIXED,
      contextRevision: contextProfile.revision,
    });
    const production = await runScriptProduction({
      pmd,
      writer,
      projectId: "p93-gen06",
      now: FIXED,
      contextProfile,
    });
    assert.notEqual(production.gate.status, "BLOCKED");
    const blob = packageText(production.package);
    assert.ok(blob.includes("两封没有寄出的信"), blob.slice(0, 500));
  });
});

describe("P9.3 safety + lifecycle", () => {
  it("does not invent culprit when materials insufficient", async () => {
    const { pmd } = loadGenPmd("GEN-01");
    const llm = new MockScriptWriterLlm({ handler: safetyTrapNoInventCulprit });
    const writer = new RealScriptWriter({ llm, now: FIXED });
    const production = await runScriptProduction({
      pmd,
      writer,
      projectId: "p93-safe",
      now: FIXED,
    });
    for (const st of production.sectionStates) {
      assert.equal(asArraySafe(st.result.proposedCanonicalChanges).length, 0);
      assert.ok(
        (st.result.sections || []).every((s) => !(s.inventedCharacterIds || []).length),
      );
    }
    const blob = packageText(production.package);
    assert.ok(/不足以判定真凶|不得自行选定/.test(blob));
  });

  it("M03 runtimeTruth cannot be rewritten to multi-winner in public packet enrichment", () => {
    const { pmd } = loadGenPmd("GEN-05");
    const contextProfile = buildGen05ContextProfile();
    const gameNarrativePlan = buildGen05GameNarrativePlan({ contextProfile });
    const base = buildScriptProductionPacketSet(pmd);
    const enriched = enrichPacketSetWithNarrativeContext(base, {
      contextProfile,
      gameNarrativePlan,
    });
    const m03 = (enriched.host.gameNarrative || []).filter((g) => g.familyId === "M03");
    assert.ok(m03.length >= 1);
    for (const g of m03) {
      assert.equal(g.runtimeTruth.winnerCount, 1);
      assert.equal(g.runtimeTruth.resolution, "HIGHEST_BID");
    }
  });

  it("upstream fingerprint change marks sections STALE; regenerateJob works", async () => {
    const { pmd } = loadGenPmd("GEN-01");
    const ctx1 = buildProjectContextProfile({
      preferredPresetId: "CONTEMPORARY_URBAN",
    });
    const llm = new MockScriptWriterLlm({ handler: literaryMockFromMessages });
    const writer = new RealScriptWriter({
      llm,
      now: FIXED,
      contextRevision: ctx1.revision,
    });
    let production = await runScriptProduction({
      pmd,
      writer,
      projectId: "p93-stale",
      now: FIXED,
      contextProfile: ctx1,
    });
    assert.ok(production.sectionStates.some((s) => s.status === "GENERATED"));

    const ctx2 = buildProjectContextProfile({
      preferredPresetId: "SCI_FI_FACILITY",
      previous: ctx1,
    });
    const stale = markWriterSectionsStale({
      sectionStates: production.sectionStates,
      packetSet: enrichPacketSetWithNarrativeContext(production.packetSet, {
        contextProfile: ctx2,
      }),
      contextRevision: ctx2.revision,
      gameNarrativeRevision: null,
    });
    assert.ok(stale.some((s) => s.status === "STALE"));

    const roleKey = production.sectionStates.find((s) => s.packetKind === "ROLE_SCRIPT")?.sectionId;
    assert.ok(roleKey);
    production = await regenerateScriptProductionJob({
      production,
      jobKey: roleKey,
      writer,
      contextProfile: ctx1,
    });
    const regen = production.sectionStates.find((s) => s.sectionId === roleKey);
    assert.equal(regen.writerRunMetadata.regeneration, true);
    assert.equal(production.package.status, "READY_FOR_REVIEW");
  });
});

function asArraySafe(v) {
  return Array.isArray(v) ? v : [];
}
