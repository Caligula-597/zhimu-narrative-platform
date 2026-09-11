/**
 * F4C — M12 Formation Beat → Master Outline placement sidecar.
 *
 * This adapter consumes only ProjectStoryState. It re-runs F3/F4B from the
 * state-owned artifact, then stores refs + placement coordinates on the
 * MasterOutlineDraft. It never copies Formation text or audience projections.
 */

import { normalizeProjectStoryState } from "./story-mechanism-contracts.js";
import { compileM12FormationBeats } from "./m12-formation-beat-compiler.js";

export const M12_FORMATION_INTEGRATION_VERSION = 1;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanId(value) {
  return String(value ?? "").trim();
}

function revision(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

function resultError(code, message, details = {}) {
  return { ok: false, code, message, details };
}

function stagePosition(stages, stageId, order) {
  const stage = asArray(stages).find((s) => s.id === stageId);
  if (!stage) return null;
  return {
    stageOrder: Number(stage.order) || 0,
    order: Number(order) || 0,
  };
}

function comparePosition(a, b) {
  if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
  return a.order - b.order;
}

function findResolutionEntryAnchor(draft, sourceBlockId) {
  const candidates = [];
  for (const stage of asArray(draft?.stages)) {
    for (let index = 0; index < asArray(stage.beats).length; index += 1) {
      const beat = stage.beats[index];
      if (beat.sourceBlockId !== sourceBlockId) continue;
      const actionKind = String(beat.semantics?.actionKind || "").toUpperCase();
      const stageKey = String(beat.stageKey || "").toUpperCase();
      if (actionKind !== "PROBE" && stageKey !== "PROBE") continue;
      candidates.push({
        stageId: stage.id,
        stageOrder: Number(stage.order) || 0,
        order: index,
        beatId: beat.id,
      });
    }
  }
  candidates.sort((a, b) =>
    a.stageOrder - b.stageOrder || a.order - b.order || a.beatId.localeCompare(b.beatId),
  );
  return candidates[0] || null;
}

function preferredSatisfied(beat, placed) {
  const preferred = asArray(beat.preferredAfterBeatIds).filter((id) => id !== beat.id);
  return preferred.every((id) => placed.has(id));
}

/** Topological order with soft preferred-after tie breaking. */
export function orderFormationBeats(beats) {
  const list = asArray(beats);
  const byId = new Map(list.map((beat) => [beat.id, beat]));
  const originalIndex = new Map(list.map((beat, index) => [beat.id, index]));
  const placed = new Set();
  const ordered = [];

  while (ordered.length < list.length) {
    const candidates = list.filter((beat) =>
      !placed.has(beat.id) && asArray(beat.requiresBeatIds).every((id) => byId.has(id) && placed.has(id)),
    );
    if (!candidates.length) {
      const unresolved = list.filter((beat) => !placed.has(beat.id)).map((beat) => ({
        beatId: beat.id,
        requiresBeatIds: asArray(beat.requiresBeatIds),
      }));
      return resultError(
        "FORMATION_BEAT_CAUSAL_CYCLE",
        "Formation Beat 的 requiresBeatIds 无法形成可满足的拓扑顺序",
        { unresolved },
      );
    }
    candidates.sort((a, b) =>
      Number(preferredSatisfied(b, placed)) - Number(preferredSatisfied(a, placed)) ||
      (originalIndex.get(a.id) || 0) - (originalIndex.get(b.id) || 0) ||
      a.id.localeCompare(b.id),
    );
    const next = candidates[0];
    ordered.push(next);
    placed.add(next.id);
  }
  return { ok: true, beats: ordered };
}

function placementRowsForArtifact({ artifact, beats, draft, anchor, groupSize = beats.length }) {
  const ordered = orderFormationBeats(beats);
  if (!ordered.ok) return ordered;
  const rows = ordered.beats.map((beat, index) => ({
    artifactId: artifact.id,
    artifactRevision: revision(artifact.revision),
    sourceBlockId: artifact.sourceBlockId,
    beatId: beat.id,
    stageId: anchor.stageId,
    // Negative coordinates are valid: they reserve slots immediately before PROBE.
    order: anchor.order - groupSize + index,
  }));
  return { ok: true, rows, anchor, beats: ordered.beats };
}

function compiledForArtifact(state, artifact) {
  const result = compileM12FormationBeats({ state, artifactId: artifact.id });
  if (!result.ok) {
    return resultError(
      result.errors?.[0]?.code || "FORMATION_BEAT_INPUT_NOT_READY",
      "F4C 只接受当前 state 中通过 F3 的 Formation Artifact",
      { artifactId: artifact.id, compilerErrors: result.errors || [] },
    );
  }
  return { ok: true, result };
}

function integrationSources(artifacts) {
  return artifacts
    .map((artifact) => ({
      artifactId: artifact.id,
      revision: revision(artifact.revision),
      sourceBlockRevision: revision(artifact.sourceBlockRevision),
    }))
    .sort((a, b) => a.artifactId.localeCompare(b.artifactId));
}

function acceptedBlock(block) {
  return block && ["USER_ACCEPTED", "USER_MODIFIED", "LOCKED"].includes(block.status);
}

function emptySidecar() {
  return {
    formationBeatPlacements: [],
    formationIntegration: {
      version: M12_FORMATION_INTEGRATION_VERSION,
      sourceRevision: null,
      sourceRevisions: [],
      warnings: [],
    },
  };
}

function validatePlacementSet({ state, draft, artifacts, placements }) {
  const allPlacementRows = asArray(placements);
  const expectedArtifactIds = new Set(artifacts.map((artifact) => artifact.id));
  for (const row of allPlacementRows) {
    if (!expectedArtifactIds.has(row.artifactId)) {
      return resultError(
        "FORMATION_PLACEMENT_UNKNOWN_ARTIFACT",
        `Placement 引用了 state 中不存在的 Formation Artifact：${row.artifactId}`,
        { row },
      );
    }
  }

  const warnings = [];
  for (const artifact of artifacts) {
    const sourceBlock = state.mechanismBlocks.find((block) => block.id === artifact.sourceBlockId);
    if (!sourceBlock || sourceBlock.templateId !== "M12-1" || !acceptedBlock(sourceBlock)) {
      return resultError("FORMATION_SOURCE_BLOCK_MISSING", `Formation source M12 block 不在当前 state 中：${artifact.sourceBlockId}`, { artifactId: artifact.id });
    }
    if (!asArray(draft.sourceBlockIds).includes(artifact.sourceBlockId)) {
      return resultError("FORMATION_SOURCE_BLOCK_NOT_IN_OUTLINE", `Formation source M12 block 未进入当前 Master Outline：${artifact.sourceBlockId}`, { artifactId: artifact.id });
    }
    const compiled = compiledForArtifact(state, artifact);
    if (!compiled.ok) return compiled;
    const beats = compiled.result.beats;
    const rows = allPlacementRows.filter((row) => row.artifactId === artifact.id);
    if (rows.length !== beats.length) {
      return resultError(
        "FORMATION_PLACEMENT_INCOMPLETE",
        `Formation Beat placement 不完整：${artifact.id}`,
        { artifactId: artifact.id, expected: beats.map((beat) => beat.id), actual: rows.map((row) => row.beatId) },
      );
    }

    const byBeatId = new Map(beats.map((beat) => [beat.id, beat]));
    const rowByBeatId = new Map();
    for (const row of rows) {
      if (!byBeatId.has(row.beatId)) {
        return resultError("FORMATION_PLACEMENT_UNKNOWN_BEAT", `Placement 引用了未知 Formation Beat：${row.beatId}`, { row });
      }
      if (rowByBeatId.has(row.beatId)) {
        return resultError("FORMATION_PLACEMENT_DUPLICATE_BEAT", `Formation Beat 重复 placement：${row.beatId}`, { row });
      }
      if (row.artifactRevision !== revision(artifact.revision)) {
        return resultError("FORMATION_PLACEMENT_STALE_REVISION", `Placement 的 Artifact revision 已过期：${row.beatId}`, { row });
      }
      if (row.sourceBlockId !== artifact.sourceBlockId) {
        return resultError("FORMATION_PLACEMENT_SOURCE_MISMATCH", `Placement 的 sourceBlockId 不匹配：${row.beatId}`, { row });
      }
      rowByBeatId.set(row.beatId, row);
    }

    const anchor = findResolutionEntryAnchor(draft, artifact.sourceBlockId);
    if (!anchor) {
      return resultError(
        "FORMATION_RESOLUTION_ANCHOR_MISSING",
        `找不到 ${artifact.sourceBlockId} 的 M12 Resolution Entry（PROBE）anchor，不能猜位置`,
        { artifactId: artifact.id, sourceBlockId: artifact.sourceBlockId },
      );
    }
    const anchorPosition = stagePosition(draft.stages, anchor.stageId, anchor.order);
    for (const beat of beats) {
      const row = rowByBeatId.get(beat.id);
      const position = stagePosition(draft.stages, row.stageId, row.order);
      if (!position) {
        return resultError("FORMATION_PLACEMENT_STAGE_MISSING", `Placement 引用了未知 stage：${row.stageId}`, { row });
      }
      if (comparePosition(position, anchorPosition) >= 0) {
        return resultError(
          "FORMATION_PLACEMENT_AFTER_RESOLUTION_ENTRY",
          `Formation Beat ${beat.id} 必须位于 M12 PROBE 之前`,
          { beatId: beat.id, row, anchor },
        );
      }
      for (const requiredId of asArray(beat.requiresBeatIds)) {
        const requiredRow = rowByBeatId.get(requiredId);
        if (!requiredRow) {
          return resultError("FORMATION_BEAT_DEPENDENCY_MISSING", `缺少 hard dependency placement：${requiredId}`, { beatId: beat.id });
        }
        const requiredPosition = stagePosition(draft.stages, requiredRow.stageId, requiredRow.order);
        if (comparePosition(requiredPosition, position) >= 0) {
          return resultError(
            "FORMATION_BEAT_CAUSAL_ORDER_VIOLATION",
            `Formation Beat ${beat.id} 的 hard dependency ${requiredId} 未排在前面`,
            { beatId: beat.id, requiredId, row, requiredRow },
          );
        }
      }
      const preferred = asArray(beat.preferredAfterBeatIds);
      const unsatisfied = preferred.filter((preferredId) => {
        const preferredRow = rowByBeatId.get(preferredId);
        if (!preferredRow) return false;
        const preferredPosition = stagePosition(draft.stages, preferredRow.stageId, preferredRow.order);
        return comparePosition(preferredPosition, position) >= 0;
      });
      if (unsatisfied.length) {
        warnings.push({
          code: "FORMATION_PREFERRED_ORDER_UNSATISFIED",
          message: `${beat.id} 的体验编排偏好未满足；不转化为 causal blocker`,
          artifactId: artifact.id,
          beatId: beat.id,
          preferredAfterBeatIds: unsatisfied,
        });
      }
    }
  }

  return { ok: true, warnings };
}

/** Build the sidecar for a freshly generated P5 draft. */
export function buildFormationIntegrationSidecar(projectStoryState, draft) {
  const state = normalizeProjectStoryState(projectStoryState);
  const artifacts = asArray(state.m12FormationArtifacts)
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!artifacts.length) return { ok: true, ...emptySidecar() };

  const plans = [];
  for (const artifact of artifacts) {
    const block = state.mechanismBlocks.find((candidate) => candidate.id === artifact.sourceBlockId);
    if (!block || block.templateId !== "M12-1" || !acceptedBlock(block)) {
      return resultError("FORMATION_SOURCE_BLOCK_MISSING", `Formation source M12 block 不在当前 state 中：${artifact.sourceBlockId}`, { artifactId: artifact.id });
    }
    if (!asArray(draft.sourceBlockIds).includes(artifact.sourceBlockId)) {
      return resultError("FORMATION_SOURCE_BLOCK_NOT_IN_OUTLINE", `Formation source M12 block 未进入当前 Master Outline：${artifact.sourceBlockId}`, { artifactId: artifact.id });
    }
    const compiled = compiledForArtifact(state, artifact);
    if (!compiled.ok) return compiled;
    const anchor = findResolutionEntryAnchor(draft, artifact.sourceBlockId);
    if (!anchor) {
      return resultError(
        "FORMATION_RESOLUTION_ANCHOR_MISSING",
        `找不到 ${artifact.sourceBlockId} 的 M12 Resolution Entry（PROBE）anchor，不能猜位置`,
        { artifactId: artifact.id, sourceBlockId: artifact.sourceBlockId },
      );
    }
    plans.push({ artifact, result: compiled.result, anchor });
  }

  const groups = new Map();
  for (const plan of plans) {
    const key = `${plan.anchor.stageId}|${plan.anchor.order}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(plan);
  }
  const rows = [];
  for (const group of groups.values()) {
    const total = group.reduce((sum, plan) => sum + plan.result.beats.length, 0);
    let offset = 0;
    for (const plan of group) {
      const placed = placementRowsForArtifact({
        artifact: plan.artifact,
        beats: plan.result.beats,
        draft,
        anchor: plan.anchor,
        groupSize: total,
      });
      if (!placed.ok) return placed;
      for (const row of placed.rows) {
        row.order += offset;
        rows.push(row);
      }
      offset += placed.rows.length;
    }
  }
  rows.sort((a, b) => {
    const stageA = asArray(draft.stages).find((stage) => stage.id === a.stageId);
    const stageB = asArray(draft.stages).find((stage) => stage.id === b.stageId);
    return (
      (Number(stageA?.order) || 0) - (Number(stageB?.order) || 0) ||
      a.order - b.order ||
      a.stageId.localeCompare(b.stageId) ||
      a.artifactId.localeCompare(b.artifactId) ||
      a.beatId.localeCompare(b.beatId)
    );
  });

  const validation = validatePlacementSet({ state, draft, artifacts, placements: rows });
  if (!validation.ok) return validation;
  const sources = integrationSources(artifacts);
  return {
    ok: true,
    formationBeatPlacements: rows,
    formationIntegration: {
      version: M12_FORMATION_INTEGRATION_VERSION,
      sourceRevision: sources.length === 1 ? sources[0].revision : null,
      sourceRevisions: sources,
      warnings: validation.warnings,
    },
  };
}

/** Validate an existing draft sidecar before it is written back to state. */
export function validateFormationIntegration(projectStoryState, draft) {
  const state = normalizeProjectStoryState(projectStoryState);
  const artifacts = asArray(state.m12FormationArtifacts).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
  const placements = asArray(draft?.formationBeatPlacements);
  if (!artifacts.length && placements.length) {
    return resultError("FORMATION_PLACEMENT_WITHOUT_ARTIFACT", "Draft 含 Formation placement，但当前 state 没有 Artifact");
  }
  if (!artifacts.length) return { ok: true, warnings: [], ...emptySidecar() };
  const validation = validatePlacementSet({ state, draft, artifacts, placements });
  if (!validation.ok) return validation;
  const sources = integrationSources(artifacts);
  return {
    ok: true,
    warnings: validation.warnings,
    formationIntegration: {
      version: M12_FORMATION_INTEGRATION_VERSION,
      sourceRevision: sources.length === 1 ? sources[0].revision : null,
      sourceRevisions: sources,
      warnings: validation.warnings,
    },
  };
}
