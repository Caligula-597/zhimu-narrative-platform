/**
 * Murder-mystery author assistance: structure extract, playtest, V6 world engine.
 */
import {
  deepseekRequest,
  demoContext,
  request,
  worldWrite
} from "./client.js";

export function analyzeStoryDraft(text, { worldId = demoContext.worldId } = {}) {
  return request(`/worlds/${worldId}/story-assistant/analyze`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: { text }
  });
}

export function importStoryDraft(text, { worldId = demoContext.worldId, idempotencyKey } = {}) {
  return worldWrite(`/worlds/${worldId}/story-assistant/import`, {
    worldId,
    method: "POST",
    body: { text },
    idempotent: Boolean(idempotencyKey),
    idempotencyKey
  });
}

export function getDeepseekStatus() {
  return deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/status`, { userId: demoContext.hostUserId });
}

export function runAiPlaytest(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/story-assistant/ai-playtest/run`, {
    worldId,
    method: "POST",
    body: payload,
    timeoutMs: 600_000,
    idempotent: true
  });
}

export function getWorldEngine(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/world-engine`, { userId: demoContext.hostUserId });
}

export function seedWorldEngine(body, { worldId = demoContext.worldId } = {}) {
  return worldWrite(`/worlds/${worldId}/world-engine/seed`, {
    worldId,
    method: "PUT",
    body
  });
}

export function searchWorldEngineEvents({ worldId = demoContext.worldId } = {}) {
  return deepseekRequest(`/worlds/${worldId}/world-engine/search`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: {},
    timeoutMs: 180_000
  });
}

export function commitWorldEngineEvents(body, { worldId = demoContext.worldId } = {}) {
  return worldWrite(`/worlds/${worldId}/world-engine/commit`, {
    worldId,
    method: "POST",
    body
  });
}

export function lowerWorldEngineType(actionType, { worldId = demoContext.worldId } = {}) {
  return worldWrite(`/worlds/${worldId}/world-engine/lower-type`, {
    worldId,
    method: "POST",
    body: { actionType }
  });
}

export function searchWorldEngineEpistemic({ worldId = demoContext.worldId } = {}) {
  return deepseekRequest(`/worlds/${worldId}/world-engine/epistemic/search`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: {},
    timeoutMs: 180_000
  });
}

export function commitWorldEngineEpistemic(indexes, { worldId = demoContext.worldId } = {}) {
  return worldWrite(`/worlds/${worldId}/world-engine/epistemic/commit`, {
    worldId,
    method: "POST",
    body: { indexes }
  });
}

export function renderWorldEngineScript(body, { worldId = demoContext.worldId } = {}) {
  return deepseekRequest(`/worlds/${worldId}/world-engine/render`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body,
    timeoutMs: 180_000
  });
}

export function repairWorldEngineScript(body, { worldId = demoContext.worldId } = {}) {
  return worldWrite(`/worlds/${worldId}/world-engine/repair`, {
    worldId,
    method: "POST",
    body
  });
}
