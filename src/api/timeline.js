// Timeline Editor — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listTimelineEntries(worldId, { actId, parallelLine, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (actId) params.set("actId", actId);
  if (parallelLine !== undefined) params.set("parallelLine", String(parallelLine));
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const qs = params.toString();
  return request(`/worlds/${worldId}/timeline${qs ? "?" + qs : ""}`);
}

export function getTimelineEntry(worldId, entryId) {
  return request(`/worlds/${worldId}/timeline/${entryId}`);
}

export function createTimelineEntry(worldId, body) {
  return worldWrite(`/worlds/${worldId}/timeline`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateTimelineEntry(worldId, entryId, body) {
  return worldWrite(`/worlds/${worldId}/timeline/${entryId}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteTimelineEntry(worldId, entryId) {
  return worldWrite(`/worlds/${worldId}/timeline/${entryId}`, {
    worldId,
    method: "DELETE"
  });
}

export function batchUpdateTimeline(worldId, entries) {
  return worldWrite(`/worlds/${worldId}/timeline/batch`, {
    worldId,
    method: "PATCH",
    body: { entries }
  });
}