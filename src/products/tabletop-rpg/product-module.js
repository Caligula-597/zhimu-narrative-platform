import { TABLETOP_RPG_DOMAIN } from "../../../shared/product-domains/tabletop-rpg.js";
import { TABLETOP_RPG_VIEW_MODULES } from "./view-manifest.js";

function summarizeWorld({ world }) {
  const locationCount = world?.settings?.tabletopMapDesign?.locations?.length;
  return typeof locationCount === "number"
    ? `${TABLETOP_RPG_DOMAIN.label}创作 · ${locationCount} 个地点`
    : `${TABLETOP_RPG_DOMAIN.label}创作 · 空白模组`;
}

export const TABLETOP_RPG_PRODUCT_MODULE = Object.freeze({
  domain: TABLETOP_RPG_DOMAIN,
  viewModules: TABLETOP_RPG_VIEW_MODULES,
  shell: Object.freeze({
    brandSubtitle: "TABLETOP RPG CREATOR",
    authDescription: "登录后可保存跑团模组、地图、判定和遭遇数据。",
    showCreatorRuntimeControls: false,
    advancedNavigation: false,
    advancedSharedScopeLabel: "",
    summarizeWorld
  }),
  library: Object.freeze({
    catalogAvailable: false,
    catalogLabel: "",
    loadRoomCounts: false,
    hint: () => "跑团专属地图、判定与遭遇"
  }),
  runtime: Object.freeze({
    label: "▶ 进入跑团模拟",
    activate({ go }) {
      go(TABLETOP_RPG_DOMAIN.homeView);
    }
  })
});
