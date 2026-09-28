// Historical Causality Table — frontend API wrapper (缺口 H)

import { request, worldWrite } from "./client.js";

export function listHistoryCausalLinks(worldId) {
  return request(`/worlds/${worldId}/history-causal-links`);
}

export function getHistoryCausalLink(worldId, id) {
  return request(`/worlds/${worldId}/history-causal-links/${id}`);
}

export function createHistoryCausalLink(worldId, body) {
  return worldWrite(`/worlds/${worldId}/history-causal-links`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateHistoryCausalLink(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/history-causal-links/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteHistoryCausalLink(worldId, id) {
  return worldWrite(`/worlds/${worldId}/history-causal-links/${id}`, {
    worldId,
    method: "DELETE"
  });
}