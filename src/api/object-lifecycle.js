// Object Lifecycle Editor — frontend API wrapper

import { request, worldWrite } from "./client.js";

export function listObjectLifecycles(worldId) {
  return request(`/worlds/${worldId}/object-lifecycles`);
}

export function getObjectLifecycle(worldId, id) {
  return request(`/worlds/${worldId}/object-lifecycles/${id}`);
}

export function createObjectLifecycle(worldId, body) {
  return worldWrite(`/worlds/${worldId}/object-lifecycles`, {
    worldId,
    method: "POST",
    body
  });
}

export function updateObjectLifecycle(worldId, id, body) {
  return worldWrite(`/worlds/${worldId}/object-lifecycles/${id}`, {
    worldId,
    method: "PATCH",
    body
  });
}

export function deleteObjectLifecycle(worldId, id) {
  return worldWrite(`/worlds/${worldId}/object-lifecycles/${id}`, {
    worldId,
    method: "DELETE"
  });
}