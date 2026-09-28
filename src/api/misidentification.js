// Misidentification Editor — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listMisidentifications(worldId, { actId, isActive, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (actId) params.set("actId", actId);
  if (isActive !== undefined && isActive !== "") params.set("isActive", String(isActive));
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const qs = params.toString();
  return request(`/worlds/${worldId}/misidentifications${qs ? "?" + qs : ""}`);
}

export function getMisidentification(worldId, id) {
  return request(`/worlds/${worldId}/misidentifications/${id}`);
}

export function createMisidentification(worldId, body) {
  return worldWrite(`/worlds/${worldId}/misidentifications`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateMisidentification(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/misidentifications/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteMisidentification(worldId, id) {
  return worldWrite(`/worlds/${worldId}/misidentifications/${id}`, {
    worldId,
    method: "DELETE"
  });
}