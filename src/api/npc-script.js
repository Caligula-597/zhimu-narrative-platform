// NPC Script Editor — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listNpcs(worldId) {
  return request(`/worlds/${worldId}/npcs`);
}

export function getNpc(worldId, id) {
  return request(`/worlds/${worldId}/npcs/${id}`);
}

export function createNpc(worldId, body) {
  return worldWrite(`/worlds/${worldId}/npcs`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateNpc(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/npcs/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteNpc(worldId, id) {
  return worldWrite(`/worlds/${worldId}/npcs/${id}`, {
    worldId,
    method: "DELETE"
  });
}