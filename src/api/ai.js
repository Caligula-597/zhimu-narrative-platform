/**
 * Murder-mystery author assistance: structure extract and playtest.
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

