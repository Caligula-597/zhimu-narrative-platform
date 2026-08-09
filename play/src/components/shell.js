import { renderHeader } from "./header.js";
import { renderModal } from "./modal.js";
import { renderMobileNav } from "./mobile-nav.js";
import { renderVerifyBanner } from "./verify-banner.js";
import { escapeHtml } from "../../../shared/security.js";
import { renderSyncStatusBannerHtml } from "../runtime/sync-helpers.js";
import { state } from "../state.js";
import { renderAuth } from "../views/auth.js";
import { renderGame, renderGameResume } from "../views/game.js";
import { renderJoin } from "../views/join.js";
import { renderLanding } from "../views/landing.js";
import { renderLobby } from "../views/lobby.js";
import { renderPlaza, renderPlazaThread } from "../views/plaza.js";
import { renderDm, renderFriends, renderMessages } from "../views/social.js";

function renderMainView() {
  if (state.view === "auth") return renderAuth();
  if (state.view === "lobby") return renderLobby();
  if (state.view === "plaza") return renderPlaza();
  if (state.view === "plaza-thread") return renderPlazaThread();
  if (state.view === "friends") return renderFriends();
  if (state.view === "messages") return renderMessages();
  if (state.view === "dm") return renderDm();
  if (state.view === "join") return renderJoin();
  if (state.view === "game" && state.roomId) {
    if (state.home) return renderGame();
    return renderGameResume();
  }
  return renderLanding();
}

export function renderApp() {
  const syncBanner = renderSyncStatusBannerHtml(state);
  return `
    ${renderHeader()}
    ${renderVerifyBanner()}
    <main class="play-main" id="play-main" tabindex="-1" ${state.busy ? 'aria-busy="true"' : ""}>
      ${syncBanner ? `<div data-sync-banner>${syncBanner}</div>` : ""}
      ${state.error ? `<div class="banner error">${escapeHtml(state.error)}<button type="button" data-action="dismiss-error" aria-label="关闭">×</button></div>` : ""}
      ${state.busy ? `<div class="loading-bar" role="progressbar" aria-label="加载中"></div>` : ""}
      ${renderMainView()}
    </main>
    ${renderMobileNav()}
    <div class="toast-host" aria-live="polite" aria-atomic="true">${state.toast ? `<div class="toast show" role="status">${escapeHtml(state.toast)}</div>` : ""}</div>
    ${renderModal()}`;
}
