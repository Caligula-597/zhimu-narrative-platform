import { renderHeader } from "./header.js";
import { renderModal } from "./modal.js";
import { renderMobileNav } from "./mobile-nav.js";
import { escapeHtml } from "../security.js";
import { state } from "../state.js";
import { renderAuth } from "../views/auth.js";
import { renderGame } from "../views/game.js";
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
  if (state.view === "game" && state.home) return renderGame();
  return renderLanding();
}

export function renderApp() {
  return `
    ${renderHeader()}
    <main class="play-main">
      ${state.error ? `<div class="banner error">${escapeHtml(state.error)}<button type="button" data-action="dismiss-error" aria-label="关闭">×</button></div>` : ""}
      ${state.busy ? `<div class="loading-bar" aria-hidden="true"></div>` : ""}
      ${renderMainView()}
    </main>
    ${renderMobileNav()}
    ${state.toast ? `<div class="toast show" role="status">${escapeHtml(state.toast)}</div>` : ""}
    ${renderModal()}`;
}
