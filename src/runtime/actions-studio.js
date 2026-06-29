/** Story graph studio editor actions. */
(function (window) {
  const state = window.zhimuState;

  function render() { window.zhimuRuntime?.render?.(); }
  function views() { return window.zhimuViews || {}; }

  function handleStudioAction(action, el) {
    const S = views().studio || {};
    switch (action) {
      case "studio-add-chapter": S.openStudioChapter?.(); return true;
      case "studio-add-scene": S.openStudioScene?.(); return true;
      case "studio-add-clue": S.openStudioClue?.(); return true;
      case "studio-add-item": S.openStudioItem?.(); return true;
      case "studio-add-point": S.openStudioPoint?.(); return true;
      case "studio-add-node-menu": S.openStudioNodeMenu?.(); return true;
      case "studio-select-node":
        state.studioSelectedNode = { type: el?.dataset?.nodeType, id: el?.dataset?.nodeId };
        state.studioAnchorEditing = false;
        render();
        return true;
      case "studio-add-anchor": S.addStudioAnchor?.(); return true;
      case "studio-delete-anchor": S.deleteStudioAnchor?.(el?.dataset?.anchorId); return true;
      case "studio-toggle-anchor-edit":
        state.studioAnchorEditing = !state.studioAnchorEditing;
        render();
        return true;
      case "studio-connect-node": S.openStudioConnection?.(); return true;
      case "studio-delete-node": S.deleteSelectedStudioNode?.(); return true;
      case "studio-save-node": S.saveSelectedStudioNode?.(); return true;
      case "studio-delete-edge": S.deleteStudioEdge?.(el?.dataset?.edgeId); return true;
      case "studio-filter":
        state.studioFilter = el?.dataset?.filter;
        render();
        return true;
      case "studio-auto-layout-menu": S.openStudioLayoutMenu?.(); return true;
      case "studio-auto-layout": S.autoLayoutStudio?.(el?.dataset?.layoutMode); return true;
      case "studio-collapse-all-scenes":
        state.studioCollapsedScenes = (state.cloudStudio?.scenes || [])
          .filter((scene) => S.studioSceneChildCount?.(state.cloudStudio, scene.id) > 0)
          .map((scene) => scene.id);
        render();
        return true;
      case "studio-expand-all-scenes":
        state.studioCollapsedScenes = [];
        render();
        return true;
      case "studio-toggle-scene-children": {
        const sceneId = el?.dataset?.sceneId;
        if (!sceneId) return true;
        const collapsed = new Set(state.studioCollapsedScenes || []);
        if (collapsed.has(sceneId)) collapsed.delete(sceneId);
        else collapsed.add(sceneId);
        state.studioCollapsedScenes = [...collapsed];
        render();
        return true;
      }
      case "studio-zoom-out":
        state.studioZoom = Math.max(0.4, state.studioZoom - 0.1);
        render();
        return true;
      case "studio-zoom-in":
        state.studioZoom = Math.min(1.3, state.studioZoom + 0.1);
        render();
        return true;
      default: return false;
    }
  }

  window.zhimuActionsStudio = { handleStudioAction };
})(window);
export {};
