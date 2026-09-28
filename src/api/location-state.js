// Location / Scene-State Enhancement — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listLocLocations(worldId) {
  return request(`/worlds/${worldId}/loc-locations`);
}

export function getLocLocation(worldId, id) {
  return request(`/worlds/${worldId}/loc-locations/${id}`);
}

export function createLocLocation(worldId, body) {
  return worldWrite(`/worlds/${worldId}/loc-locations`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateLocLocation(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/loc-locations/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteLocLocation(worldId, id) {
  return worldWrite(`/worlds/${worldId}/loc-locations/${id}`, {
    worldId,
    method: "DELETE"
  });
}