// Economic System Editor — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listEconRecords(worldId) {
  return request(`/worlds/${worldId}/econ-records`);
}

export function getEconRecord(worldId, id) {
  return request(`/worlds/${worldId}/econ-records/${id}`);
}

export function createEconRecord(worldId, body) {
  return worldWrite(`/worlds/${worldId}/econ-records`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateEconRecord(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/econ-records/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteEconRecord(worldId, id) {
  return worldWrite(`/worlds/${worldId}/econ-records/${id}`, {
    worldId,
    method: "DELETE"
  });
}