import { renderHeader } from "./header.js";
import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";
import { renderAuth } from "../views/auth.js";
import { renderConsole } from "../views/console.js";
import { renderLanding } from "../views/landing.js";

function renderMainView() {
  if (state.view === "auth") return renderAuth();
  if (state.view === "console") return renderConsole();
  return renderLanding();
}

export function renderApp() {
  return `
    <div class="host-app-shell">
      ${renderHeader()}
      ${state.busy ? `<div class="loading-bar" role="progressbar" aria-label="加载中"></div>` : ""}
      <main class="host-main" ${state.busy ? 'aria-busy="true"' : ""}>
        <div class="host-main-inner">
          ${state.error ? `<div class="banner error" role="alert"><span>${escapeHtml(state.error)}</span><button class="icon-btn" type="button" data-action="dismiss-error" aria-label="关闭">×</button></div>` : ""}
          ${renderMainView()}
        </div>
      </main>
    </div>
    <div class="toast-host" aria-live="polite" aria-atomic="true">${state.toast ? `<div class="toast show" role="status">${escapeHtml(state.toast)}</div>` : ""}</div>`;
}
