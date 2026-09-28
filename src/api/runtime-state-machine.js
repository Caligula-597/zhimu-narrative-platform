// Runtime State Machine + Host Exception Remediation — frontend API wrapper (缺口 M)

import { request, worldWrite } from "./client.js";

export function listRuntimeStateMachines(worldId) {
  return request(`/worlds/${worldId}/runtime-state-machines`);
}

export function getRuntimeStateMachine(worldId, id) {
  return request(`/worlds/${worldId}/runtime-state-machines/${id}`);
}

export function createRuntimeStateMachine(worldId, body) {
  return worldWrite(`/worlds/${worldId}/runtime-state-machines`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateRuntimeStateMachine(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/runtime-state-machines/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteRuntimeStateMachine(worldId, id) {
  return worldWrite(`/worlds/${worldId}/runtime-state-machines/${id}`, {
    worldId,
    method: "DELETE"
  });
}