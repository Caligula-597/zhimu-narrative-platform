import { throwErr } from "./api-errors.js";
import { buildStudioSceneOwnership, sortSceneChildNodes } from "./studio-scene-tree.js";

/** @typedef {"scene-tree"|"columns"|"flow-horizontal"|"flow-vertical"|"chapter-groups"} StudioLayoutMode */

export const STUDIO_LAYOUT_MODES = Object.freeze({
  "scene-tree": {
    id: "scene-tree",
    label: "场景分支（推荐）",
    description: "线索、调查点、物品归到所属场景下，避免与场景卡片重叠"
  },
  columns: {
    id: "columns",
    label: "分栏板式",
    description: "按节点类型分列排布，适合快速总览全部节点"
  },
  "flow-horizontal": {
    id: "flow-horizontal",
    label: "横向流程",
    description: "沿剧情连线从左到右分层，适合展示主线推进顺序"
  },
  "flow-vertical": {
    id: "flow-vertical",
    label: "纵向流程",
    description: "沿剧情连线从上到下分层，适合长剧本纵向浏览"
  },
  "chapter-groups": {
    id: "chapter-groups",
    label: "章节分组",
    description: "按公共章节分行，场景与调查点归组到对应章节下"
  }
});

const TYPE_ORDER = ["chapter", "scene", "investigation_point", "clue", "item"];
const COLUMN_X = Object.freeze({
  chapter: 40,
  scene: 240,
  investigation_point: 480,
  clue: 720,
  item: 920
});
const ROW_GAP = Object.freeze({ chapter: 118, default: 148 });
const PAD = 40;
const LAYER_STEP_X = 220;
const LAYER_STEP_Y = 156;
const CHILD_STEP_Y = 136;
const CANVAS = Object.freeze({ maxX: 980, maxY: 2400 });

function nodeKey(type, id) {
  return `${type}:${id}`;
}

function clampPosition(x, y) {
  return {
    x: Math.round(Math.max(16, Math.min(CANVAS.maxX, x))),
    y: Math.round(Math.max(16, Math.min(CANVAS.maxY, y)))
  };
}

function clampPositions(positions) {
  return positions.map((entry) => {
    const { x, y } = clampPosition(entry.x, entry.y);
    return { type: entry.type, id: entry.id, x, y };
  });
}

/** @param {{ chapters?: object[], scenes?: object[], clues?: object[], investigationPoints?: object[], items?: object[], edges?: object[] }} snapshot */
export function collectStudioLayoutNodes(snapshot) {
  const nodes = [];
  for (const chapter of snapshot.chapters ?? []) {
    nodes.push({
      type: "chapter",
      id: chapter.id,
      label: chapter.title,
      sequence: chapter.sequence ?? 0,
      chapterId: chapter.id,
      sceneId: null
    });
  }
  for (const scene of snapshot.scenes ?? []) {
    nodes.push({
      type: "scene",
      id: scene.id,
      label: scene.name,
      sequence: 0,
      chapterId: scene.chapter_id ?? null,
      sceneId: scene.id
    });
  }
  for (const point of snapshot.investigationPoints ?? []) {
    nodes.push({
      type: "investigation_point",
      id: point.id,
      label: point.name,
      sequence: point.sequence ?? 0,
      chapterId: null,
      sceneId: point.scene_id ?? null
    });
  }
  for (const clue of snapshot.clues ?? []) {
    nodes.push({
      type: "clue",
      id: clue.id,
      label: clue.name,
      sequence: 0,
      chapterId: null,
      sceneId: null
    });
  }
  for (const item of snapshot.items ?? []) {
    nodes.push({
      type: "item",
      id: item.id,
      label: item.name,
      sequence: 0,
      chapterId: null,
      sceneId: null
    });
  }
  return nodes;
}

function layoutColumns(nodes) {
  const grouped = Object.fromEntries(TYPE_ORDER.map((type) => [type, []]));
  for (const node of nodes) {
    if (grouped[node.type]) grouped[node.type].push(node);
  }
  grouped.chapter.sort((a, b) => a.sequence - b.sequence || a.label.localeCompare(b.label, "zh"));
  for (const type of TYPE_ORDER) {
    if (type === "chapter") continue;
    grouped[type].sort((a, b) => a.label.localeCompare(b.label, "zh"));
  }

  const positions = [];
  for (const type of TYPE_ORDER) {
    const gap = ROW_GAP[type] ?? ROW_GAP.default;
    grouped[type].forEach((node, index) => {
      positions.push({
        type: node.type,
        id: node.id,
        x: COLUMN_X[type],
        y: PAD + index * gap
      });
    });
  }
  return clampPositions(positions);
}

function layoutFlow(nodes, edges, horizontal) {
  const keys = new Set(nodes.map((node) => nodeKey(node.type, node.id)));
  if (!keys.size) return [];

  const nodeMap = new Map(nodes.map((node) => [nodeKey(node.type, node.id), node]));
  const layer = new Map([...keys].map((key) => [key, 0]));

  for (const node of nodes) {
    if (node.type === "chapter") layer.set(nodeKey(node.type, node.id), 0);
  }

  let changed = true;
  let guard = 0;
  while (changed && guard < keys.size + 8) {
    changed = false;
    guard += 1;
    for (const edge of edges ?? []) {
      const from = nodeKey(edge.from_type, edge.from_id);
      const to = nodeKey(edge.to_type, edge.to_id);
      if (!keys.has(from) || !keys.has(to)) continue;
      const nextLayer = layer.get(from) + 1;
      if (nextLayer > layer.get(to)) {
        layer.set(to, nextLayer);
        changed = true;
      }
    }
  }

  const buckets = new Map();
  for (const [key, value] of layer) {
    if (!buckets.has(value)) buckets.set(value, []);
    buckets.get(value).push(key);
  }

  const positions = [];
  const sortedLayers = [...buckets.keys()].sort((a, b) => a - b);
  for (const layerIndex of sortedLayers) {
    const members = buckets.get(layerIndex).sort((leftKey, rightKey) => {
      const left = nodeMap.get(leftKey);
      const right = nodeMap.get(rightKey);
      const typeDelta = TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type);
      if (typeDelta !== 0) return typeDelta;
      return (left.label || "").localeCompare(right.label || "", "zh");
    });
    members.forEach((key, rowIndex) => {
      const node = nodeMap.get(key);
      positions.push({
        type: node.type,
        id: node.id,
        x: horizontal ? PAD + layerIndex * LAYER_STEP_X : PAD + rowIndex * LAYER_STEP_X,
        y: horizontal ? PAD + rowIndex * LAYER_STEP_Y : PAD + layerIndex * LAYER_STEP_Y
      });
    });
  }
  return clampPositions(positions);
}

function layoutSceneBlock(sceneId, sceneY, childrenMap, positions) {
  positions.push({ type: "scene", id: sceneId, x: 260, y: sceneY });
  let childY = sceneY + 148;
  for (const child of sortSceneChildNodes(childrenMap.get(sceneId) ?? [])) {
    positions.push({ type: child.type, id: child.id, x: 480, y: childY });
    childY += CHILD_STEP_Y;
  }
  return Math.max(sceneY + ROW_GAP.default, childY);
}

function layoutSceneTree(snapshot) {
  const { owner, children } = buildStudioSceneOwnership(snapshot);
  const scenes = snapshot.scenes ?? [];
  const chapters = [...(snapshot.chapters ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const positions = [];
  const placed = new Set();
  let cursorY = PAD;

  const chapterIds = new Set(chapters.map((chapter) => chapter.id));

  for (const chapter of chapters) {
    positions.push({ type: "chapter", id: chapter.id, x: 40, y: cursorY });
    const chapterScenes = scenes.filter((scene) => scene.chapter_id === chapter.id);
    let blockTop = cursorY;
    if (!chapterScenes.length) {
      cursorY += ROW_GAP.chapter;
    } else {
      for (const scene of chapterScenes) {
        placed.add(scene.id);
        cursorY = layoutSceneBlock(scene.id, cursorY, children, positions);
        cursorY += 28;
      }
    }
    cursorY = Math.max(cursorY, blockTop + ROW_GAP.chapter) + 36;
  }

  for (const scene of scenes) {
    if (placed.has(scene.id) || (scene.chapter_id && chapterIds.has(scene.chapter_id))) continue;
    placed.add(scene.id);
    cursorY = layoutSceneBlock(scene.id, cursorY, children, positions);
    cursorY += 28;
  }

  const floating = [];
  for (const clue of snapshot.clues ?? []) {
    if (!owner.has(`clue:${clue.id}`)) floating.push({ type: "clue", id: clue.id, label: clue.name });
  }
  for (const item of snapshot.items ?? []) {
    if (!owner.has(`item:${item.id}`)) floating.push({ type: "item", id: item.id, label: item.name });
  }
  for (const point of snapshot.investigationPoints ?? []) {
    if (!owner.has(`investigation_point:${point.id}`)) floating.push({ type: "investigation_point", id: point.id, label: point.name });
  }
  floating.sort((a, b) => (a.label || "").localeCompare(b.label || "", "zh"));
  let floatY = PAD;
  for (const node of floating) {
    positions.push({ type: node.type, id: node.id, x: 760, y: floatY });
    floatY += CHILD_STEP_Y;
  }

  return clampPositions(positions);
}

function layoutChapterGroups(snapshot, nodes) {
  const chapters = [...(snapshot.chapters ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const scenes = snapshot.scenes ?? [];
  const points = snapshot.investigationPoints ?? [];
  const { owner, children } = buildStudioSceneOwnership(snapshot);
  const positions = [];
  let rowY = PAD;

  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const placedSceneIds = new Set();
  const placedChildKeys = new Set();

  for (const chapter of chapters) {
    positions.push({ type: "chapter", id: chapter.id, x: 40, y: rowY });
    const chapterScenes = scenes.filter((scene) => scene.chapter_id === chapter.id);
    let sceneY = rowY;
    let blockBottom = rowY + ROW_GAP.chapter;

    for (const scene of chapterScenes) {
      placedSceneIds.add(scene.id);
      positions.push({ type: "scene", id: scene.id, x: 260, y: sceneY });
      let childY = sceneY + 148;
      for (const child of sortSceneChildNodes(children.get(scene.id) ?? [])) {
        placedChildKeys.add(`${child.type}:${child.id}`);
        positions.push({ type: child.type, id: child.id, x: 480, y: childY });
        childY += CHILD_STEP_Y;
        blockBottom = Math.max(blockBottom, childY);
      }
      sceneY = Math.max(sceneY + ROW_GAP.default, childY);
      blockBottom = Math.max(blockBottom, sceneY);
    }

    rowY = blockBottom + 36;
  }

  const orphanScenes = scenes.filter((scene) => !scene.chapter_id || !chapterIds.has(scene.chapter_id));
  for (const scene of orphanScenes) {
    if (placedSceneIds.has(scene.id)) continue;
    placedSceneIds.add(scene.id);
    positions.push({ type: "scene", id: scene.id, x: 260, y: rowY });
    let childY = rowY + 148;
    for (const child of sortSceneChildNodes(children.get(scene.id) ?? [])) {
      placedChildKeys.add(`${child.type}:${child.id}`);
      positions.push({ type: child.type, id: child.id, x: 480, y: childY });
      childY += CHILD_STEP_Y;
    }
    rowY = Math.max(rowY + ROW_GAP.default, childY + 24);
  }

  let floatY = PAD;
  for (const node of nodes) {
    if (node.type === "scene" || node.type === "chapter") continue;
    const key = `${node.type}:${node.id}`;
    if (placedChildKeys.has(key) || owner.has(key)) continue;
    positions.push({ type: node.type, id: node.id, x: 760, y: floatY });
    floatY += CHILD_STEP_Y;
  }

  return clampPositions(positions);
}

export function computeStoryLayout(snapshot, mode = "scene-tree") {
  if (!STUDIO_LAYOUT_MODES[mode]) throwErr("STUDIO_LAYOUT_MODE_INVALID");
  const nodes = collectStudioLayoutNodes(snapshot);
  if (!nodes.length) return [];

  if (mode === "scene-tree") return layoutSceneTree(snapshot);
  if (mode === "columns") return layoutColumns(nodes);
  if (mode === "flow-horizontal") return layoutFlow(nodes, snapshot.edges ?? [], true);
  if (mode === "flow-vertical") return layoutFlow(nodes, snapshot.edges ?? [], false);
  return layoutChapterGroups(snapshot, nodes);
}

export const STORY_LAYOUT_TABLES = Object.freeze({
  chapter: "chapters",
  scene: "scenes",
  clue: "clues",
  investigation_point: "investigation_points",
  item: "items"
});

let chapterMetadataSupported;

async function supportsChapterMetadata(client) {
  if (chapterMetadataSupported !== undefined) return chapterMetadataSupported;
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'chapters' AND column_name = 'metadata'
     LIMIT 1`
  );
  chapterMetadataSupported = Boolean(result.rowCount);
  return chapterMetadataSupported;
}

export async function persistStoryLayoutPositions(client, worldId, positions) {
  const chapterMeta = await supportsChapterMetadata(client);
  for (const position of positions) {
    const table = STORY_LAYOUT_TABLES[position.type];
    if (!table || !position.id || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throwErr("POSITION_ENTRY_INVALID");
    }
    if (position.type === "chapter" && !chapterMeta) continue;
    const { x, y } = clampPosition(position.x, position.y);
    await client.query(
      `UPDATE ${table}
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphPosition}', $1::jsonb, true)
       WHERE id = $2 AND world_id = $3`,
      [JSON.stringify({ x, y }), position.id, worldId]
    );
  }
}
