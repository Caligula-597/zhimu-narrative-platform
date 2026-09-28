// Relationship Arc Editor — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listRelationshipArcs(worldId, { limit, offset } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (offset) params.set("offset", String(offset));
  const qs = params.toString();
  return request(`/worlds/${worldId}/relationship-arcs${qs ? "?" + qs : ""}`);
}

export function getRelationshipArc(worldId, id) {
  return request(`/worlds/${worldId}/relationship-arcs/${id}`);
}

export function createRelationshipArc(worldId, body) {
  return worldWrite(`/worlds/${worldId}/relationship-arcs`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateRelationshipArc(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/relationship-arcs/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteRelationshipArc(worldId, id) {
  return worldWrite(`/worlds/${worldId}/relationship-arcs/${id}`, {
    worldId,
    method: "DELETE"
  });
}