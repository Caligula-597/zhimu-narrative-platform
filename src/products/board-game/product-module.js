import { BOARD_GAME_DOMAIN } from "../../../shared/product-domains/board-game.js";
import { BOARD_GAME_VIEW_MODULES } from "./view-manifest.js";

function summarizeWorld({ world }) {
  const componentCount = world?.settings?.boardGameDesign?.components?.length;
  return typeof componentCount === "number"
    ? `${BOARD_GAME_DOMAIN.label}创作 · ${componentCount} 类组件`
    : `${BOARD_GAME_DOMAIN.label}创作 · 空白项目`;
}

export const BOARD_GAME_PRODUCT_MODULE = Object.freeze({
  domain: BOARD_GAME_DOMAIN,
  viewModules: BOARD_GAME_VIEW_MODULES,
  shell: Object.freeze({
    brandSubtitle: "BOARD GAME CREATOR",
    authDescription: "登录后可保存桌游项目、素材和可执行 Demo。",
    showCreatorRuntimeControls: false,
    advancedNavigation: false,
    advancedSharedScopeLabel: "",
    summarizeWorld
  }),
  library: Object.freeze({
    catalogAvailable: false,
    catalogLabel: "",
    loadRoomCounts: false,
    hint: () => "桌游专属席位、组件与试玩"
  }),
  runtime: Object.freeze({
    label: "▶ 运行可玩 Demo",
    activate({ R, go, uiStore }) {
      if (uiStore.get().view === BOARD_GAME_DOMAIN.homeView) {
        void R.handle?.("board-tab-select", { dataset: { boardTab: "playground" } });
        return;
      }
      uiStore.set({ boardGameRequestedTab: "playground" });
      go(BOARD_GAME_DOMAIN.homeView);
    }
  })
});
