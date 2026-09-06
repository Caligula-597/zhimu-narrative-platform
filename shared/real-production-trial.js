/**
 * Real Production Trial runner — product-path only.
 * Author confirmations allowed; developer firefighting forbidden.
 */

import fs from "node:fs";
import path from "node:path";
import { normalizePlayableCreationSpec } from "./playable-creation-spec.js";
import { buildCreationConstraintEnvelope } from "./creation-constraint-envelope.js";
import { buildStoryCandidatePlan } from "./creation-candidate-planner.js";
import { applyCreationSpecUpdate } from "./creation-spec-compatibility.js";
import { createProjectStoryState } from "./story-mechanism-contracts.js";
import {
  acceptStoryBlock,
  createInitialProjectStoryState,
  generateStoryMechanism,
} from "./story-mechanism-engine.js";
import { listStoryTemplates } from "./story-mechanism-registry.js";
import {
  integrateMasterOutline,
  setConflictDecision,
} from "./master-outline-integrator.js";
import { expandProductionMasterDraft } from "./production-master-draft-expander.js";
import { evaluateScriptProductionReadiness } from "./script-production-gate.js";
import { buildProjectContextProfile } from "./project-context-profile.js";
import { runScriptProduction, approveCompleteScriptPackage } from "./script-production-orchestrator.js";
import { RealScriptWriter } from "./real-script-writer.js";
import { DeterministicTestScriptWriter } from "./deterministic-test-script-writer.js";
import { MockScriptWriterLlm } from "./script-writer-llm-port.js";
import { literaryMockFromMessages } from "./script-writer-mock-handlers.js";
import { DeepseekScriptWriterLlm } from "./deepseek-script-writer-llm.js";
import { evaluateContentQuality } from "./content-quality-gate.js";
import { compileCompleteScriptPackage } from "./complete-script-playable-adapter.js";
import {
  advancePlayableStage,
  assignPlayableRole,
  createPlayableRuntimeState,
  finishPlayableSession,
  startPlayableSession,
} from "./playable-content-runtime.js";
import { assignablePlayerRoles } from "./full-production-coverage.js";

const GALLERY_NAMES = Object.freeze([
  { id: "P1", name: "沈岚", gender: "FEMALE" },
  { id: "P2", name: "梁赫", gender: "MALE" },
  { id: "P3", name: "白绫", gender: "FEMALE" },
  { id: "P4", name: "周祁", gender: "MALE" },
  { id: "P5", name: "顾清", gender: "FEMALE" },
  { id: "P6", name: "方序", gender: "MALE" },
  { id: "P7", name: "唐晚", gender: "FEMALE" },
  { id: "P8", name: "韩洲", gender: "MALE" },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nowIso() {
  return new Date().toISOString();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decisionLog() {
  const rows = [];
  return {
    rows,
    author(action, detail = {}) {
      rows.push({
        at: nowIso(),
        kind: "AUTHOR_CONFIRMATION",
        action,
        ...detail,
      });
    },
    auto(action, detail = {}) {
      rows.push({
        at: nowIso(),
        kind: "SYSTEM_AUTO",
        action,
        ...detail,
      });
    },
    firefight(action, detail = {}) {
      rows.push({
        at: nowIso(),
        kind: "DEVELOPER_FIREFIGHT",
        action,
        ...detail,
      });
    },
    counts() {
      return {
        authorConfirmations: rows.filter((r) => r.kind === "AUTHOR_CONFIRMATION").length,
        systemAuto: rows.filter((r) => r.kind === "SYSTEM_AUTO").length,
        developerFirefighting: rows.filter((r) => r.kind === "DEVELOPER_FIREFIGHT").length,
      };
    },
  };
}

function buildCharactersFromSpec(spec, nameSet) {
  const n = spec.playerCount;
  const pool = nameSet === "CONTEMPORARY_GALLERY" ? GALLERY_NAMES : GALLERY_NAMES;
  return pool.slice(0, n).map((c) => ({ id: c.id, name: c.name, isNpc: false }));
}

function buildStagesFromEnvelope(envelope) {
  const count = Math.max(3, Number(envelope.resolvedStageCount) || 4);
  return Array.from({ length: count }, (_, i) => ({
    id: `act${i + 1}`,
    label: i === count - 1 ? "终幕" : `第${i + 1}幕`,
    order: i,
  }));
}

/**
 * Author policy: accept top distinct-family STORY candidates (product-allowed).
 */
export function selectAuthorStoryAccepts(candidatePlan, policy = {}) {
  const maxFamilies = Math.max(1, Number(policy.acceptTopDistinctFamilies) || 3);
  const selected = [];
  const seenFamily = new Set();
  for (const c of asArray(candidatePlan?.candidates)) {
    const fam = c.familyId || String(c.templateId || "").split("-")[0];
    if (seenFamily.has(fam)) continue;
    seenFamily.add(fam);
    selected.push({
      templateId: c.templateId,
      familyId: fam,
      score: c.score,
      reasons: c.reasons,
      intentionalOverlap: selected.length >= 1 && policy.intentionalOverlapFromSecondBlock !== false,
    });
    if (selected.length >= maxFamilies) break;
  }
  return selected;
}

function exportReadableScripts(pkg) {
  const lines = [];
  lines.push(`# ${pkg.metadata?.title || pkg.id}`);
  lines.push("");
  lines.push("## 主持本");
  for (const s of asArray(pkg.hostScript?.sections)) {
    lines.push(`### ${s.title || s.stageId}`);
    for (const p of asArray(s.paragraphs)) lines.push(p, "");
  }
  lines.push("## 角色本");
  for (const role of asArray(pkg.roles).filter((r) => r.type !== "HOST")) {
    lines.push(`### ${role.name} (${role.id})`);
    for (const s of asArray(pkg.roleScripts?.[role.id])) {
      lines.push(`#### ${s.title || s.stageId}`);
      for (const p of asArray(s.paragraphs)) lines.push(p, "");
    }
  }
  lines.push("## 公共 / 共享");
  for (const s of [...asArray(pkg.publicScripts), ...asArray(pkg.sharedScripts)]) {
    lines.push(`### ${s.title || s.stageId}`);
    for (const p of asArray(s.paragraphs)) lines.push(p, "");
  }
  lines.push("## 线索");
  for (const c of asArray(pkg.clues)) {
    lines.push(`### ${c.title} (${c.id})`);
    for (const p of asArray(c.paragraphs)) lines.push(p, "");
  }
  lines.push("## 终局");
  for (const s of asArray(pkg.endingContent?.sections)) {
    lines.push(`### ${s.title || "ending"}`);
    for (const p of asArray(s.paragraphs)) lines.push(p, "");
  }
  return lines.join("\n");
}

function classifyTrial({ quality, firefighting, productionBlocked, runtimeOk, runtimeSkipped }) {
  // TRIAL_FAIL only for developer firefighting or mid-pipeline production/runtime crash.
  // Quality Gate block + deferred approve is product behavior → PARTIAL, not FAIL.
  if (firefighting > 0 || productionBlocked) return "TRIAL_FAIL";
  if (runtimeOk === false && !runtimeSkipped) return "TRIAL_FAIL";
  const total = Number(quality?.totalScore) || 0;
  const hard = asArray(quality?.hardBlockers).length;
  if (hard === 0 && total >= 75 && (runtimeOk || runtimeSkipped)) return "TRIAL_PASS_CANDIDATE";
  return "TRIAL_PARTIAL";
}

/**
 * @param {{
 *   trialInput: object,
 *   outDir: string,
 *   writerMode?: "real" | "mock" | "deterministic",
 *   now?: () => string,
 * }} opts
 */
export async function runRealProductionTrial(opts) {
  const started = Date.now();
  const trialInput = record(opts.trialInput);
  const outDir = opts.outDir;
  const writerMode = opts.writerMode || "mock";
  const log = decisionLog();
  const artifacts = {};

  fs.mkdirSync(outDir, { recursive: true });
  writeJson(path.join(outDir, "trial-input.json"), trialInput);

  const specCheck = normalizePlayableCreationSpec(trialInput.creationSpec);
  if (!specCheck) {
    log.firefight("invalid_creation_spec");
    throw new Error("invalid_creation_spec");
  }
  const spec = specCheck;
  const envelope = buildCreationConstraintEnvelope(spec);
  log.auto("resolve_stage_count", {
    count: envelope.resolvedStageCount,
    source: envelope.stageCountResolution?.source,
  });

  let state = createInitialProjectStoryState(`rpt1-${trialInput.trialId || "trial"}`);
  const applied = applyCreationSpecUpdate(state, spec);
  if (applied.errors?.length) {
    log.firefight("creation_spec_apply_failed", { errors: applied.errors });
    throw new Error(`creation_spec_apply_failed:${applied.errors[0]?.code}`);
  }
  state = createProjectStoryState({
    ...applied.state,
    premise: {
      genre: asArray(spec.genreTags).join("·") || "当代",
      era: spec.setting?.era || "CONTEMPORARY",
      tone: asArray(spec.genreTags),
      playerCount: spec.playerCount,
      targetDuration: spec.durationMinutes,
    },
    characters: buildCharactersFromSpec(spec, trialInput.authorPolicy?.characterNameSet),
    stages: buildStagesFromEnvelope(envelope),
  });
  log.author("set_premise_characters_stages_from_creation_spec", {
    playerCount: spec.playerCount,
    stages: state.stages.map((s) => s.id),
  });

  const templates = listStoryTemplates();
  const candidatePlan = buildStoryCandidatePlan(spec, templates);
  writeJson(path.join(outDir, "story-candidate-plan.json"), candidatePlan);
  const accepts = selectAuthorStoryAccepts(candidatePlan, trialInput.authorPolicy);
  log.author("accept_recommended_story_blocks", {
    accepts: accepts.map((a) => ({
      templateId: a.templateId,
      intentionalOverlap: a.intentionalOverlap,
      score: a.score,
    })),
  });

  for (const step of accepts) {
    state = generateStoryMechanism({
      templateId: step.templateId,
      projectStoryState: state,
      intentionalOverlap: Boolean(step.intentionalOverlap),
    });
    const block = [...state.mechanismBlocks].reverse().find((b) => b.templateId === step.templateId);
    if (!block) {
      log.firefight("missing_generated_block", { templateId: step.templateId });
      throw new Error(`missing_generated_block:${step.templateId}`);
    }
    state = acceptStoryBlock(state, block.id);
    log.author("accept_story_block", { blockId: block.id, templateId: step.templateId });
  }

  writeJson(path.join(outDir, "story-state.json"), state);

  state = integrateMasterOutline(state, { now: opts.now || nowIso });
  let draft = state.masterOutlineDraft;
  if (trialInput.authorPolicy?.acceptIntentionalOverlapConflicts !== false) {
    for (const c of asArray(draft?.conflictReport)) {
      if (c.decision) continue;
      if (c.type === "INTENTIONAL_OVERLAP_CANDIDATE" || c.type === "ROLE_OVERLOAD") {
        draft = setConflictDecision(draft, c.id, "ACCEPT");
        log.author("accept_conflict_keep", { conflictId: c.id, type: c.type });
      }
    }
  }
  state = createProjectStoryState({ ...state, masterOutlineDraft: draft });
  writeJson(path.join(outDir, "master-outline.json"), state.masterOutlineDraft);

  const pmd = expandProductionMasterDraft(state, {
    now: opts.now || nowIso,
    title: trialInput.title || "完整剧本",
  });
  writeJson(path.join(outDir, "pmd.json"), pmd);
  const gate = evaluateScriptProductionReadiness(pmd);
  writeJson(path.join(outDir, "production-gate.json"), gate);
  log.auto("production_gate", { status: gate.status, blockers: gate.blockers.map((b) => b.type) });

  if (gate.status === "BLOCKED") {
    const summary = {
      trialVerdict: "TRIAL_FAIL",
      reason: "production_gate_blocked",
      gate,
      humanIntervention: log.counts(),
      elapsedMs: Date.now() - started,
    };
    writeJson(path.join(outDir, "trial-summary.json"), summary);
    writeJson(path.join(outDir, "author-decisions.json"), log.rows);
    return { ...summary, outDir, log: log.rows };
  }

  const contextProfile = buildProjectContextProfile({
    creationSpec: {
      setting: { era: spec.setting?.era },
      genreTags: spec.genreTags,
    },
    premise: state.premise,
    explicitBindings: trialInput.authorPolicy?.explicitContextBindings || {},
    preferredPresetId: "CONTEMPORARY_URBAN",
    now: opts.now || nowIso,
  });
  log.author("confirm_context_bindings", {
    presetId: contextProfile.presetId,
    explicitKeys: contextProfile.explicitBindingKeys,
  });
  writeJson(path.join(outDir, "context-profile.json"), contextProfile);

  // GAME: only if author preferred gameplay intents exist — record intent; V1 may skip full plan
  // unless a product placement flow is present. We do NOT invent M03 just to have GAME.
  let gameNarrativePlan = null;
  const preferredGameplay = asArray(spec.gameplayPreferences?.preferred);
  if (
    preferredGameplay.length &&
    trialInput.authorPolicy?.acceptGameplayPlacementIfPreferred &&
    asArray(candidatePlan.gameplayCandidates).length
  ) {
    log.author("acknowledge_gameplay_intent_candidates", {
      intents: preferredGameplay,
      note: "P8.1 gameplay candidates are hints only; Trial #1 does not force M03/M09 placement without product placement UI",
    });
    writeJson(path.join(outDir, "gameplay-intent-candidates.json"), candidatePlan.gameplayCandidates);
  } else {
    log.auto("skip_forced_game_placement", { reason: "no_forced_mechanism" });
  }
  writeJson(path.join(outDir, "game-narrative-plan.json"), gameNarrativePlan);

  let writer;
  let llmMeta = { mode: writerMode };
  if (writerMode === "deterministic") {
    writer = new DeterministicTestScriptWriter();
  } else if (writerMode === "real") {
    const llm = new DeepseekScriptWriterLlm();
    if (!llm.configured) {
      log.firefight("deepseek_not_configured");
      throw new Error("DEEPSEEK_NOT_CONFIGURED");
    }
    writer = new RealScriptWriter({
      llm,
      now: opts.now || nowIso,
      contextRevision: contextProfile.revision,
      gameNarrativeRevision: null,
    });
    llmMeta = { mode: "real", adapterId: llm.adapterId, modelId: llm.modelId };
  } else {
    const llm = new MockScriptWriterLlm({
      handler: literaryMockFromMessages,
      modelId: "mock-literary-rpt1",
      adapterId: "literary-mock-v1",
    });
    writer = new RealScriptWriter({
      llm,
      now: opts.now || nowIso,
      contextRevision: contextProfile.revision,
    });
    llmMeta = { mode: "mock", adapterId: llm.adapterId, modelId: llm.modelId };
  }

  const production = await runScriptProduction({
    pmd,
    writer,
    projectId: state.projectId,
    now: opts.now || nowIso,
    contextProfile,
    gameNarrativePlan,
  });
  writeJson(path.join(outDir, "complete-script-package.json"), production.package);
  writeJson(path.join(outDir, "writer-section-states.json"), production.sectionStates);
  writeJson(
    path.join(outDir, "writer-run-metadata.json"),
    {
      llm: llmMeta,
      sectionMetadata: asArray(production.sectionStates).map((s) => ({
        key: s.key || s.sectionKey,
        status: s.status,
        writerRunMetadata: s.writerRunMetadata || null,
      })),
      modelCalls:
        writerMode === "real" && writer.llm?._calls != null ? writer.llm._calls : undefined,
    },
  );
  log.auto("writer_production_complete", {
    packageStatus: production.package?.status,
    sectionCount: asArray(production.sectionStates).length,
  });

  const quality = await evaluateContentQuality({
    package: production.package,
    now: opts.now || nowIso,
  });
  writeJson(path.join(outDir, "quality-report.json"), quality);
  log.auto("quality_gate", { status: quality.status, totalScore: quality.totalScore });

  fs.writeFileSync(path.join(outDir, "readable-scripts.md"), exportReadableScripts(production.package), "utf8");

  let playable = null;
  let runtimeOk = false;
  let runtimeSkipped = false;
  let runtimeTrace = null;
  try {
    // Author may approve when structural validation is clean (product API).
    let pkgForCompile = production.package;
    let approvedOk = false;
    if (production.validation?.ok) {
      const approved = approveCompleteScriptPackage(production.package, production.validation, {
        sectionStates: production.sectionStates,
      });
      if (approved.ok && approved.package) {
        pkgForCompile = approved.package;
        approvedOk = true;
        log.author("approve_complete_script_package", { status: pkgForCompile.status });
      } else {
        log.auto("approve_deferred", { reason: approved.reason || "not_ok" });
      }
    } else {
      log.auto("approve_skipped_validation_not_ok", {
        errors: asArray(production.validation?.errors).slice(0, 5),
      });
    }

    playable = compileCompleteScriptPackage(pkgForCompile, {
      now: opts.now || nowIso,
    });
    writeJson(path.join(outDir, "playable-project.json"), playable);

    // Runtime smoke is a product path only when Playable is READY.
    // Quality/validation deferral is not developer firefighting.
    if (!approvedOk || String(playable?.status || "") !== "READY") {
      runtimeSkipped = true;
      runtimeTrace = {
        ok: null,
        skipped: true,
        reason: !approvedOk ? "package_not_approved" : `playable_status_${playable?.status || "unknown"}`,
        playableStatus: playable?.status || null,
      };
      log.auto("runtime_smoke_skipped", runtimeTrace);
    } else {
      let runtime = createPlayableRuntimeState({
        playableProject: playable,
        roomId: `room-${state.projectId}`,
        now: opts.now || nowIso,
      });
      const players = assignablePlayerRoles(pkgForCompile);
      for (const role of players.slice(0, Math.min(6, players.length))) {
        runtime = assignPlayableRole(runtime, {
          playableRoleId: role.id,
          userId: `user-${role.id}`,
          now: opts.now || nowIso,
        });
      }
      runtime = startPlayableSession(runtime, { now: opts.now || nowIso });
      const stageIds = asArray(pkgForCompile.stages).map((s) => s.id);
      for (let i = 0; i < Math.max(0, stageIds.length - 1); i += 1) {
        runtime = advancePlayableStage(runtime, { now: opts.now || nowIso });
      }
      runtime = finishPlayableSession(runtime, { now: opts.now || nowIso });
      runtimeOk = true;
      runtimeTrace = {
        ok: true,
        assignedRoles: players.map((p) => p.id),
        finalStatus: runtime.status || runtime.sessionStatus,
      };
      log.auto("runtime_smoke_ok", runtimeTrace);
    }
  } catch (err) {
    runtimeOk = false;
    runtimeTrace = { ok: false, error: String(err?.message || err) };
    log.firefight("runtime_smoke_failed", runtimeTrace);
  }
  writeJson(path.join(outDir, "runtime-smoke-trace.json"), runtimeTrace);

  const counts = log.counts();
  const trialVerdict = classifyTrial({
    quality,
    firefighting: counts.developerFirefighting,
    productionBlocked: false,
    runtimeOk,
    runtimeSkipped,
  });

  const summary = {
    trialId: trialInput.trialId,
    title: trialInput.title,
    trialVerdict,
    note:
      trialVerdict === "TRIAL_PASS_CANDIDATE"
        ? "结构门槛达到 PASS 候选；五项人工审看仍须人工完成才能正式 TRIAL_PASS"
        : undefined,
    writerMode: llmMeta,
    quality: {
      status: quality.status,
      totalScore: quality.totalScore,
      hardBlockers: quality.hardBlockers?.length || 0,
      lowestDimensions: asArray(quality.dimensions)
        .slice()
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map((d) => ({ id: d.id, score: d.score })),
    },
    humanIntervention: counts,
    elapsedMs: Date.now() - started,
    artifactDir: outDir,
  };
  writeJson(path.join(outDir, "author-decisions.json"), log.rows);
  writeJson(path.join(outDir, "trial-summary.json"), summary);

  return {
    ...summary,
    outDir,
    package: production.package,
    quality,
    playable,
    log: log.rows,
  };
}
