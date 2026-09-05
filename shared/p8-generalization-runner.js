/**
 * P8.0B Multi-Script Generalization — fixture → Integrator → PMD V2 → Machine Gates.
 * Does not change production Expander / Integrator logic.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStoryState } from "./story-mechanism-contracts.js";
import {
  acceptStoryBlock,
  editStorySlot,
  generateStoryMechanism,
} from "./story-mechanism-engine.js";
import { integrateMasterOutline } from "./master-outline-integrator.js";
import { expandProductionMasterDraft } from "./production-master-draft-expander.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const P8_CASES_DIR = path.join(__dirname, "p8-generalization-cases");
export const P8_CAPTURES_DIR = path.resolve(__dirname, "../captures/p8-generalization");
export const FIXED_NOW = () => "2026-09-05T00:00:00.000Z";

export const GEN_CASE_IDS = Object.freeze([
  "GEN-01",
  "GEN-02",
  "GEN-03",
  "GEN-04",
  "GEN-05",
  "GEN-06",
  "GEN-07",
  "GEN-08",
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function gate(id, pass, message, details = {}) {
  return { id, pass: Boolean(pass), message: String(message || ""), details };
}

export function listCaseFixturePaths() {
  return GEN_CASE_IDS.map((id) => {
    const files = fs.readdirSync(P8_CASES_DIR).filter((f) => f.startsWith(`${id}-`) && f.endsWith(".json"));
    if (!files.length) throw new Error(`Missing fixture for ${id} in ${P8_CASES_DIR}`);
    if (files.length > 1) throw new Error(`Multiple fixtures for ${id}: ${files.join(", ")}`);
    return path.join(P8_CASES_DIR, files[0]);
  });
}

export function loadCaseFixture(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const src = record(raw);
  if (!src.caseId || !src.title) throw new Error(`Invalid fixture: ${filePath}`);
  if (Number(src.schemaVersion) !== 1) throw new Error(`Unsupported schemaVersion in ${filePath}`);
  return src;
}

export function loadAllCaseFixtures() {
  return listCaseFixturePaths().map((p) => ({ path: p, fixture: loadCaseFixture(p) }));
}

function buildStages(fixture) {
  const n = Math.max(1, Math.trunc(Number(fixture.projectConfig?.stageCount) || fixture.stages?.length || 3));
  if (Array.isArray(fixture.stages) && fixture.stages.length === n) {
    return fixture.stages.map((s, i) => ({
      id: String(s.id || `act${i + 1}`),
      label: String(s.label || `第${i + 1}幕`),
      order: Number.isFinite(Number(s.order)) ? Number(s.order) : i,
    }));
  }
  return Array.from({ length: n }, (_, i) => ({
    id: `act${i + 1}`,
    label: i === n - 1 && n >= 4 ? "终局" : `第${i + 1}幕`,
    order: i,
  }));
}

function buildBaseState(fixture) {
  const playerCount = Math.max(1, Math.trunc(Number(fixture.projectConfig?.playerCount) || 6));
  const characters = (fixture.characters || []).map((c) => ({
    id: String(c.id),
    name: String(c.name || c.id),
    isNpc: Boolean(c.isNpc),
  }));
  const players = characters.filter((c) => !c.isNpc);
  if (players.length !== playerCount) {
    throw new Error(
      `${fixture.caseId}: characters players=${players.length} != playerCount=${playerCount}`,
    );
  }
  return createProjectStoryState({
    projectId: `p8-${fixture.caseId.toLowerCase()}`,
    premise: {
      genre: fixture.premise?.genre || fixture.projectConfig?.genreTags?.[0] || "未标注",
      era: fixture.premise?.era || "",
      tone: fixture.premise?.tone || fixture.projectConfig?.genreTags || [],
      playerCount,
      targetDuration: fixture.premise?.targetDuration,
    },
    characters,
    stages: buildStages(fixture),
    mechanismBlocks: [],
    revision: 0,
    updatedAt: null,
  });
}

function acceptLast(state, templateId) {
  const block = [...state.mechanismBlocks].reverse().find((b) => b.templateId === templateId);
  if (!block) throw new Error(`No block generated for ${templateId}`);
  return acceptStoryBlock(state, block.id);
}

function applyStoryPlan(state, fixture) {
  let next = state;
  for (const step of fixture.storyPlan || []) {
    next = generateStoryMechanism({
      templateId: step.templateId,
      projectStoryState: next,
      preferredVariantId: step.preferredVariantId,
      intentionalOverlap: Boolean(step.intentionalOverlap),
      plotOverrides: step.plotOverrides || {},
    });
    next = acceptLast(next, step.templateId);
  }
  return next;
}

function applyOverlapForce(state, fixture) {
  const force = fixture.overlapForce;
  if (!force?.leaderCharacterFrom || !Array.isArray(force.applyTo)) return state;
  const srcBlock = state.mechanismBlocks.find(
    (b) => b.templateId === force.leaderCharacterFrom.templateId,
  );
  const roleKey = force.leaderCharacterFrom.roleKey;
  const leader = srcBlock?.roleBindings?.[roleKey];
  if (!leader?.id) return state;
  let next = state;
  for (const target of force.applyTo) {
    const block = next.mechanismBlocks.find((b) => b.templateId === target.templateId);
    if (!block) continue;
    try {
      next = editStorySlot(next, block.id, target.slotId, leader);
    } catch {
      // Slot may not exist on variant — leave for Machine Gate / Editorial to observe.
    }
  }
  return next;
}

export function buildProjectStoryStateFromFixture(fixture) {
  let state = buildBaseState(fixture);
  state = applyStoryPlan(state, fixture);
  state = applyOverlapForce(state, fixture);
  return state;
}

function playerCharacters(state) {
  return (state.characters || []).filter((c) => !c.isNpc);
}

function evaluateG1(fixture, state, outline, draft) {
  const exp = record(fixture.expectedStructuralProperties);
  const wantPlayers = Number(exp.playerCount ?? fixture.projectConfig.playerCount);
  const wantStages = Number(exp.stageCount ?? fixture.projectConfig.stageCount);
  const players = playerCharacters(state);
  const checks = [];

  checks.push(
    gate(
      "G1.playerCount",
      players.length === wantPlayers && state.premise.playerCount === wantPlayers,
      `premise/players=${state.premise.playerCount}/${players.length}, want=${wantPlayers}`,
      { players: players.map((p) => p.id) },
    ),
  );

  const draftStages = draft?.stages?.length ?? 0;
  const outlineStages = outline?.stages?.length ?? 0;
  const emptyOk = exp.allowEmptyFinalStage === true;
  const stagePass = emptyOk
    ? draftStages >= Math.max(1, wantStages - 1)
    : draftStages === wantStages && outlineStages === wantStages;
  checks.push(
    gate(
      "G1.stageCount",
      stagePass,
      `outline=${outlineStages} draft=${draftStages} want=${wantStages}`,
      { outlineStageIds: (outline?.stages || []).map((s) => s.id), draftStageIds: (draft?.stages || []).map((s) => s.stageId || s.id) },
    ),
  );

  if (exp.forbidAutoPadSixthPlayer) {
    const viewChars = draft?.characterViews?.characters || [];
    const invented = viewChars.filter(
      (c) => {
        const id = c.characterId || c.id;
        return id && !state.characters.some((s) => s.id === id);
      },
    );
    checks.push(
      gate(
        "G1.noPadPlayers",
        invented.length === 0 && players.length === wantPlayers,
        invented.length
          ? `invented character ids: ${invented.map((c) => c.characterId || c.id).join(",")}`
          : "no padded players",
        { invented: invented.map((c) => c.characterId || c.id) },
      ),
    );
  }

  const stageIds = new Set((state.stages || []).map((s) => s.id));
  const draftIds = (draft?.stages || []).map((s) => s.stageId || s.id);
  checks.push(
    gate(
      "G1.stageIdsFromProject",
      draftIds.every((id) => stageIds.has(id)) || draftIds.length === 0,
      "draft stage ids should come from project stages (or empty on hard fail)",
      { draftIds: [...draftIds], projectIds: [...stageIds] },
    ),
  );

  // 3-act semantic: final stage must be PAYOFF-class, not leftover ESCALATION from 4-band map
  if (wantStages === 3 && (draft?.stages || []).length === 3) {
    const last = [...draft.stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).at(-1);
    const role = String(last?.stageRole || "");
    const ok = role === "PAYOFF" || role === "RESOLUTION" || /收束|终局|结算/.test(String(last?.title || ""));
    checks.push(
      gate(
        "G1.finalStagePayoffSemantics",
        ok,
        `3-act final stageRole=${role || "?"} title=${last?.title || "?"} (must be PAYOFF-class, not ESCALATION)`,
        { stageId: last?.stageId, stageRole: role },
      ),
    );
  }

  return checks;
}

function evaluateG2(fixture, state, outline, draft) {
  const exp = record(fixture.expectedStructuralProperties);
  const checks = [];
  const links = outline?.weaveLinks || [];
  const interwoven = links.filter((l) => l.relationQuality === "INTERWOVEN" && l.status !== "SPLIT");
  const keepParallel = links.filter((l) => l.kind === "KEEP_PARALLEL");

  if (exp.requireKeepParallel) {
    checks.push(
      gate(
        "G2.keepParallel",
        keepParallel.length > 0,
        `KEEP_PARALLEL count=${keepParallel.length}`,
        { keepParallel: keepParallel.length, interwoven: interwoven.length },
      ),
    );
  }

  if (exp.maxInterwoven != null) {
    checks.push(
      gate(
        "G2.maxInterwoven",
        interwoven.length <= Number(exp.maxInterwoven),
        `INTERWOVEN=${interwoven.length} max=${exp.maxInterwoven}`,
        { interwoven: interwoven.length },
      ),
    );
  }

  const forgedProse = (draft?.stages || [])
    .flatMap((s) => s.beats || [])
    .filter((b) => b.relationQuality === "INTERWOVEN");
  if (exp.maxInterwoven === 0) {
    checks.push(
      gate(
        "G2.noForgedInterwovenProse",
        forgedProse.length === 0 && interwoven.length === 0,
        `prose INTERWOVEN=${forgedProse.length} outline=${interwoven.length}`,
      ),
    );
  }

  const clues = draft?.clueView?.clues || [];
  const dupIds = clues.map((c) => c.clueId).filter(Boolean);
  const unique = new Set(dupIds);
  checks.push(
    gate(
      "G2.clueLifecycleIds",
      dupIds.length === unique.size,
      `clue rows=${dupIds.length} uniqueIds=${unique.size}`,
    ),
  );

  const truths = (draft?.stages || []).flatMap((s) => s.beats || []).flatMap((b) => b.truthItems || b.hostTruthFlags || []);
  // Truth flags presence is soft when expander uses hostTruth string; check misleading consistency on clues
  const misleadingBad = clues.filter(
    (c) =>
      (String(c.label || "").includes("误导") || String(c.summary || "").includes("误导")) &&
      c.isMisleading === false,
  );
  checks.push(
    gate("G2.misleadingConsistency", misleadingBad.length === 0, `misleading mismatches=${misleadingBad.length}`),
  );

  let complexId = exp.complexCharacterId;
  if (!complexId && fixture.overlapForce?.leaderCharacterFrom) {
    const src = (state.mechanismBlocks || []).find(
      (b) => b.templateId === fixture.overlapForce.leaderCharacterFrom.templateId,
    );
    complexId = src?.roleBindings?.[fixture.overlapForce.leaderCharacterFrom.roleKey]?.id || null;
  }
  const roles = exp.requireContributionRoles;
  if (complexId && Array.isArray(roles) && roles.length) {
    const ch = (draft?.characterViews?.characters || []).find(
      (c) => (c.characterId || c.id) === complexId,
    );
    // PMD V2 nests contributions under stages[] — do not read top-level .contributions
    const contrib = (ch?.stages || []).flatMap((s) => s.contributions || []);
    const have = new Set(contrib.map((c) => c.roleInBeat));
    const missing = roles.filter((r) => !have.has(r));
    checks.push(
      gate(
        "G2.complexContributionRoles",
        missing.length === 0,
        missing.length
          ? `missing roles: ${missing.join(",")} (contributions=${contrib.length})`
          : `has ${roles.join(",")} across ${contrib.length} contributions`,
        { characterId: complexId, contributions: contrib.length, have: [...have] },
      ),
    );
    checks.push(
      gate(
        "G2.noTargetGoalAsOwner",
        !contrib.some((c) => c.roleInBeat === "TARGET" && c.goal && /自己|真凶/.test(String(c.goal))),
        "TARGET should not inherit self-culprit style goals",
      ),
    );
  }

  checks.push(
    gate(
      "G2.pipelineProducedDraft",
      Boolean(draft?.stages?.length),
      draft?.stages?.length ? "draft present" : "draft missing",
    ),
  );

  return checks;
}

function evaluateG3(fixture, state, draft) {
  const pe = record(fixture.playableExpectation);
  const checks = [];
  const players = playerCharacters(state);
  const placements = pe.gamePlacements || fixture.gamePlan || [];

  checks.push(
    gate(
      "G3.structuralRoleCount",
      players.length === Number(fixture.projectConfig.playerCount),
      `player roles available for playable adapt=${players.length}`,
    ),
  );

  checks.push(
    gate(
      "G3.stagesPresent",
      (draft?.stages || []).length > 0,
      `draft stages=${draft?.stages?.length || 0} (complete scripts not required in P8.0)`,
    ),
  );

  if (pe.requireCulprit === false) {
    const killers = state.assignments?.killerCharacterIds || [];
    const hasM01 = (state.mechanismBlocks || []).some((b) => String(b.templateId).startsWith("M01"));
    // Without M01, system must not invent killer assignments as a hard requirement for draft validity
    checks.push(
      gate(
        "G3.noForcedCulprit",
        hasM01 || killers.length === 0 || pe.allowOptionalKillerAssignments === true,
        hasM01
          ? "M01 present — culprit allowed"
          : `no M01; killerAssignments=${killers.length}`,
        { killers, hasM01 },
      ),
    );
    checks.push(
      gate(
        "G3.draftValidWithoutCulpritField",
        Boolean(draft),
        "PMD must exist without correctCulpritRoleId / CompleteScriptPackage",
      ),
    );
  }

  const candidates = draft?.executionView?.candidateGameInsertionPoints || [];
  const draftStageIds = new Set((draft?.stages || []).map((s) => s.stageId || s.id));
  const orphanPlacements = placements.filter((p) => p.stageId && !draftStageIds.has(p.stageId));

  checks.push(
    gate(
      "G3.gameStageReferenceIntegrity",
      orphanPlacements.length === 0,
      orphanPlacements.length
        ? `GAME placement stageId not in draft stages: ${orphanPlacements.map((p) => `${p.familyId||p.templateId}@${p.stageId}`).join(", ")}`
        : "all gamePlan stageIds ⊆ draft stageIds",
      { orphanPlacements, draftStageIds: [...draftStageIds] },
    ),
  );

  if (placements.length) {
    // Declared intent for downstream CompleteScript / Bridge — informational only.
    checks.push(
      gate(
        "G3.gamePlanDeclared",
        true,
        `declared placements=${placements.length}; PMD candidates=${candidates.length} (informational)`,
        { placements, candidateCount: candidates.length },
      ),
    );
  } else {
    checks.push(
      gate(
        "G3.noGameStillHasExecutionView",
        Boolean(draft?.executionView),
        draft?.executionView ? "execution view present without GAME plan" : "missing execution view",
      ),
    );
  }

  checks.push(
    gate(
      "G3.noCompleteScriptRequired",
      pe.allowMissingCompleteScripts !== false,
      "P8.0 playable compatibility is structural only",
    ),
  );

  return checks;
}

function classifyFailure(g1, g2, g3, pipelineError) {
  if (pipelineError) {
    const msg = String(pipelineError.message || pipelineError);
    if (/UNKNOWN|NO_BLOCKS|EXPAND_NO|OUTLINE_NO/.test(pipelineError.code || "") || /装不下|hardcoded|playerCount/.test(msg)) {
      return "CONTRACT_FAILURE";
    }
    return "GENERATION_FAILURE";
  }
  const failed = [...g1, ...g2, ...g3].filter((g) => !g.pass);
  if (!failed.length) return null;
  if (
    failed.some(
      (g) =>
        g.id.startsWith("G1.") ||
        g.id === "G3.gameStageReferenceIntegrity" ||
        g.id === "G2.complexContributionRoles",
    )
  ) {
    return "CONTRACT_FAILURE";
  }
  if (failed.some((g) => g.id.startsWith("G2.") || g.id.startsWith("G3."))) return "GENERATION_FAILURE";
  return "GENERATION_FAILURE";
}

/**
 * Run one GEN case. Never throws for case-level failures — returns report.
 */
export function auditOneCase(fixture, { now = FIXED_NOW, writeCaptures = false } = {}) {
  const report = {
    caseId: fixture.caseId,
    title: fixture.title,
    schemaVersion: fixture.schemaVersion,
    projectConfig: fixture.projectConfig,
    pipelineOk: false,
    pipelineError: null,
    gates: { G1: [], G2: [], G3: [] },
    gatePass: { G1: false, G2: false, G3: false, all: false },
    failureClass: null,
    editorialStatus: "PENDING",
    counts: {},
  };

  let state = null;
  let outline = null;
  let draft = null;

  try {
    state = buildProjectStoryStateFromFixture(fixture);
    state = integrateMasterOutline(state, { now });
    outline = state.masterOutlineDraft;
    draft = expandProductionMasterDraft(state, {
      now,
      title: `${fixture.caseId} ${fixture.title}`,
    });
    report.pipelineOk = true;
  } catch (err) {
    report.pipelineError = {
      name: err?.name || "Error",
      code: err?.code || null,
      message: err?.message || String(err),
    };
  }

  if (state && outline && draft) {
    report.gates.G1 = evaluateG1(fixture, state, outline, draft);
    report.gates.G2 = evaluateG2(fixture, state, outline, draft);
    report.gates.G3 = evaluateG3(fixture, state, draft);
    report.counts = {
      players: playerCharacters(state).length,
      stagesProject: state.stages.length,
      stagesOutline: outline.stages?.length || 0,
      stagesDraft: draft.stages?.length || 0,
      acceptedBlocks: state.mechanismBlocks.filter((b) =>
        ["USER_ACCEPTED", "USER_MODIFIED", "LOCKED"].includes(b.status),
      ).length,
      weaveLinks: outline.weaveLinks?.length || 0,
      interwoven: (outline.weaveLinks || []).filter((l) => l.relationQuality === "INTERWOVEN").length,
      keepParallel: (outline.weaveLinks || []).filter((l) => l.kind === "KEEP_PARALLEL").length,
      clues: draft.clueView?.clues?.length || 0,
      warnings: draft.warnings?.length || 0,
      gameCandidates: draft.executionView?.candidateGameInsertionPoints?.length || 0,
    };
  } else if (state) {
    report.gates.G1 = [
      gate("G1.pipeline", false, report.pipelineError?.message || "pipeline failed before draft"),
    ];
    report.gates.G2 = [gate("G2.pipeline", false, "skipped")];
    report.gates.G3 = [gate("G3.pipeline", false, "skipped")];
  } else {
    report.gates.G1 = [gate("G1.pipeline", false, report.pipelineError?.message || "build failed")];
    report.gates.G2 = [gate("G2.pipeline", false, "skipped")];
    report.gates.G3 = [gate("G3.pipeline", false, "skipped")];
  }

  report.gatePass.G1 = report.gates.G1.every((g) => g.pass);
  report.gatePass.G2 = report.gates.G2.every((g) => g.pass);
  report.gatePass.G3 = report.gates.G3.every((g) => g.pass);
  report.gatePass.all = report.pipelineOk && report.gatePass.G1 && report.gatePass.G2 && report.gatePass.G3;
  report.failureClass = report.gatePass.all
    ? null
    : classifyFailure(report.gates.G1, report.gates.G2, report.gates.G3, report.pipelineError);

  if (writeCaptures) {
    const dir = path.join(P8_CAPTURES_DIR, fixture.caseId);
    fs.mkdirSync(dir, { recursive: true });
    if (outline) {
      fs.writeFileSync(path.join(dir, "master-outline.json"), JSON.stringify(outline, null, 2), "utf8");
    }
    if (draft) {
      fs.writeFileSync(
        path.join(dir, "production-master-draft.json"),
        JSON.stringify(draft, null, 2),
        "utf8",
      );
    }
    // Structural playable compatibility stub — not CompleteScriptPackage
    const playableCompat = {
      caseId: fixture.caseId,
      note: "P8.0 structural compatibility only; no CompleteScriptPackage / role prose",
      playerRoleIds: state ? playerCharacters(state).map((c) => c.id) : [],
      stageIds: draft?.stages?.map((s) => s.stageId || s.id) || [],
      requireCulprit: fixture.playableExpectation?.requireCulprit ?? null,
      gamePlan: fixture.gamePlan || [],
      candidateGameInsertionPoints: draft?.executionView?.candidateGameInsertionPoints || [],
      compatible: report.gatePass.G3,
    };
    fs.writeFileSync(path.join(dir, "playable-project.json"), JSON.stringify(playableCompat, null, 2), "utf8");
    fs.writeFileSync(path.join(dir, "machine-report.json"), JSON.stringify(report, null, 2), "utf8");
  }

  return { report, state, outline, draft };
}

export function auditAllCases(options = {}) {
  const rows = loadAllCaseFixtures();
  const results = rows.map(({ fixture }) => auditOneCase(fixture, options));
  return {
    generatedAt: new Date().toISOString(),
    corpus: "P8.0B GEN-01..GEN-08",
    results: results.map((r) => r.report),
  };
}
