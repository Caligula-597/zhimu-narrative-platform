/**
 * F5.1 — PMD FormationView Bridge V1.
 *
 * Additive, deterministic and read-only. It resolves F4C placement refs to the
 * current F4B compiled beats, then carries the already-derived F4A audience
 * projections into ProductionMasterDraft. It never parses raw reveals to
 * invent a new role-relative meaning and never creates Resolution outcomes.
 */

import { normalizeProjectStoryState } from "./story-mechanism-contracts.js";
import {
  compileM12FormationBeats,
  M12_FORMATION_BEAT_VERSION,
} from "./m12-formation-beat-compiler.js";
import {
  M12_FORMATION_INTEGRATION_VERSION,
  validateFormationIntegration,
} from "./m12-formation-integrator.js";
import { formationNodeKnownTo, projectFormationNodeForAudience } from "./m12-formation-role-projection.js";

export const M12_FORMATION_PMD_VIEW_VERSION = 1;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function revision(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

function cleanId(value) {
  return String(value ?? "").trim();
}

function error(code, message, details = {}) {
  return { ok: false, code, message, details };
}

function provenanceOf(node) {
  return {
    type: node?.provenance?.type || null,
    summary: node?.provenance?.summary || null,
    sourceRefs: [...asArray(node?.provenance?.sourceRefs)],
  };
}

function sourceSnapshot(artifact) {
  return {
    artifactId: artifact.id,
    artifactRevision: revision(artifact.revision),
    sourceBlockId: artifact.sourceBlockId,
    integrationVersion: M12_FORMATION_INTEGRATION_VERSION,
    compilerVersion: M12_FORMATION_BEAT_VERSION,
  };
}

function entryFromProjection({ artifact, beat, projection, node }) {
  const optional = asArray(beat.optionalNodeRefs).includes(projection.nodeId);
  return {
    artifactId: artifact.id,
    artifactRevision: revision(artifact.revision),
    sourceBlockId: artifact.sourceBlockId,
    beatId: beat.id,
    nodeId: projection.nodeId,
    kind: node?.kind || null,
    projectionType: projection.projectionType,
    text: projection.text,
    provenance: provenanceOf(node),
    required: !optional,
    optional,
    inferenceStatus: node?.kind === "INFERENCE" ? node.confidence || null : null,
    confidence: node?.confidence || null,
    subjectCharacterIds: [...(projection.subjectCharacterIds || [])],
  };
}

function publicNodeIds(artifact, characterIds) {
  return new Set(
    asArray(artifact.nodes)
      .filter((node) => characterIds.length > 0 && characterIds.every((id) => formationNodeKnownTo(node, id)))
      .map((node) => node.id),
  );
}

function characterEntries({ artifact, beat, nodeById, characterId }) {
  const projections = new Map(
    asArray(beat.audienceViews?.[characterId]).map((projection) => [projection.nodeId, projection]),
  );
  // F4B audienceViews lists the beat participants. Public Formation facts must
  // still be available to every character audience; fill only with the frozen
  // F4A projection, never by reinterpreting node.reveals in P6.
  for (const nodeId of [...beat.nodeRefs, ...beat.supportNodeRefs]) {
    const node = nodeById.get(nodeId);
    if (!node || projections.has(nodeId) || !formationNodeKnownTo(node, characterId)) continue;
    projections.set(
      nodeId,
      projectFormationNodeForAudience(node, { audienceType: "CHARACTER", audienceId: characterId }),
    );
  }
  return [...projections.values()].map((projection) => {
    const node = nodeById.get(projection.nodeId);
    return node ? entryFromProjection({ artifact, beat, projection, node }) : null;
  }).filter(Boolean);
}

function hostEntries({ artifact, beat, nodeById, publicIds }) {
  const entries = [];
  for (const nodeId of [...beat.nodeRefs, ...beat.supportNodeRefs]) {
    if (!publicIds.has(nodeId)) continue;
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const projection = projectFormationNodeForAudience(node, { audienceType: "HOST" });
    entries.push(entryFromProjection({ artifact, beat, projection, node }));
  }
  return entries;
}

/**
 * Build the PMD-only Formation snapshot from the state-owned artifact and
 * F4C sidecar. No caller-supplied Artifact/Beat is accepted as authority.
 */
export function buildM12FormationViewForProductionMasterDraft({ state, masterOutlineDraft } = {}) {
  const normalizedState = normalizeProjectStoryState(state);
  const artifacts = asArray(normalizedState.m12FormationArtifacts)
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!artifacts.length) return { ok: true, formationView: null };

  const validation = validateFormationIntegration(normalizedState, masterOutlineDraft);
  if (!validation.ok) return validation;

  const characters = asArray(normalizedState.characters);
  const characterIds = characters.map((character) => character.id).filter(Boolean);
  const sources = [];
  const beats = [];
  const characterViews = Object.fromEntries(characterIds.map((id) => [id, { entries: [] }]));
  const hostEntriesByKey = new Map();

  for (const artifact of artifacts) {
    const compiled = compileM12FormationBeats({ state: normalizedState, artifactId: artifact.id });
    if (!compiled.ok) {
      return error(
        compiled.errors?.[0]?.code || "FORMATION_BEAT_INPUT_NOT_READY",
        "P6 只接受当前 state 中通过 F3 的 Formation Artifact",
        { artifactId: artifact.id, compilerErrors: compiled.errors || [] },
      );
    }
    const placements = asArray(masterOutlineDraft?.formationBeatPlacements).filter(
      (row) => row.artifactId === artifact.id,
    );
    const placementByBeatId = new Map(placements.map((row) => [row.beatId, row]));
    const nodeById = new Map(asArray(artifact.nodes).map((node) => [node.id, node]));
    const publicIds = publicNodeIds(artifact, characterIds);
    sources.push(sourceSnapshot(artifact));

    for (const beat of compiled.beats) {
      const placement = placementByBeatId.get(beat.id);
      if (!placement) {
        return error(
          "FORMATION_PLACEMENT_INCOMPLETE",
          `P6 找不到 Formation Beat ${beat.id} 的 F4C placement`,
          { artifactId: artifact.id, beatId: beat.id },
        );
      }
      beats.push({
        artifactId: artifact.id,
        artifactRevision: revision(artifact.revision),
        sourceBlockId: artifact.sourceBlockId,
        beatId: beat.id,
        stageId: placement.stageId,
        order: placement.order,
        purpose: beat.purpose,
        requiredNodeRefs: [...beat.requiredNodeRefs],
        optionalNodeRefs: [...beat.optionalNodeRefs],
        nodeRefs: [...beat.nodeRefs],
        requiresBeatIds: [...beat.requiresBeatIds],
        preferredAfterBeatIds: [...beat.preferredAfterBeatIds],
      });

      for (const characterId of characterIds) {
        characterViews[characterId].entries.push(
          ...characterEntries({ artifact, beat, nodeById, characterId }),
        );
      }
      for (const entry of hostEntries({ artifact, beat, nodeById, publicIds })) {
        const key = `${entry.artifactId}|${entry.beatId}|${entry.nodeId}`;
        hostEntriesByKey.set(key, entry);
      }
    }
  }

  return {
    ok: true,
    formationView: {
      version: M12_FORMATION_PMD_VIEW_VERSION,
      sources,
      beats,
      characterViews,
      hostView: { entries: [...hostEntriesByKey.values()] },
    },
  };
}
