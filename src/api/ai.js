/**
 * AI / Story Assistant domain — DeepSeek pipeline, story draft, full-mystery generation.
 */
import {
  PIPELINE_IMPORT_TIMEOUT_MS,
  deepseekRequest,
  demoContext,
  request,
  worldWrite
} from "./client.js";

export function analyzeStoryDraft(text) {
  return request(`/worlds/${demoContext.worldId}/story-assistant/analyze`, { userId: demoContext.hostUserId, method: "POST", body: { text } });
}

export function importStoryDraft(text) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-assistant/import`, { method: "POST", body: { text } });
}

export function getDeepseekStatus() {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/status`, { userId: demoContext.hostUserId });
}

export function proposeWithDeepseek(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function importDeepseekProposal(proposal) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-assistant/deepseek/import`, {
    method: "POST",
    body: { proposal },
    timeoutMs: PIPELINE_IMPORT_TIMEOUT_MS,
    idempotent: true
  });
}

export function deepseekPipelineSpec(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/spec`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineOutline(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/outline`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineStructure(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/structure`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineRoleMatrix(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/role-matrix`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineSection(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/section`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineManuscriptSynopsis(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/manuscript-synopsis`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function importDeepseekPipeline(pipeline) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/import`, {
    method: "POST",
    body: { pipeline },
    timeoutMs: PIPELINE_IMPORT_TIMEOUT_MS,
    idempotent: true
  });
}

export function deepseekPipelineEvaluate(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/evaluate`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: 240_000
  });
}

export function deepseekPipelineMatrixTruth(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/matrix/truth`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 240_000 });
}

export function deepseekPipelineMatrixCharacters(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/matrix/characters`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 240_000 });
}

export function deepseekPipelineMatrixInfoMatrix(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/matrix/info-matrix`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 240_000 });
}

export function deepseekPipelineMatrixHostRunbook(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/matrix/host-runbook`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 180_000 });
}

export function deepseekPipelineMatrixPlayerScript(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/matrix/player-script`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: 240_000
  });
}

export function deepseekPipelineMatrixEvaluate(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/matrix/evaluate`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 240_000 });
}

export function deepseekPipelineMatrixSyncPreview(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/matrix/sync-preview`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 120_000 });
}

export function deepseekPipelineNarrativeChapter(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/chapter`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineNarrativeRolesMeta(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/roles-meta`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineNarrativeRoleScript(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/role-script`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: payload?.chapterKey ? 180_000 : 420_000
  });
}

export function deepseekPipelineNarrativeRoles(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/roles`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function deepseekPipelineNarrativeExtractStructure(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/extract-structure`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function proposeFullMysteryWithDeepseek(payload) {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/full-mystery/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 600_000 });
}

export function importFullMysteryWithDeepseek(mystery) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-assistant/deepseek/full-mystery/import`, { method: "POST", body: { mystery } });
}
