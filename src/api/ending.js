// Ending Branch Editor — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listEndings(worldId, { limit, offset } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const qs = params.toString();
  return request(`/worlds/${worldId}/endings${qs ? "?" + qs : ""}`);
}

export function getEnding(worldId, id) {
  return request(`/worlds/${worldId}/endings/${id}`);
}

export function createEnding(worldId, body) {
  return worldWrite(`/worlds/${worldId}/endings`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateEnding(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/endings/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteEnding(worldId, id) {
  return worldWrite(`/worlds/${worldId}/endings/${id}`, {
    worldId,
    method: "DELETE"
  });
}