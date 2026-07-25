import { throwErr } from "./api-errors.js";
import { STUDIO_LAYOUT_MODES, computeStoryLayout } from "./studio-layout.js";
import { deleteWorldChapter, buildWorldSnapshot } from "./routes/world-helpers.js";
import {
  deleteStoryEdge as deleteStoryEdgeRecord,
  deleteStudioEntity,
  readStudioNodeReferences,
  saveStudioLayoutPositions,
  supportsStudioAnchor,
  supportsStudioNode,
  supportsStudioPosition,
  updateStudioNodeAnchors,
  updateStudioNodePosition
} from "./repositories/studio-graph-repository.js";
import { assertRuntimeObjectDeletionAllowed } from "./runtime-release-guard.js";

const RELEASE_NODE_FIELDS = Object.freeze({
  chapter: "chapters",
  scene: "scenes",
  clue: "clues",
  investigation_point: "investigationPoints",
  item: "items"
});

export async function getStudioNodeReferences(worldId, nodeType, nodeId) {
  if (!supportsStudioNode(nodeType)) throwErr("NODE_TYPE_UNSUPPORTED");
  const row = await readStudioNodeReferences(worldId, nodeType, nodeId);
  if (!row?.exists) throwErr("STUDIO_NODE_NOT_FOUND");
  const references = {
    edgeCount: Number(row.edge_count || 0),
    sceneCount: Number(row.scene_count || 0),
    sectionCount: Number(row.section_count || 0),
    investigationPointCount: Number(row.investigation_point_count || 0),
    clueGrantCount: Number(row.clue_grant_count || 0),
    requiredItemCount: Number(row.required_item_count || 0),
    ruleReferenceCount: Number(row.rule_reference_count || 0)
  };
  return {
    ...references,
    totalReferences: Object.values(references).reduce((sum, value) => sum + value, 0)
  };
}

export async function removeStoryEdge(client, worldId, edgeId) {
  await assertRuntimeObjectDeletionAllowed(client, {
    worldId,
    field: "edges",
    objectId: edgeId
  });
  const removed = await deleteStoryEdgeRecord(client, worldId, edgeId);
  if (!removed) throwErr("STORY_EDGE_NOT_FOUND");
  return { ok: true };
}

export async function removeStudioNode(client, worldId, nodeType, nodeId) {
  if (!supportsStudioNode(nodeType)) throwErr("NODE_TYPE_UNSUPPORTED");
  await assertRuntimeObjectDeletionAllowed(client, {
    worldId,
    field: RELEASE_NODE_FIELDS[nodeType],
    objectId: nodeId
  });
  const removed = nodeType === "chapter"
    ? await deleteWorldChapter(client, worldId, nodeId)
    : await deleteStudioEntity(client, worldId, nodeType, nodeId);
  if (!removed) throwErr("STUDIO_NODE_NOT_FOUND");
  return { ok: true };
}

export async function setStudioNodePosition(client, worldId, nodeType, nodeId, { x, y }) {
  if (!supportsStudioPosition(nodeType)) throwErr("NODE_TYPE_DRAG_UNSUPPORTED");
  const updated = await updateStudioNodePosition(client, worldId, nodeType, nodeId, {
    x: Math.round(x),
    y: Math.round(y)
  });
  if (!updated) throwErr("STUDIO_NODE_NOT_FOUND");
  return updated;
}

export async function setStudioNodeAnchors(client, worldId, nodeType, nodeId, anchors = []) {
  if (!supportsStudioAnchor(nodeType)) throwErr("NODE_TYPE_DRAG_UNSUPPORTED");
  const normalized = anchors.map((anchor) => {
    if (!anchor?.id || typeof anchor.id !== "string" || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
      throwErr("ANCHOR_FIELDS_INVALID");
    }
    return {
      id: anchor.id.slice(0, 80),
      x: Math.round(Math.max(0, Math.min(156, anchor.x))),
      y: Math.round(Math.max(0, Math.min(124, anchor.y)))
    };
  });
  const updated = await updateStudioNodeAnchors(client, worldId, nodeType, nodeId, normalized);
  if (!updated) throwErr("STUDIO_NODE_NOT_FOUND");
  return updated;
}

export async function setStoryLayout(client, worldId, positions = []) {
  await saveStudioLayoutPositions(client, worldId, positions);
  return { ok: true, updated: positions.length };
}

export async function autoLayoutStory(client, worldId, mode = "scene-tree") {
  const snapshot = await buildWorldSnapshot(worldId, client);
  const positions = computeStoryLayout(snapshot, mode);
  await saveStudioLayoutPositions(client, worldId, positions);
  const preset = STUDIO_LAYOUT_MODES[mode];
  return {
    ok: true,
    mode,
    label: preset?.label ?? mode,
    updated: positions.length,
    positions
  };
}
