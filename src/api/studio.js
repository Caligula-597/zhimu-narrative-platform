/**
 * Studio domain — scene/clue/item/investigation-point/story-graph operations.
 * All world-write calls go through worldWrite to track content revisions.
 */
import { demoContext, request, worldWrite } from "./client.js";

export function getStudio() {
  return request(`/worlds/${demoContext.worldId}/studio`, { userId: demoContext.hostUserId });
}

export function createScene(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/scenes`, { method: "POST", body: payload });
}

export function updateScene(sceneId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/scenes/${sceneId}`, { body: payload });
}

export function createClue(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/clues`, { method: "POST", body: payload });
}

export function updateClue(clueId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/clues/${clueId}`, { body: payload });
}

export function bindCluePaths(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/clues/bind-paths`, {
    method: "POST",
    body: payload
  });
}

export function createItem(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/items`, { method: "POST", body: payload });
}

export function updateItem(itemId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/items/${itemId}`, { body: payload });
}

export function deleteItem(itemId) {
  return worldWrite(`/worlds/${demoContext.worldId}/items/${itemId}`, { method: "DELETE" });
}

export function createInvestigationPoint(sceneId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/scenes/${sceneId}/investigation-points`, { method: "POST", body: payload });
}

export function updateInvestigationPoint(pointId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/investigation-points/${pointId}`, { body: payload });
}

export function getStudioNodeReferences(nodeType, nodeId) {
  return request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/references`, { userId: demoContext.hostUserId });
}

export function createStudioChapter(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/chapters`, { method: "POST", body: payload });
}

export function createStoryEdge(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-edges`, { method: "POST", body: payload });
}

export function deleteStoryEdge(edgeId) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-edges/${edgeId}`, { method: "DELETE" });
}

export function deleteStudioNode(nodeType, nodeId) {
  return worldWrite(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}`, { method: "DELETE" });
}

export function updateStudioNodePosition(nodeType, nodeId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/position`, { method: "PUT", body: payload });
}

export function updateStudioNodeAnchors(nodeType, nodeId, anchors) {
  return worldWrite(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/anchors`, { method: "PUT", body: { anchors } });
}

export function updateStoryLayout(positions) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-layout`, { method: "PUT", body: { positions } });
}

export function autoStoryLayout(mode = "scene-tree") {
  return worldWrite(`/worlds/${demoContext.worldId}/story-layout/auto`, { method: "POST", body: { mode } });
}
