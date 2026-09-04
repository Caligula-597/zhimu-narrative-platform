// ProjectStoryState — STORY mechanism basket persistence

import { request, worldWrite } from "./client.js";

export function getProjectStoryState(worldId) {
  return request(`/worlds/${worldId}/project-story-state`);
}

export function saveProjectStoryState(worldId, state) {
  return worldWrite(`/worlds/${worldId}/project-story-state`, {
    worldId,
    method: "PUT",
    body: { state },
  });
}
