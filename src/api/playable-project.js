// PlayableProject — P7.0 compile asset persistence

import { request, worldWrite } from "./client.js";

export function getPlayableProject(worldId) {
  return request(`/worlds/${worldId}/playable-project`);
}

export function savePlayableProject(worldId, project) {
  return worldWrite(`/worlds/${worldId}/playable-project`, {
    worldId,
    method: "PUT",
    body: { project },
  });
}

export function compilePlayableFixture(worldId, body = {}) {
  return worldWrite(`/worlds/${worldId}/playable-project/compile-fixture`, {
    worldId,
    method: "POST",
    body,
  });
}
