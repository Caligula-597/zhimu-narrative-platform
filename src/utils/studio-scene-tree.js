/** Scene ownership helpers for studio canvas (mirrors backend/src/studio-scene-tree.js). */
(function (window) {
  function buildStudioSceneOwnership(snapshot) {
    const owner = new Map();
    const children = new Map();

    function attach(sceneId, type, id) {
      if (!sceneId || !id || !type) return;
      const childKey = `${type}:${id}`;
      if (!owner.has(childKey)) owner.set(childKey, sceneId);
      if (!children.has(sceneId)) children.set(sceneId, []);
      const list = children.get(sceneId);
      if (!list.some((entry) => entry.type === type && entry.id === id)) {
        list.push({ type, id });
      }
    }

    for (const point of snapshot.investigationPoints ?? []) {
      attach(point.scene_id, "investigation_point", point.id);
      attach(point.scene_id, "clue", point.clue_id);
      attach(point.scene_id, "item", point.required_item_id);
    }

    for (const edge of snapshot.edges ?? []) {
      const pairs = [
        [edge.from_type, edge.from_id, edge.to_type, edge.to_id],
        [edge.to_type, edge.to_id, edge.from_type, edge.from_id]
      ];
      for (const [fromType, fromId, toType, toId] of pairs) {
        if (fromType === "scene" && ["clue", "investigation_point", "item"].includes(toType)) {
          attach(fromId, toType, toId);
        }
      }
    }

    return { owner, children };
  }

  function sortSceneChildNodes(children = []) {
    const order = { investigation_point: 0, clue: 1, item: 2 };
    return [...children].sort((left, right) => {
      const delta = (order[left.type] ?? 9) - (order[right.type] ?? 9);
      return delta !== 0 ? delta : `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`, "zh");
    });
  }

  window.zhimuStudioSceneTree = { buildStudioSceneOwnership, sortSceneChildNodes };
})(window);
export {};
