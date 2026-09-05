/**
 * P8.2.1 ScriptWriterResult contracts — structured sections + proposed canon only.
 */

import { normalizeWriterRunMetadata } from "./script-writer-run-metadata.js";

export const PACKET_KINDS = Object.freeze([
  "HOST_SCRIPT",
  "ROLE_SCRIPT",
  "CLUE_WRITER",
  "PUBLIC_STAGE",
  "ENDING",
]);

export const WRITER_CONSTRAINTS = Object.freeze({
  mayAddCanonicalFacts: false,
  mayAddCharacters: false,
  mayAddStages: false,
  mayChangeTruth: false,
  mayChangeClueSemantics: false,
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 2000) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120).replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

export function normalizeCanonicalClaim(value = {}) {
  const src = record(value);
  return {
    claimId: cleanId(src.claimId) || undefined,
    type: cleanText(src.type, 40) || undefined,
    factId: cleanId(src.factId) || undefined,
    beatId: cleanId(src.beatId) || undefined,
    clueId: cleanId(src.clueId) || undefined,
    summary: cleanText(src.summary, 400) || undefined,
  };
}

export function normalizeProposedCanonicalChange(value = {}) {
  const src = record(value);
  return {
    type: cleanText(src.type, 40) || "ADD_FACT",
    summary: cleanText(src.summary, 400),
    reason: cleanText(src.reason, 400) || undefined,
    sourceSectionId: cleanId(src.sourceSectionId) || undefined,
    factId: cleanId(src.factId) || undefined,
  };
}

export function normalizeGeneratedScriptSection(value = {}) {
  const src = record(value);
  const provenance = record(src.provenance);
  return {
    sectionId: cleanId(src.sectionId) || `sec-${Math.random().toString(36).slice(2, 8)}`,
    stageId: cleanId(src.stageId),
    title: cleanText(src.title, 160) || "段落",
    paragraphs: asArray(src.paragraphs).map((p) => cleanText(p, 2000)).filter(Boolean),
    provenance: {
      sourceBeatIds: asArray(provenance.sourceBeatIds).map(String).filter(Boolean),
      sourceClueIds: asArray(provenance.sourceClueIds).map(String).filter(Boolean),
      sourceFactIds: asArray(provenance.sourceFactIds).map(String).filter(Boolean),
    },
    canonicalClaims: asArray(src.canonicalClaims).map(normalizeCanonicalClaim),
    /** Optional: clue writer attempting to echo locked fields — validated by diff */
    clueSemanticsPatch: src.clueSemanticsPatch ? record(src.clueSemanticsPatch) : undefined,
    inventedCharacterIds: asArray(src.inventedCharacterIds).map(String),
    inventedStageIds: asArray(src.inventedStageIds).map(String),
  };
}

export function normalizeScriptWriterResult(value = {}) {
  const src = record(value);
  const packetKind = PACKET_KINDS.includes(src.packetKind) ? src.packetKind : String(src.packetKind || "");
  return {
    requestId: cleanId(src.requestId) || "req",
    packetKind,
    sections: asArray(src.sections).map(normalizeGeneratedScriptSection),
    proposedCanonicalChanges: asArray(src.proposedCanonicalChanges).map(
      normalizeProposedCanonicalChange,
    ),
    diagnostics: asArray(src.diagnostics).map((d) => ({
      code: cleanText(record(d).code, 80),
      message: cleanText(record(d).message, 400),
      severity: cleanText(record(d).severity, 20) || "info",
    })),
    /** P9.3 — generation metadata (not Canon) */
    writerRunMetadata:
      src.writerRunMetadata != null ? normalizeWriterRunMetadata(src.writerRunMetadata) : undefined,
  };
}

export function buildScriptWriterRequest({ requestId, packetKind, packet }) {
  return {
    requestId: cleanId(requestId) || `req-${Date.now().toString(36)}`,
    packetKind: packetKind || packet?.kind,
    packet,
    constraints: { ...WRITER_CONSTRAINTS },
  };
}
