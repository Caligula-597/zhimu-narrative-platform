/**
 * Compiler V2 job persistence — staging only (compiler_v2_jobs.state JSONB).
 */

import { query } from "../db.js";
import { throwErr } from "../api-errors.js";
import {
  createEmptyCompilerV2State,
  summarizeStateForStatus
} from "./state.js";
import { runCompilerV2Pipeline } from "./index.js";
import { applyStageSchemaDecision } from "./stage-schema.js";

const RETURN_COLS = "id, world_id, status, current_stage, state, error_code, error_message, created_by, created_at, updated_at";

function rowToJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.world_id,
    status: row.status,
    currentStage: row.current_stage,
    state: row.state || {},
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  };
}

export async function getCompilerV2Job(worldId, jobId) {
  const result = await query(
    `SELECT ${RETURN_COLS} FROM compiler_v2_jobs WHERE id = $1 AND world_id = $2`,
    [jobId, worldId]
  );
  return rowToJob(result.rows[0]);
}

export async function createCompilerV2Job(worldId, actorId, { inputFiles, creationType } = {}) {
  if (!inputFiles?.hostHandbook?.filename) {
    throwErr("OPENING_PACKAGE_HOST_REQUIRED");
  }
  if (inputFiles.rightsConfirmed !== true && inputFiles.rightsConfirmed !== undefined) {
    // rightsConfirmed may live on payload root — checked by route
  }

  const empty = createEmptyCompilerV2State({ worldId });
  if (creationType) empty.project.creationType = creationType;

  const result = await query(
    `INSERT INTO compiler_v2_jobs (world_id, status, current_stage, state, created_by)
     VALUES ($1, 'queued', 'queued', $2::jsonb, $3)
     RETURNING ${RETURN_COLS}`,
    [worldId, JSON.stringify(empty), actorId || null]
  );
  const job = rowToJob(result.rows[0]);

  // Fire-and-forget background run (same process). HTTP returns jobId immediately.
  setImmediate(() => {
    processCompilerV2Job(worldId, job.id, inputFiles).catch((err) => {
      console.error("[compiler-v2] job failed", job.id, err);
    });
  });

  return {
    jobId: job.id,
    status: job.status,
    currentStage: job.currentStage
  };
}

async function updateJob(worldId, jobId, patch) {
  const sets = [];
  const params = [jobId, worldId];
  let i = 3;
  if (patch.status != null) {
    sets.push(`status = $${i++}`);
    params.push(patch.status);
  }
  if (patch.currentStage != null) {
    sets.push(`current_stage = $${i++}`);
    params.push(patch.currentStage);
  }
  if (patch.state != null) {
    sets.push(`state = $${i++}::jsonb`);
    params.push(JSON.stringify(patch.state));
  }
  if (patch.errorCode !== undefined) {
    sets.push(`error_code = $${i++}`);
    params.push(patch.errorCode);
  }
  if (patch.errorMessage !== undefined) {
    sets.push(`error_message = $${i++}`);
    params.push(patch.errorMessage);
  }
  sets.push("updated_at = now()");
  const result = await query(
    `UPDATE compiler_v2_jobs SET ${sets.join(", ")}
     WHERE id = $1 AND world_id = $2
     RETURNING ${RETURN_COLS}`,
    params
  );
  return rowToJob(result.rows[0]);
}

export async function processCompilerV2Job(worldId, jobId, inputFiles) {
  const existing = await getCompilerV2Job(worldId, jobId);
  if (!existing) return null;

  await updateJob(worldId, jobId, {
    status: "processing",
    currentStage: "project_identify",
    errorCode: null,
    errorMessage: null
  });

  try {
    const initial = {
      ...createEmptyCompilerV2State({ worldId, jobId }),
      ...(existing.state || {}),
      project: {
        ...(existing.state?.project || {}),
        worldId
      },
      job: {
        jobId,
        status: "processing",
        currentStage: "project_identify",
        completedStages: []
      }
    };

    const state = await runCompilerV2Pipeline(initial, { inputFiles });
    return updateJob(worldId, jobId, {
      status: state.job?.status || "needs_review",
      currentStage: state.job?.currentStage || "integrity_check",
      state,
      errorCode: null,
      errorMessage: null
    });
  } catch (err) {
    const message = err?.message || String(err);
    const code = err?.code || "COMPILER_V2_FAILED";
    return updateJob(worldId, jobId, {
      status: "failed",
      errorCode: code,
      errorMessage: message.slice(0, 2000)
    });
  }
}

export async function getCompilerV2Status(worldId, jobId) {
  const job = await getCompilerV2Job(worldId, jobId);
  if (!job) throwErr("COMPILER_V2_JOB_NOT_FOUND");
  return {
    jobId: job.id,
    worldId: job.worldId,
    status: job.status,
    currentStage: job.currentStage,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    summary: summarizeStateForStatus(job.state || {}),
    updatedAt: job.updatedAt
  };
}

export async function getCompilerV2Results(worldId, jobId) {
  const job = await getCompilerV2Job(worldId, jobId);
  if (!job) throwErr("COMPILER_V2_JOB_NOT_FOUND");
  return {
    jobId: job.id,
    worldId: job.worldId,
    status: job.status,
    currentStage: job.currentStage,
    state: job.state,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    updatedAt: job.updatedAt
  };
}

/**
 * Commit staging → formal runtime.
 * Intentionally incomplete until User Review UX lands — rejects unless needs_review
 * and explicit confirmCommit.
 */
export async function commitCompilerV2Job(worldId, jobId, { confirmCommit } = {}) {
  const job = await getCompilerV2Job(worldId, jobId);
  if (!job) throwErr("COMPILER_V2_JOB_NOT_FOUND");
  if (job.status === "committed") {
    return { jobId, status: "committed", alreadyCommitted: true };
  }
  if (job.status !== "needs_review" && job.status !== "completed") {
    throwErr("COMPILER_V2_NOT_READY_FOR_COMMIT");
  }
  if (confirmCommit !== true) {
    throwErr("COMPILER_V2_COMMIT_CONFIRM_REQUIRED");
  }

  // Phase-1 commit: mark committed + stamp world settings. Full entity mapping follows.
  await query(
    `UPDATE worlds
     SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
         updated_at = now()
     WHERE id = $1`,
    [
      worldId,
      JSON.stringify({
        importCompilerV2: {
          jobId,
          committedAt: new Date().toISOString(),
          projectTitle: job.state?.project?.title || null,
          counts: summarizeStateForStatus(job.state || {}).counts,
          stageSchema: job.state?.stageSchema || null
        }
      })
    ]
  );

  await updateJob(worldId, jobId, { status: "committed", currentStage: "committed" });
  return {
    jobId,
    status: "committed",
    note: "Staging marked committed; full runtime entity mapping will expand in a follow-up slice."
  };
}

/**
 * User confirms / rejects / manually edits StageSchema on a job (author layer).
 * decision: confirm | reject | manual
 */
export async function confirmCompilerV2StageSchema(worldId, jobId, body = {}) {
  const job = await getCompilerV2Job(worldId, jobId);
  if (!job) throwErr("COMPILER_V2_JOB_NOT_FOUND");
  if (job.status === "committed") throwErr("COMPILER_V2_ALREADY_COMMITTED");
  if (job.status === "processing" || job.status === "queued") {
    throwErr("COMPILER_V2_NOT_READY_FOR_COMMIT");
  }

  const decision = String(body.decision || "").trim();
  if (!["confirm", "reject", "manual"].includes(decision)) {
    throwErr("VALIDATION_ERROR", "decision 须为 confirm | reject | manual");
  }

  const nextState = applyStageSchemaDecision(job.state || {}, {
    decision,
    manualItems: body.items
  });

  const updated = await updateJob(worldId, jobId, { state: nextState });
  return {
    jobId,
    status: updated.status,
    stageSchema: nextState.stageSchema,
    stageSchemaProposal: nextState.stageSchemaProposal,
    summary: summarizeStateForStatus(nextState)
  };
}
