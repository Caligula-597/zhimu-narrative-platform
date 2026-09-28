// Host Manual Compiler — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function getHostManual(worldId, { version } = {}) {
  if (version) return request(`/worlds/${worldId}/host-manual/versions/${version}`);
  return request(`/worlds/${worldId}/host-manual`);
}

export function listHostManualVersions(worldId) {
  return request(`/worlds/${worldId}/host-manual/versions`);
}

export function compileHostManual(worldId) {
  return worldWrite(`/worlds/${worldId}/host-manual/compile`, {
    worldId,
    method: "POST"
  });
}

export function updateHostManualSection(worldId, sectionId, body) {
  return worldWrite(`/worlds/${worldId}/host-manual/sections/${sectionId}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function addHostManualSection(worldId, body) {
  return worldWrite(`/worlds/${worldId}/host-manual/sections`, {
    worldId,
    method: "POST",
    body
  });
}

export function deleteHostManualSection(worldId, sectionId) {
  return worldWrite(`/worlds/${worldId}/host-manual/sections/${sectionId}`, {
    worldId,
    method: "DELETE"
  });
}