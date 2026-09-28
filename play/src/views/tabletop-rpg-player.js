import "./tabletop-rpg-player.css";
import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";
import { renderGame } from "./game.js";

export function renderTabletopRpgPlayer() {
  return `<section class="rpg-player-shell" data-player-product="tabletop_rpg"><header class="rpg-player-header"><div><span class="eyebrow">TABLETOP RPG · PLAYER TABLE</span><h1>${escapeHtml(state.home?.room?.name || "跑团桌面")}</h1><p>跑团使用独立的地图、角色、行动与语音工作区；剧本杀和桌游状态不会混入本界面。</p></div><span class="rpg-player-live">${state.roomEventsConnected ? "实时同步" : "连接恢复中"}</span></header>${renderGame()}</section>`;
}
