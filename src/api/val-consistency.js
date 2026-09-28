// Val Consistency Ledger — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listValRecords(worldId) {
  return request(`/worlds/${worldId}/val-records`);
}

export function getValRecord(worldId, id) {
  return request(`/worlds/${worldId}/val-records/${id}`);
}

export function createValRecord(worldId, body) {
  return worldWrite(`/worlds/${worldId}/val-records`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateValRecord(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/val-records/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteValRecord(worldId, id) {
  return worldWrite(`/worlds/${worldId}/val-records/${id}`, {
    worldId,
    method: "DELETE"
  });
}