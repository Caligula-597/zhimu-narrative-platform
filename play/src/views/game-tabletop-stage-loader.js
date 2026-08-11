let renderer = null;
let loading = null;

export async function loadPlayerTabletopStage() {
  if (renderer) return renderer;
  loading ||= import("./game-tabletop-stage.js").then((module) => {
    renderer = module.renderPlayerStageMap;
    return renderer;
  });
  return loading;
}

export function renderPlayerStageMapBoundary(map, context = {}) {
  if (!map) return "";
  if (renderer) return renderer(map, context);
  if (typeof window !== "undefined" && !loading) {
    void loadPlayerTabletopStage().then(() => window.dispatchEvent(new Event("zhimu:tabletop-stage-ready")));
  }
  return `<section class="player-stage" aria-busy="true">正在载入当前跑团场景…</section>`;
}
