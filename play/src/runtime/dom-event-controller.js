export function bindPlayDomEvents({
  app,
  state,
  render,
  closeModalState,
  flushPendingRoomRefresh,
  isGameInputFocused,
  documentRef = document,
  windowRef = window
}) {
  app.addEventListener("input", (event) => {
    const bind = event.target.dataset.bind;
    if (bind === "inviteCode") state.inviteCode = event.target.value;
    if (bind === "plazaBody") state.plazaDraftBody = event.target.value;
    if (bind === "plazaInvite") state.plazaDraftInvite = event.target.value;
    if (bind === "plazaReplyBody") state.plazaReplyDraft = event.target.value;
    if (bind === "playerSearch") state.playerSearchQuery = event.target.value;
    if (bind === "dmBody") state.dmDraftBody = event.target.value;
    if (bind === "modalDraft") state.modalDraft = event.target.value;
    if (bind === "voiceChat") state.voiceChatDraft = event.target.value;
    if (bind === "notesTitle") state.notesDraftTitle = event.target.value;
    if (bind === "notesBody") state.notesDraft = event.target.value;
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches("[data-voice-invite]")) {
      state.voiceInviteUserIds = [...documentRef.querySelectorAll("[data-voice-invite]:checked")]
        .map((input) => input.value)
        .filter(Boolean);
      render();
      return;
    }
    if (event.target.matches("[data-share-role]")) {
      state.clueShareRoles = [...documentRef.querySelectorAll("[data-share-role]:checked")]
        .map((input) => input.value);
      return;
    }
    if (event.target.matches("[data-transfer-role]")) {
      state.clueTransferTargetRoleSlotId = event.target.value;
      return;
    }
    if (event.target.dataset.bind === "sectionId") {
      state.sectionId = event.target.value;
      render();
    }
    if (event.target.dataset.bind === "plazaKind") {
      state.plazaDraftKind = event.target.value === "recruit" ? "recruit" : "chat";
      render();
    }
  });

  app.addEventListener("focusout", () => {
    if (!state.pendingRoomRefresh) return;
    windowRef.setTimeout(() => {
      if (!isGameInputFocused()) void flushPendingRoomRefresh();
    }, 120);
  });

  documentRef.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.modal) return;
    closeModalState();
    render();
  });
}
