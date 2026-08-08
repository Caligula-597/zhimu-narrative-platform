const BUSY_SAFE_ACTIONS = new Set([
  "dismiss-error",
  "modal-close",
  "modal-backdrop-close",
  "show-auth",
  "voice-room",
  "voice-join"
]);

export function canHandlePlayActionWhileBusy(action) {
  return BUSY_SAFE_ACTIONS.has(action);
}

export function handlePlayStateAction({
  action,
  button,
  event,
  state,
  render,
  closeModalState,
  persistGameSidebarCollapsed
}) {
  switch (action) {
    case "plaza-back":
      state.view = "plaza";
      state.plazaPostId = "";
      state.plazaPostDetail = null;
      state.plazaReplies = null;
      render();
      return true;
    case "modal-close":
      closeModalState();
      render();
      return true;
    case "modal-backdrop-close":
      if (event.target === button) {
        closeModalState();
        render();
      }
      return true;
    case "pick-role":
      state.selectedRoleId = button.dataset.roleId;
      render();
      return true;
    case "section-prev":
    case "section-next": {
      const sections = state.home?.sections || [];
      const index = sections.findIndex((section) => section.id === state.sectionId);
      const offset = action === "section-prev" ? -1 : 1;
      const next = sections[index + offset];
      if (next) state.sectionId = next.id;
      render();
      return true;
    }
    case "pick-section":
      state.sectionId = button.dataset.sectionId;
      render();
      return true;
    case "pick-clue":
      state.clueId = button.dataset.clueId;
      render();
      return true;
    case "goto-section":
      state.sectionId = button.dataset.sectionId;
      state.tab = "sections";
      render();
      return true;
    case "show-auth":
      state.view = "auth";
      render();
      return true;
    case "toggle-auth-mode":
      state.authMode = state.authMode === "login" ? "register" : "login";
      state.pendingVerificationEmail = "";
      state.pendingVerificationChallenge = null;
      render();
      return true;
    case "auth-forgot":
      state.authMode = "forgot";
      render();
      return true;
    case "auth-login":
      state.authMode = "login";
      state.pendingVerificationEmail = "";
      state.pendingVerificationChallenge = null;
      state.resetToken = "";
      render();
      return true;
    case "close-recap-detail":
      state.recapDetail = null;
      state.recapId = "";
      render();
      return true;
    case "join-back-code":
      state.joinPreview = null;
      state.joinStep = 1;
      render();
      return true;
    case "dismiss-error":
      state.error = "";
      render();
      return true;
    case "toggle-sidebar":
      state.gameSidebarCollapsed = !state.gameSidebarCollapsed;
      persistGameSidebarCollapsed(state.gameSidebarCollapsed);
      render();
      return true;
    case "clear-notes-draft":
      state.notesDraft = "";
      state.notesDraftTitle = "";
      render();
      return true;
    default:
      return false;
  }
}
