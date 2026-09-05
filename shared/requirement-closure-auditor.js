/**
 * P8.0.5 — Requirement Closure Auditor (read-only).
 * Does not mutate beats, stages, or invent bridges.
 */

import {
  buildBeatPositionIndex,
  bridgesSatisfy,
  factIdOf,
  factsSatisfy,
  normalizeRequirementSourceKind,
  positionIsBefore,
} from "./semantic-fact.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @returns {{
 *   rows: Array<object>,
 *   summary: {
 *     total: number,
 *     storyFact: number,
 *     storyClosed: number,
 *     bridgeClosed: number,
 *     projectPrereq: number,
 *     externalTrigger: number,
 *     unclassified: number,
 *     unsatisfied: number,
 *   }
 * }}
 */
export function auditRequirementClosure({ stages = [], factBridges = [] } = {}) {
  const positions = buildBeatPositionIndex(stages);
  const orderedBeats = [];
  const sortedStages = [...asArray(stages)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const st of sortedStages) {
    for (const beat of st.beats || []) orderedBeats.push(beat);
  }

  const rows = [];
  for (const consumer of orderedBeats) {
    const requires = asArray(consumer.semantics?.requires);
    for (let ri = 0; ri < requires.length; ri += 1) {
      const req = requires[ri];
      const requirementId = factIdOf(req) || `${consumer.id}:req:${ri}`;
      const sourceKind = normalizeRequirementSourceKind(req.sourceKind);
      const base = {
        beatId: consumer.id,
        requirementId,
        factType: req.factType || req.kind,
        sourceKind: sourceKind || null,
      };

      if (!sourceKind) {
        rows.push({ ...base, status: "UNCLASSIFIED" });
        continue;
      }

      if (sourceKind === "PROJECT_PREREQ") {
        rows.push({ ...base, status: "DECLARED_PROJECT_PREREQ" });
        continue;
      }
      if (sourceKind === "EXTERNAL_TRIGGER") {
        rows.push({ ...base, status: "DECLARED_EXTERNAL_TRIGGER" });
        continue;
      }

      // STORY_FACT
      let closed = null;
      const cPos = positions.get(consumer.id);
      for (const producer of orderedBeats) {
        if (producer.id === consumer.id) continue;
        const pPos = positions.get(producer.id);
        if (!positionIsBefore(pPos, cPos)) continue;
        for (const prod of asArray(producer.semantics?.produces)) {
          if (factsSatisfy(prod, req)) {
            closed = {
              ...base,
              status: "CLOSED_BY_STORY_FACT",
              producerBeatId: producer.id,
            };
            break;
          }
          if (bridgesSatisfy(factBridges, factIdOf(prod), factIdOf(req))) {
            const bridge = asArray(factBridges).find(
              (b) =>
                b?.status === "ACCEPTED" &&
                b.fromFactId === factIdOf(prod) &&
                b.toRequirementId === factIdOf(req),
            );
            closed = {
              ...base,
              status: "CLOSED_BY_FACT_BRIDGE",
              producerBeatId: producer.id,
              bridgeId: bridge?.id,
            };
            break;
          }
        }
        if (closed) break;
      }

      rows.push(closed || { ...base, status: "UNSATISFIED" });
    }
  }

  const summary = {
    total: rows.length,
    storyFact: rows.filter((r) => r.sourceKind === "STORY_FACT").length,
    storyClosed: rows.filter((r) => r.status === "CLOSED_BY_STORY_FACT").length,
    bridgeClosed: rows.filter((r) => r.status === "CLOSED_BY_FACT_BRIDGE").length,
    projectPrereq: rows.filter((r) => r.status === "DECLARED_PROJECT_PREREQ").length,
    externalTrigger: rows.filter((r) => r.status === "DECLARED_EXTERNAL_TRIGGER").length,
    unclassified: rows.filter((r) => r.status === "UNCLASSIFIED").length,
    unsatisfied: rows.filter((r) => r.status === "UNSATISFIED").length,
  };

  return { rows, summary };
}

/** Scan COMPLETE template data: every require must declare sourceKind. */
export function auditCompleteTemplateRequirementSources(completeSemantics) {
  const missing = [];
  for (const [templateId, bridge] of Object.entries(completeSemantics || {})) {
    for (const [phaseKey, phase] of Object.entries(bridge?.phases || {})) {
      for (const req of asArray(phase?.requires)) {
        if (typeof req === "string" || !normalizeRequirementSourceKind(req?.sourceKind)) {
          missing.push({
            templateId,
            phase: phaseKey,
            requirement: typeof req === "string" ? req : req?.id || req?.kind || req?.factType,
          });
        }
      }
    }
  }
  return { ok: missing.length === 0, missing };
}
