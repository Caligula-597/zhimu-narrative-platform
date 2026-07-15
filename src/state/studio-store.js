/** Studio editor state shard — graph, selection, filter, zoom, layout, loading. */
import { createStore } from "./create-store.js";

export const studioStore = createStore({
  cloudStudio: null,
  studioSelectedNode: null,
  studioAnchorEditing: false,
  studioFilter: "all",
  studioZoom: 1,
  studioLayoutMode: "scene-tree",
  studioCollapsedScenes: [],
  studioCanvasHeight: 0,
  cloudLoading: true,
  studioLoading: false,
  studioError: ""
});
