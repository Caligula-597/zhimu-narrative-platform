import { renderHeader } from "./header.js";
import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";
import { renderHostConsoleBoundary } from "../runtime/host-console-loader.js";
import { renderAuth } from "../views/auth.js";
import { renderLanding } from "../views/landing.js";
import { renderPortalProfileEditor } from "../../../shared/portal-profile-ui.js";

function renderMainView() {
  if (state.view === "auth") return renderAuth();
  if (state.view === "console") return renderHostConsoleBoundary();
  return renderLanding();
}

export function renderApp() {
  const profileModal = state.profileOpen
    ? `<div class="modal-backdrop show host-profile-modal-backdrop">
        <div class="modal host-profile-modal" role="dialog" aria-modal="true" aria-label="主持人端身份资料">
          ${renderPortalProfileEditor(state.portalProfile, {
            portal: "host",
            busy: state.profileBusy,
            loading: state.profileBusy && !state.portalProfile,
            status: state.profileStatus,
            closeAction: "close-profile"
          })}
        </div>
      </div>`
    : "";
  return `
    <div class="host-app-shell">
      ${renderHeader()}
      ${state.busy ? `<div class="loading-bar" role="progressbar" aria-label="加载中"></div>` : ""}
      <main class="host-main" id="host-main" tabindex="-1" ${state.busy ? 'aria-busy="true"' : ""}>
        <div class="host-main-inner">
          ${state.error ? `<div class="banner error" role="alert"><span>${escapeHtml(state.error)}</span><button class="icon-btn" type="button" data-action="dismiss-error" aria-label="关闭">×</button></div>` : ""}
          ${renderMainView()}
        </div>
      </main>
    </div>
    <div class="toast-host" aria-live="polite" aria-atomic="true">${state.toast ? `<div class="toast show" role="status">${escapeHtml(state.toast)}</div>` : ""}</div>
    ${profileModal}`;
}
