import { uiStore, studioStore } from "../state/index.js";
(function (window) {
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
        studioStore.set({ studioSelectedNode: { type: el?.dataset?.nodeType, id: el?.dataset?.nodeId } });
        studioStore.set({ studioAnchorEditing: false });
        render();
        return true;
      case "studio-add-anchor": S.addStudioAnchor?.(); return true;
      case "studio-delete-anchor": S.deleteStudioAnchor?.(el?.dataset?.anchorId); return true;
      case "studio-toggle-anchor-edit":
        studioStore.set({ studioAnchorEditing: !studioStore.get().studioAnchorEditing });
        render();
        return true;
      case "studio-connect-node": S.openStudioConnection?.(); return true;
      case "studio-delete-node": S.deleteSelectedStudioNode?.(); return true;
      case "studio-save-node": S.saveSelectedStudioNode?.(); return true;
      case "studio-delete-edge": S.deleteStudioEdge?.(el?.dataset?.edgeId); return true;
      case "studio-filter":
        studioStore.set({ studioFilter: el?.dataset?.filter });
        render();
        return true;
      case "studio-auto-layout-menu": S.openStudioLayoutMenu?.(); return true;
      case "studio-auto-layout": S.autoLayoutStudio?.(el?.dataset?.layoutMode); return true;
      case "studio-collapse-all-scenes":
        studioStore.set({ studioCollapsedScenes: (studioStore.get().cloudStudio?.scenes || [])
          .filter((scene) => S.studioSceneChildCount?.(studioStore.get().cloudStudio, scene.id) > 0)
          .map((scene) => scene.id) });
        render();
        return true;
      case "studio-expand-all-scenes":
        studioStore.set({ studioCollapsedScenes: [] });
        render();
        return true;
      case "studio-toggle-scene-children": {
        const sceneId = el?.dataset?.sceneId;
        if (!sceneId) return true;
        const collapsed = new Set(studioStore.get().studioCollapsedScenes || []);
        if (collapsed.has(sceneId)) collapsed.delete(sceneId);
        else collapsed.add(sceneId);
        studioStore.set({ studioCollapsedScenes: [...collapsed] });
        render();
        return true;
      }
      case "studio-zoom-out":
        studioStore.set({ studioZoom: Math.max(0.4, studioStore.get().studioZoom - 0.1) });
        render();
        return true;
      case "studio-zoom-in":
        studioStore.set({ studioZoom: Math.min(1.3, studioStore.get().studioZoom + 0.1) });
        render();
        return true;
      default: return false;
    }
  }

  window.zhimuActionsStudio = { handleStudioAction };
})(window);
export {};
