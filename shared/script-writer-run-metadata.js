/**
 * P9.3 WriterRunMetadata + input/output fingerprints.
 * Metadata is not Canon — lives on section generation records only.
 */

import { createHash } from "node:crypto";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value, maximum = 200) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120).replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

export function stableJsonFingerprint(value) {
  const json = JSON.stringify(value, Object.keys(record(value)).sort?.() ? undefined : undefined);
  // Deterministic stringify via sorted walk
  return createHash("sha256").update(canonicalStringify(value)).digest("hex").slice(0, 32);
}

function canonicalStringify(value) {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(",")}}`;
}

export function buildWriterInputFingerprint({
  packet = null,
  writerProfileId = null,
  promptVersion = null,
  contextRevision = null,
  gameNarrativeRevision = null,
} = {}) {
  return stableJsonFingerprint({
    packet,
    writerProfileId,
    promptVersion,
    contextRevision: contextRevision ?? null,
    gameNarrativeRevision: gameNarrativeRevision ?? null,
  });
}

export function buildWriterOutputFingerprint(result = null) {
  return stableJsonFingerprint({
    sections: record(result).sections || [],
    proposedCanonicalChanges: record(result).proposedCanonicalChanges || [],
  });
}

export function normalizeWriterRunMetadata(value = {}) {
  const src = record(value);
  return {
    writerProfileId: cleanId(src.writerProfileId) || null,
    providerAdapterId: cleanId(src.providerAdapterId) || null,
    modelId: cleanText(src.modelId, 80) || null,
    promptVersion: cleanText(src.promptVersion, 40) || null,
    requestId: cleanId(src.requestId) || null,
    startedAt: src.startedAt != null ? String(src.startedAt) : null,
    completedAt: src.completedAt != null ? String(src.completedAt) : null,
    inputFingerprint: cleanText(src.inputFingerprint, 64) || null,
    outputFingerprint: cleanText(src.outputFingerprint, 64) || null,
    attemptCount: Math.max(1, Math.trunc(Number(src.attemptCount) || 1)),
    formatRepairUsed: Boolean(src.formatRepairUsed),
    regeneration: Boolean(src.regeneration),
  };
}
