/**
 * P8.2.2 Full Production Vertical Runner — thin orchestration over existing modules.
 * GEN-01: PMD → Gate → Packets → Writer → Package → Approve → Playable → Runtime → FINISHED
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeterministicTestScriptWriter } from "../shared/deterministic-test-script-writer.js";
import {
  approveCompleteScriptPackage,
  runScriptProduction,
} from "../shared/script-production-orchestrator.js";
import { compileCompleteScriptPackage } from "../shared/complete-script-playable-adapter.js";
import {
  assignablePlayerRoles,
  buildClueEndToEndTrace,
  buildScriptCoverageReport,
  buildSectionToContentUnitTrace,
} from "../shared/full-production-coverage.js";
import {
  advancePlayableStage,
  assignPlayableRole,
  createPlayableRuntimeState,
  fetchClueForRole,
  finishPlayableSession,
  normalizePlayableRuntimeState,
  releaseClue,
  resolveVisibleContent,
  startPlayableSession,
} from "../shared/playable-content-runtime.js";
import { loadGen01Pmd, FIXED_NOW } from "./p821-gen01-fixture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CAPTURE_DIR = path.resolve(__dirname, "../captures/p8-full-production/GEN-01");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function fingerprintPrivate(text) {
  const s = String(text || "").trim();
  if (s.length < 12) return s;
  return s.slice(0, 48);
}

function visibleTextBlob(runtime, roleId) {
  return resolveVisibleContent({ runtime, roleId })
    .map((u) => u.content || "")
    .join("\n");
}

/**
 * @param {{
 *   pmd?: object,
 *   writer?: { write: Function },
 *   projectId?: string,
 *   roomId?: string,
 *   now?: Function,
 *   captureDir?: string | null,
 *   writeCaptures?: boolean,
 * }} [opts]
 */
export async function runFullProductionVertical(opts = {}) {
  const now = opts.now || FIXED_NOW;
  const pmd = opts.pmd || loadGen01Pmd();
  const writer = opts.writer || new DeterministicTestScriptWriter();
  const projectId = opts.projectId || "gen-01-full-vertical";
  const roomId = opts.roomId || "room-gen01-full-vertical";

  const production = await runScriptProduction({ pmd, writer, projectId, now });

  const approved = approveCompleteScriptPackage(production.package, production.validation, {
    sectionStates: production.sectionStates,
  });

  const playable =
    approved.ok && approved.package
      ? compileCompleteScriptPackage(approved.package, {
          now,
          projectId: `${projectId}-playable`,
        })
      : null;

  const coverage = buildScriptCoverageReport({
    pmd,
    package: approved.package || production.package,
    playableProject: playable,
  });

  const sectionToContentUnit = playable
    ? buildSectionToContentUnitTrace({
        package: approved.package,
        playableProject: playable,
      })
    : [];
  const clueTrace = playable
    ? buildClueEndToEndTrace({
        pmd,
        package: approved.package,
        playableProject: playable,
      })
    : [];

  /** @type {object} */
  const runtimeProof = {
    sessionStarted: false,
    unassignedStartBlocked: false,
    stagesVisited: [],
    privacyChecks: [],
    clueChecks: [],
    finished: false,
    refreshOk: false,
    errors: [],
  };

  if (playable?.status === "READY") {
    try {
      let runtime = createPlayableRuntimeState({
        roomId,
        playableProject: playable,
        now,
      });

      try {
        startPlayableSession(runtime, { now });
        runtimeProof.errors.push({ code: "EXPECTED_UNASSIGNED_BLOCK" });
      } catch (err) {
        if (err.code === "UNASSIGNED_ROLES") runtimeProof.unassignedStartBlocked = true;
        else runtimeProof.errors.push({ code: "UNEXPECTED_START_ERROR", message: err.message });
      }

      const players = assignablePlayerRoles(approved.package);
      for (const role of players) {
        runtime = assignPlayableRole(runtime, {
          userId: `user_${role.id}`,
          playableRoleId: role.id,
          now,
        });
      }
      runtime = startPlayableSession(runtime, { now });
      runtimeProof.sessionStarted = true;
      runtimeProof.stagesVisited.push(runtime.currentStageId);

      const privateFingerprints = {};
      for (const role of players) {
        const units = resolveVisibleContent({ runtime, roleId: role.id }).filter(
          (u) => u.audience?.visibility === "PRIVATE" && u.audience.roleIds?.includes(role.id),
        );
        for (const u of units) {
          const fp = fingerprintPrivate(u.content);
          if (fp) privateFingerprints[`${role.id}:${u.id}`] = { roleId: role.id, fingerprint: fp };
        }
      }

      const stages = playable.stages || [];
      for (let i = 0; i < stages.length; i++) {
        const stageId = runtime.currentStageId;
        collectStageVisibility({
          runtime,
          players,
          stageId,
          privateFingerprints,
          runtimeProof,
        });

        const clueResult = releaseStageClues({
          runtime,
          playable,
          players,
          stageId,
          now,
          runtimeProof,
        });
        runtime = clueResult.runtime;

        if (i < stages.length - 1) {
          runtime = advancePlayableStage(runtime, { now });
          runtimeProof.stagesVisited.push(runtime.currentStageId);
        }
      }

      const json = JSON.parse(JSON.stringify(runtime));
      const restored = normalizePlayableRuntimeState(json);
      runtimeProof.refreshOk =
        restored.currentStageId === runtime.currentStageId &&
        restored.releasedClueIds.length === runtime.releasedClueIds.length;
      runtime = restored;

      runtime = finishPlayableSession(runtime, { now });
      runtimeProof.finished = runtime.status === "FINISHED";
      runtimeProof.finalStatus = runtime.status;
      runtimeProof.endingMode = runtime.endingSettlement?.sourcePlacementId
        ? "GAME"
        : "CONTENT_ONLY";
    } catch (err) {
      runtimeProof.errors.push({
        code: err.code || "RUNTIME_THROW",
        message: err.message,
      });
    }
  } else {
    runtimeProof.errors.push({
      code: "PLAYABLE_NOT_READY",
      status: playable?.status,
      diagnostics: (playable?.diagnostics || [])
        .filter((d) => d.severity === "ERROR")
        .slice(0, 20),
    });
  }

  const trace = {
    pmdId: pmd?.id || null,
    packageId: approved.package?.id || production.package?.id,
    playableProjectId: playable?.id || null,
    sectionToContentUnit,
    clueTrace,
    roleCoverage: coverage.characterCoverage,
    stageCoverage: coverage.stageCoverage,
    runtimeProof,
    production: {
      gateStatus: production.gate?.status,
      writerStatuses: production.sectionStates.map((s) => ({
        sectionId: s.sectionId,
        status: s.status,
        diff: s.diff?.status,
      })),
      packageStatusBeforeApprove: production.package?.status,
      packageStatusAfterApprove: approved.package?.status,
      approveOk: approved.ok,
      validationOk: production.validation?.ok,
    },
    compile: playable
      ? {
          status: playable.status,
          assignablePlayers: assignablePlayerRoles(approved.package).length,
          stages: playable.stages?.map((s) => s.id),
          startStage: playable.runtimeConfig?.startStageId,
          finalStage: playable.runtimeConfig?.finalStageId,
          errorCodes: (playable.diagnostics || [])
            .filter((d) => d.severity === "ERROR")
            .map((d) => d.code),
        }
      : null,
    coverage,
  };

  if (opts.writeCaptures !== false) {
    const dir = opts.captureDir || DEFAULT_CAPTURE_DIR;
    fs.mkdirSync(dir, { recursive: true });
    writeJson(path.join(dir, "complete-script-package.json"), approved.package || production.package);
    writeJson(path.join(dir, "playable-project.json"), playable);
    writeJson(path.join(dir, "coverage-report.json"), coverage);
    writeJson(path.join(dir, "runtime-trace.json"), trace);
  }

  return {
    pmd,
    production,
    approved,
    playable,
    coverage,
    trace,
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectStageVisibility({
  runtime,
  players,
  stageId,
  privateFingerprints,
  runtimeProof,
}) {
  for (const role of players) {
    const visible = resolveVisibleContent({ runtime, roleId: role.id });
    const blob = visibleTextBlob(runtime, role.id);
    const hasOwnPrivateOnStage = visible.some(
      (u) =>
        u.audience?.visibility === "PRIVATE" &&
        u.stageId === stageId &&
        asArray(u.audience?.roleIds).includes(role.id),
    );
    const stageHasPrivate = asArray(runtime.playableSnapshot?.contentUnits).some(
      (u) =>
        u.stageId === stageId &&
        u.audience?.visibility === "PRIVATE" &&
        asArray(u.audience?.roleIds).includes(role.id),
    );
    const hasPublic = visible.some((u) => u.audience?.visibility === "PUBLIC");
    const leakedHost = visible.some((u) => u.audience?.visibility === "HOST_ONLY");
    const peekFails = [];
    for (const [key, meta] of Object.entries(privateFingerprints)) {
      if (meta.roleId === role.id) continue;
      if (meta.fingerprint && blob.includes(meta.fingerprint)) peekFails.push(key);
    }
    runtimeProof.privacyChecks.push({
      stageId,
      roleId: role.id,
      hasPrivateOnStage: !stageHasPrivate || hasOwnPrivateOnStage,
      hasPublic,
      hostOnlyLeaked: leakedHost,
      foreignPrivateLeaks: peekFails,
      ok: !leakedHost && peekFails.length === 0 && (!stageHasPrivate || hasOwnPrivateOnStage),
    });
  }

  const hostVisible = resolveVisibleContent({ runtime, roleId: "role_host" });
  const hostSeesHostOnly = hostVisible.some(
    (u) => u.audience?.visibility === "HOST_ONLY" && u.stageId === stageId,
  );
  runtimeProof.privacyChecks.push({
    stageId,
    roleId: "role_host",
    hostSeesHostOnly,
    ok: hostSeesHostOnly,
  });
}

function releaseStageClues({ runtime, playable, players, stageId, now, runtimeProof }) {
  let next = runtime;
  const cluesHere = asArray(playable.clues).filter((c) => c.stageId === stageId);
  const playerIds = new Set(players.map((p) => p.id));

  for (const clue of cluesHere) {
    const audienceRoleIds = [
      ...asArray(clue.roleIds),
      ...asArray(clue.defaultAudience?.roleIds),
    ];
    const preferred = audienceRoleIds.find((id) => playerIds.has(id));
    const viewer = preferred || players[0]?.id;
    if (!viewer) continue;

    const before = fetchClueForRole(next, { roleId: viewer, clueId: clue.id });
    try {
      next = releaseClue(next, { clueId: clue.id, now });
      const after = fetchClueForRole(next, { roleId: viewer, clueId: clue.id });
      runtimeProof.clueChecks.push({
        stageId,
        clueId: clue.id,
        viewerRoleId: viewer,
        blockedBeforeRelease: before.ok === false,
        visibleAfterRelease: after.ok === true,
        ok: after.ok === true,
      });
    } catch (err) {
      runtimeProof.clueChecks.push({
        stageId,
        clueId: clue.id,
        viewerRoleId: viewer,
        ok: false,
        error: err.code || err.message,
      });
    }
  }
  return { runtime: next };
}

export async function runFullProductionVerticalMain() {
  const result = await runFullProductionVertical({ writeCaptures: true });
  const privacyOk = result.trace.runtimeProof.privacyChecks.every((c) => c.ok);
  const clueOk = result.trace.runtimeProof.clueChecks.every((c) => c.ok);
  const ok =
    result.production.gate?.status !== "BLOCKED" &&
    result.approved.ok &&
    result.playable?.status === "READY" &&
    result.coverage.ok &&
    result.trace.runtimeProof.finished &&
    result.trace.runtimeProof.errors.length === 0 &&
    privacyOk &&
    clueOk;
  console.log(
    JSON.stringify(
      {
        ok,
        packageStatus: result.approved.package?.status,
        playableStatus: result.playable?.status,
        coverageOk: result.coverage.ok,
        finished: result.trace.runtimeProof.finished,
        stagesVisited: result.trace.runtimeProof.stagesVisited,
        coverageErrors: result.coverage.errors,
        runtimeErrors: result.trace.runtimeProof.errors,
      },
      null,
      2,
    ),
  );
  if (!ok) process.exitCode = 1;
  return result;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runFullProductionVerticalMain().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
