/**
 * F5 — Formation Projection Survival V1（deterministic · 只读 · 不跑 LLM）。
 *
 * 目的不是提升内容质量，而是回答 Formation 从 F4C 之后有没有继续存在：
 *   MasterOutlineDraft → P6 ProductionMasterDraft → formal view-specific Packet
 *
 * 本刀只做 audit，不修改 P6 / Writer / Packet contract。
 * 当前 P6 若没有承载 Formation 的 sidecar，本 probe 应明确报出第一丢失层，
 * 而不是把普通 STORY beat 的存在误判成 Formation 已存活。
 */

import { normalizeProjectStoryState } from "./story-mechanism-contracts.js";
import { normalizeMasterOutlineDraft } from "./master-outline-contracts.js";
import { validateFormationIntegration } from "./m12-formation-integrator.js";
import {
  compileM12FormationBeats,
  M12_FORMATION_BEAT_VERSION,
} from "./m12-formation-beat-compiler.js";
import { M12_FORMATION_INTEGRATION_VERSION } from "./m12-formation-integrator.js";
import {
  formationNodeKnownTo,
  projectFormationNodeForAudience,
} from "./m12-formation-role-projection.js";
import { expandProductionMasterDraft } from "./production-master-draft-expander.js";
import { buildScriptProductionPacketSet } from "./script-production-packets.js";

export const M12_FORMATION_PROJECTION_SURVIVAL_VERSION = 1;

export const M12_FORMATION_PROJECTION_SURVIVAL_DECISIONS = Object.freeze([
  "FORMATION_PROJECTION_SURVIVED",
  "FORMATION_PROJECTION_LOSS",
]);

const LAYERS = Object.freeze({
  OUTLINE: "MASTER_OUTLINE",
  PMD: "PRODUCTION_MASTER_DRAFT",
  PACKET: "WRITER_PACKET",
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function sameArray(left, right) {
  const a = asArray(left).map(String);
  const b = asArray(right).map(String);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function issue(code, layer, message, details = {}) {
  return { code, layer, message, ...details };
}

function artifactRevisionOf(artifact) {
  return Math.max(0, Math.trunc(Number(artifact?.revision) || 0));
}

function nodeProvenance(node) {
  return {
    type: node?.provenance?.type || null,
    summary: node?.provenance?.summary || null,
    sourceRefs: [...asArray(node?.provenance?.sourceRefs)],
  };
}

function publicNodesOf(artifact, characterIds) {
  return asArray(artifact?.nodes).filter(
    (node) => characterIds.length > 0 && characterIds.every((id) => formationNodeKnownTo(node, id)),
  );
}

function factSnapshot(node, audience) {
  const projection = projectFormationNodeForAudience(node, audience);
  return {
    nodeId: node.id,
    kind: node.kind,
    projectionType: projection?.projectionType || null,
    text: projection?.text || "",
    provenance: nodeProvenance(node),
    confidence: node.confidence || null,
    inferenceStatus: node.kind === "INFERENCE" ? node.confidence || null : null,
    subjectCharacterIds: [...(projection?.subjectCharacterIds || [])],
  };
}

function survivalEntry({ artifact, beat, node, projection }) {
  const optional = asArray(beat.optionalNodeRefs).includes(node.id);
  return {
    artifactId: artifact.id,
    artifactRevision: artifactRevisionOf(artifact),
    sourceBlockId: artifact.sourceBlockId,
    beatId: beat.id,
    nodeId: node.id,
    kind: node.kind,
    projectionType: projection?.projectionType || null,
    text: projection?.text || "",
    provenance: nodeProvenance(node),
    required: !optional,
    optional,
    inferenceStatus: node.kind === "INFERENCE" ? node.confidence || null : null,
    confidence: node.confidence || null,
    subjectCharacterIds: [...(projection?.subjectCharacterIds || [])],
  };
}

function expectedCharacterEntries({ artifact, beat, nodeById, characterId }) {
  const projections = new Map(
    asArray(beat.audienceViews?.[characterId]).map((projection) => [projection.nodeId, projection]),
  );
  for (const nodeId of [...beat.nodeRefs, ...beat.supportNodeRefs]) {
    const node = nodeById.get(nodeId);
    if (!node || projections.has(nodeId) || !formationNodeKnownTo(node, characterId)) continue;
    projections.set(
      nodeId,
      projectFormationNodeForAudience(node, { audienceType: "CHARACTER", audienceId: characterId }),
    );
  }
  return [...projections.values()]
    .map((projection) => {
      const node = nodeById.get(projection.nodeId);
      return node ? survivalEntry({ artifact, beat, node, projection }) : null;
    })
    .filter(Boolean);
}

function expectedAudienceFacts(state, artifact) {
  const characterIds = unique(asArray(state.characters).map((character) => character?.id));
  const publicNodes = publicNodesOf(artifact, characterIds);
  const publicIds = new Set(publicNodes.map((node) => node.id));
  const audiences = [
    {
      audienceType: "HOST",
      audienceId: null,
      fixedFacts: publicNodes.map((node) => factSnapshot(node, { audienceType: "HOST" })),
      characterKnowledge: [],
    },
    ...characterIds.map((characterId) => ({
      audienceType: "CHARACTER",
      audienceId: characterId,
      fixedFacts: publicNodes.map((node) =>
        factSnapshot(node, { audienceType: "CHARACTER", audienceId: characterId }),
      ),
      characterKnowledge: asArray(artifact.nodes)
        .filter((node) => formationNodeKnownTo(node, characterId) && !publicIds.has(node.id))
        .map((node) => factSnapshot(node, { audienceType: "CHARACTER", audienceId: characterId })),
    })),
  ];
  return audiences;
}

/**
 * Build the deterministic expectation used by the probe and its mutation fixtures.
 * This is an audit snapshot, not a new PMD contract and is never written to state.
 */
export function buildM12FormationSurvivalExpectation({ state, artifactId, masterOutlineDraft } = {}) {
  const normalizedState = normalizeProjectStoryState(state);
  const outline = normalizeMasterOutlineDraft(masterOutlineDraft || normalizedState.masterOutlineDraft);
  const artifact = normalizedState.m12FormationArtifacts.find((item) => item.id === String(artifactId || ""));
  if (!artifact || !outline) return null;

  const compiled = compileM12FormationBeats({ state: normalizedState, artifactId: artifact.id });
  if (!compiled.ok) return null;
  const placements = asArray(outline.formationBeatPlacements).filter(
    (row) => row.artifactId === artifact.id,
  );
  const placementByBeatId = new Map(placements.map((row) => [row.beatId, row]));

  const nodeById = new Map(asArray(artifact.nodes).map((node) => [node.id, node]));
  const characterIds = unique(asArray(normalizedState.characters).map((character) => character?.id));
  const characterViews = Object.fromEntries(characterIds.map((id) => [id, { entries: [] }]));
  const publicIds = new Set(publicNodesOf(artifact, characterIds).map((node) => node.id));
  const hostEntries = new Map();
  const beats = compiled.beats.map((beat) => {
    const placement = placementByBeatId.get(beat.id);
    for (const characterId of characterIds) {
      characterViews[characterId].entries.push(
        ...expectedCharacterEntries({ artifact, beat, nodeById, characterId }),
      );
    }
    for (const nodeId of [...beat.nodeRefs, ...beat.supportNodeRefs]) {
      if (!publicIds.has(nodeId)) continue;
      const node = nodeById.get(nodeId);
      if (!node) continue;
      const projection = projectFormationNodeForAudience(node, { audienceType: "HOST" });
      const entry = survivalEntry({ artifact, beat, node, projection });
      hostEntries.set(`${entry.artifactId}|${entry.beatId}|${entry.nodeId}`, entry);
    }
    return {
      artifactId: artifact.id,
      artifactRevision: artifactRevisionOf(artifact),
      sourceBlockId: artifact.sourceBlockId,
      beatId: beat.id,
      stageId: placement?.stageId || null,
      order: placement?.order ?? null,
      purpose: beat.purpose,
      requiredNodeRefs: [...beat.requiredNodeRefs],
      optionalNodeRefs: [...beat.optionalNodeRefs],
      nodeRefs: [...beat.nodeRefs],
      requiresBeatIds: [...beat.requiresBeatIds],
      preferredAfterBeatIds: [...beat.preferredAfterBeatIds],
    };
  });

  return {
    version: M12_FORMATION_PROJECTION_SURVIVAL_VERSION,
    sources: [
      {
        artifactId: artifact.id,
        artifactRevision: artifactRevisionOf(artifact),
        sourceBlockId: artifact.sourceBlockId,
        integrationVersion: M12_FORMATION_INTEGRATION_VERSION,
        compilerVersion: M12_FORMATION_BEAT_VERSION,
      },
    ],
    beats,
    characterViews,
    hostView: { entries: [...hostEntries.values()] },
  };
}

function formationViewOf(container, artifactId) {
  const direct = record(container?.formationView);
  if (direct.artifactId === artifactId) return direct;
  if (
    direct.artifactId == null &&
    asArray(direct.sources).some((source) => source?.artifactId === artifactId)
  ) return direct;
  const candidates = asArray(container?.formationViews);
  return candidates.find((view) => {
    const row = record(view);
    return row.artifactId === artifactId || asArray(row.sources).some((source) => source?.artifactId === artifactId);
  }) || null;
}

function actualBeatRefs(view) {
  return asArray(view?.beats || view?.beatRefs || view?.formationBeatRefs);
}

function actualAudienceFacts(view) {
  if (asArray(view?.audienceFacts || view?.facts).length) return asArray(view.audienceFacts || view.facts);
  const facts = [];
  for (const [audienceId, characterView] of Object.entries(record(view?.characterViews))) {
    for (const entry of asArray(characterView?.entries)) {
      facts.push({ ...entry, audienceType: "CHARACTER", audienceId });
    }
  }
  for (const entry of asArray(view?.hostView?.entries)) {
    facts.push({ ...entry, audienceType: "HOST", audienceId: null });
  }
  return facts;
}

function actualFactFor(audienceFacts, audience, nodeId) {
  return audienceFacts.find(
    (fact) =>
      fact?.nodeId === nodeId &&
      String(fact?.audienceType || "CHARACTER") === audience.audienceType &&
      (fact?.audienceId ?? null) === (audience.audienceId ?? null),
  );
}

function allActualFactsForAudience(audienceFacts, audience) {
  return audienceFacts.filter(
    (fact) =>
      String(fact?.audienceType || "CHARACTER") === audience.audienceType &&
      (fact?.audienceId ?? null) === (audience.audienceId ?? null),
  );
}

function expectedFactById(audience) {
  return new Map(
    [...audience.fixedFacts, ...audience.characterKnowledge].map((fact) => [fact.nodeId, fact]),
  );
}

function compareProvenance(actual, expected) {
  const left = record(actual);
  return (
    left.type === expected.type &&
    (left.summary || null) === (expected.summary || null) &&
    sameArray(left.sourceRefs, expected.sourceRefs)
  );
}

function expectedSource(expected) {
  return asArray(expected?.sources)[0] || {};
}

function auditBeatRefs({ expected, view, issues }) {
  if (!view) {
    issues.push(
      issue(
        "FORMATION_BEAT_REFS_MISSING",
        LAYERS.PMD,
        "P6 ProductionMasterDraft 没有 Formation beat ref/placement sidecar；普通 STORY beats 不能替代 Formation Beats",
        { artifactId: expectedSource(expected).artifactId, beatIds: expected.beats.map((beat) => beat.beatId) },
      ),
    );
    return;
  }

  const source = asArray(view.sources).find((row) => row?.artifactId === expectedSource(expected).artifactId);
  if (!source || Number(source.artifactRevision) !== Number(expectedSource(expected).artifactRevision)) {
    issues.push(
      issue(
        "FORMATION_ARTIFACT_REVISION_NOT_SNAPSHOTTED",
        LAYERS.PMD,
        "Formation view 没有绑定当前 Artifact revision，不能证明它消费的是当前 Canon",
        { artifactId: expectedSource(expected).artifactId, expectedRevision: expectedSource(expected).artifactRevision, actualRevision: source?.artifactRevision ?? null },
      ),
    );
  }
  if (Number(source?.integrationVersion) !== Number(expectedSource(expected).integrationVersion)) {
    issues.push(
      issue(
        "FORMATION_INTEGRATION_VERSION_NOT_SNAPSHOTTED",
        LAYERS.PMD,
        "Formation view 没有记录 F4C integration schema version",
        { expected: expectedSource(expected).integrationVersion, actual: source?.integrationVersion ?? null },
      ),
    );
  }
  if (Number(source?.compilerVersion) !== Number(expectedSource(expected).compilerVersion)) {
    issues.push(
      issue(
        "FORMATION_COMPILER_VERSION_NOT_SNAPSHOTTED",
        LAYERS.PMD,
        "Formation view 没有记录 F4B compiler schema version",
        { expected: expectedSource(expected).compilerVersion, actual: source?.compilerVersion ?? null },
      ),
    );
  }

  const actualByBeatId = new Map(actualBeatRefs(view).map((beat) => [beat?.beatId, beat]));
  for (const expectedBeat of expected.beats) {
    const actualBeat = actualByBeatId.get(expectedBeat.beatId);
    if (!actualBeat) {
      issues.push(
        issue(
          "FORMATION_BEAT_REF_NOT_SURVIVED",
          LAYERS.PMD,
          `Formation Beat ${expectedBeat.beatId} 未进入 PMD sidecar，不能由普通 beat 存在推定已保留`,
          { artifactId: expectedSource(expected).artifactId, beatId: expectedBeat.beatId },
        ),
      );
      continue;
    }
    if (Number(actualBeat.artifactRevision) !== expectedBeat.artifactRevision) {
      issues.push(
        issue(
          "FORMATION_BEAT_REF_STALE",
          LAYERS.PMD,
          `Formation Beat ${expectedBeat.beatId} 的 Artifact revision 已过期`,
          { artifactId: expectedSource(expected).artifactId, beatId: expectedBeat.beatId },
        ),
      );
    }
    if (actualBeat.sourceBlockId !== expectedBeat.sourceBlockId) {
      issues.push(
        issue(
          "FORMATION_BEAT_SOURCE_NOT_SURVIVED",
          LAYERS.PMD,
          `Formation Beat ${expectedBeat.beatId} 的 sourceBlockId 未保留`,
          { artifactId: expectedSource(expected).artifactId, beatId: expectedBeat.beatId },
        ),
      );
    }
    if (!sameArray(actualBeat.requiresBeatIds, expectedBeat.requiresBeatIds)) {
      issues.push(
        issue(
          "FORMATION_HARD_CAUSALITY_NOT_SURVIVED",
          LAYERS.PMD,
          `Formation Beat ${expectedBeat.beatId} 的 hard requiresBeatIds 未保留`,
          { artifactId: expectedSource(expected).artifactId, beatId: expectedBeat.beatId },
        ),
      );
    }
    if (!sameArray(actualBeat.preferredAfterBeatIds, expectedBeat.preferredAfterBeatIds)) {
      issues.push(
        issue(
          "FORMATION_SOFT_ORDER_NOT_SURVIVED",
          LAYERS.PMD,
          `Formation Beat ${expectedBeat.beatId} 的 preferredAfterBeatIds 未保留为 soft ordering`,
          { artifactId: expectedSource(expected).artifactId, beatId: expectedBeat.beatId },
        ),
      );
    }
    const required = unique(actualBeat.requiredNodeRefs || actualBeat.requiredDisclosureNodeRefs);
    const optional = new Set(expectedBeat.optionalNodeRefs);
    const optionalAsRequired = required.filter((nodeId) => optional.has(nodeId));
    if (optionalAsRequired.length) {
      issues.push(
        issue(
          "FORMATION_OPTIONAL_DISCLOSURE_ESCALATED",
          LAYERS.PMD,
          `Formation Beat ${expectedBeat.beatId} 把 optional reinforcement 升级成 required disclosure`,
          { artifactId: expectedSource(expected).artifactId, beatId: expectedBeat.beatId, nodeIds: optionalAsRequired },
        ),
      );
    }
  }
}

function auditFactsForAudiences({ expectedAudiences, expected, view, layer, issues }) {
  if (!view) return;
  const actualFacts = actualAudienceFacts(view);
  for (const audience of expectedAudiences) {
    const expectedById = expectedFactById(audience);
    const actualForAudience = allActualFactsForAudience(actualFacts, audience);
    for (const expectedFact of expectedById.values()) {
      const actual = actualFactFor(actualFacts, audience, expectedFact.nodeId);
      if (!actual) {
        issues.push(
          issue(
            "FORMATION_FACT_NOT_SURVIVED",
            layer,
            `${audience.audienceType}${audience.audienceId ? `:${audience.audienceId}` : ""} 缺少 Formation fact ${expectedFact.nodeId}`,
            { artifactId: expectedSource(expected).artifactId, audienceId: audience.audienceId, nodeId: expectedFact.nodeId },
          ),
        );
        continue;
      }
      if (actual.projectionType !== expectedFact.projectionType) {
        issues.push(
          issue(
            "FORMATION_PROJECTION_TYPE_NOT_SURVIVED",
            layer,
            `${expectedFact.nodeId} 的 role-relative projectionType 被改变`,
            { artifactId: expectedSource(expected).artifactId, audienceId: audience.audienceId, nodeId: expectedFact.nodeId, expected: expectedFact.projectionType, actual: actual.projectionType },
          ),
        );
      }
      if (!compareProvenance(actual.provenance, expectedFact.provenance)) {
        issues.push(
          issue(
            "FORMATION_PROVENANCE_NOT_SURVIVED",
            layer,
            `${expectedFact.nodeId} 仍可能存在，但 provenance 已丢失或被改写`,
            { artifactId: expectedSource(expected).artifactId, audienceId: audience.audienceId, nodeId: expectedFact.nodeId },
          ),
        );
      }
      if (expectedFact.kind === "INFERENCE") {
        const status = actual.inferenceStatus || actual.confidence || null;
        if (actual.projectionType !== "ACTIONABLE_INFERENCE" || status !== "ACTIONABLE") {
          issues.push(
            issue(
              "FORMATION_INFERENCE_SEMANTICS_NOT_SURVIVED",
              layer,
              `${expectedFact.nodeId} 的 ACTIONABLE_INFERENCE 被投成确定事实或丢失推断状态`,
              { artifactId: expectedSource(expected).artifactId, audienceId: audience.audienceId, nodeId: expectedFact.nodeId, expected: "ACTIONABLE_INFERENCE/ACTIONABLE", actual: `${actual.projectionType || "(none)"}/${status || "(none)"}` },
            ),
          );
        }
      }
      if (expectedFact.kind === "OBSERVABLE" && actual.projectionType !== "OBSERVED_FACT") {
        issues.push(
          issue(
            "FORMATION_OBSERVABLE_NOT_SURVIVED",
            layer,
            `${expectedFact.nodeId} 的 observable 语义没有保持为 OBSERVED_FACT`,
            { artifactId: expectedSource(expected).artifactId, audienceId: audience.audienceId, nodeId: expectedFact.nodeId },
          ),
        );
      }
    }

    for (const actual of actualForAudience) {
      if (!expectedById.has(actual.nodeId)) {
        issues.push(
          issue(
            "FORMATION_PRIVATE_VISIBILITY_LEAK",
            layer,
            `${audience.audienceType}${audience.audienceId ? `:${audience.audienceId}` : ""} 收到了不应可见的 Formation fact ${actual.nodeId}`,
            { artifactId: expectedSource(expected).artifactId, audienceId: audience.audienceId, nodeId: actual.nodeId },
          ),
        );
      }
    }
  }

  const optionalIds = new Set(
    expected.beats.flatMap((beat) => beat.optionalNodeRefs),
  );
  for (const actual of actualFacts) {
    if (optionalIds.has(actual.nodeId) && actual.required === true) {
      issues.push(
        issue(
          "FORMATION_OPTIONAL_DISCLOSURE_ESCALATED",
          layer,
          `${actual.nodeId} 是 optional reinforcement，却被标成 required disclosure`,
          { artifactId: expectedSource(expected).artifactId, audienceId: actual.audienceId, nodeId: actual.nodeId },
        ),
      );
    }
  }

  const forbiddenOutcomeFields = ["newCanon", "contactOutcome", "dealOutcome", "exchangeOutcome", "bargainOutcome"];
  for (const field of forbiddenOutcomeFields) {
    if (view[field] != null && (typeof view[field] !== "object" || Object.keys(record(view[field])).length > 0 || asArray(view[field]).length > 0)) {
      issues.push(
        issue(
          "FORMATION_NEW_CANON_OR_OUTCOME_CREATED",
          layer,
          `Formation view 不得新增 ${field}`,
          { artifactId: expectedSource(expected).artifactId, field },
        ),
      );
    }
  }
}

/**
 * Audit F4C → P6 → formal Packet. All supplied objects are read-only inputs.
 * If PMD/Packet are omitted, the existing deterministic builders are run.
 */
export function auditM12FormationProjectionSurvival({
  state,
  masterOutlineDraft = null,
  productionMasterDraft = null,
  packetSet = null,
} = {}) {
  const normalizedState = normalizeProjectStoryState(state);
  const outline = normalizeMasterOutlineDraft(masterOutlineDraft || normalizedState.masterOutlineDraft);
  const issues = [];
  const artifacts = asArray(normalizedState.m12FormationArtifacts).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));

  if (!outline) {
    return {
      version: M12_FORMATION_PROJECTION_SURVIVAL_VERSION,
      decision: "FORMATION_PROJECTION_LOSS",
      firstLossLayer: LAYERS.OUTLINE,
      mode: "DETERMINISTIC",
      llmCalls: 0,
      issues: [issue("FORMATION_MASTER_OUTLINE_MISSING", LAYERS.OUTLINE, "缺少 F4C MasterOutlineDraft")],
    };
  }

  const integration = validateFormationIntegration(normalizedState, outline);
  if (!integration.ok) {
    issues.push(issue(integration.code, LAYERS.OUTLINE, integration.message, integration.details));
  }

  const expectedEntries = [];
  for (const artifact of artifacts) {
    const expected = buildM12FormationSurvivalExpectation({
      state: normalizedState,
      artifactId: artifact.id,
      masterOutlineDraft: outline,
    });
    if (!expected) {
      issues.push(
        issue(
          "FORMATION_SURVIVAL_EXPECTATION_UNAVAILABLE",
          LAYERS.OUTLINE,
          `无法从当前 state 编译 ${artifact.id} 的 F4B expectation；不允许把未编译内容算作 survived`,
          { artifactId: artifact.id },
        ),
      );
      continue;
    }
    expectedEntries.push({ artifact, expected });
  }

  let pmd = productionMasterDraft;
  if (!pmd) {
    try {
      pmd = expandProductionMasterDraft(normalizedState);
    } catch (error) {
      issues.push(
        issue(
          "FORMATION_PMD_BUILD_FAILED",
          LAYERS.PMD,
          `现有 P6 Expander 无法生成 PMD：${error.message}`,
          { errorCode: error.code || "UNKNOWN" },
        ),
      );
    }
  }

  let packets = packetSet;
  if (!packets && pmd) packets = buildScriptProductionPacketSet(pmd);

  for (const { artifact, expected } of expectedEntries) {
    const pmdView = formationViewOf(pmd, artifact.id);
    auditBeatRefs({ expected, view: pmdView, issues });

    const expectedAudiences = expectedAudienceFacts(normalizedState, artifact);
    if (!pmdView) {
      issues.push(
        issue(
          "FORMATION_PMD_VIEW_MISSING",
          LAYERS.PMD,
          "PMD 没有 Formation view；因此不能把 Artifact → PMD 的语义链宣称为存活",
          { artifactId: artifact.id },
        ),
      );
    } else {
      auditFactsForAudiences({
        expectedAudiences,
        expected,
        view: pmdView,
        layer: LAYERS.PMD,
        issues,
      });
    }

    const packetContainers = [packets?.host, ...asArray(packets?.roles)].filter(Boolean);
    const packetViewEntries = packetContainers
      .map((container) => ({ container, view: formationViewOf(container, artifact.id) }))
      .filter(({ view }) => Boolean(view));
    if (!packetViewEntries.length) {
      issues.push(
        issue(
          "FORMATION_PACKET_VIEW_MISSING",
          LAYERS.PACKET,
          "正式 view-specific Writer Packet 没有 Formation view；PMD 普通字段完整也不能算 survived",
          { artifactId: artifact.id, packetKinds: packetContainers.filter(Boolean).map((container) => container.kind) },
        ),
      );
    } else {
      for (const { container, view: packetView } of packetViewEntries) {
        const packetAudiences = container.kind === "HOST_SCRIPT"
          ? expectedAudiences.filter((audience) => audience.audienceType === "HOST")
          : expectedAudiences.filter(
              (audience) =>
                audience.audienceType === "CHARACTER" &&
                audience.audienceId === container.characterId,
            );
        auditFactsForAudiences({
          expectedAudiences: packetAudiences,
          expected,
          view: packetView,
          layer: LAYERS.PACKET,
          issues,
        });
      }
    }
  }

  const first = issues[0];
  return {
    version: M12_FORMATION_PROJECTION_SURVIVAL_VERSION,
    decision: issues.length ? "FORMATION_PROJECTION_LOSS" : "FORMATION_PROJECTION_SURVIVED",
    firstLossLayer: first?.layer || null,
    mode: "DETERMINISTIC",
    llmCalls: 0,
    artifactIds: expectedEntries.map(({ artifact }) => artifact.id),
    sourceRevisions: expectedEntries.map(({ artifact }) => ({
      artifactId: artifact.id,
      artifactRevision: artifactRevisionOf(artifact),
      integrationVersion: M12_FORMATION_INTEGRATION_VERSION,
      compilerVersion: M12_FORMATION_BEAT_VERSION,
    })),
    issues,
  };
}
