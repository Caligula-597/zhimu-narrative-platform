export function bindPlayFormEvents({
  app,
  state,
  render,
  setToast,
  setBusy,
  sendVoiceChatMessage,
  handlePlazaSubmit,
  handlePlazaReplySubmit,
  handlePlayerSearch,
  handleDmSend,
  handleAuthSubmit,
  handleForgotSubmit,
  handleResetSubmit,
  handleGuestSubmit
}) {
  const forms = [
    ["plaza", handlePlazaSubmit],
    ["plaza-reply", handlePlazaReplySubmit],
    ["player-search", handlePlayerSearch],
    ["dm-send", handleDmSend],
    ["auth", handleAuthSubmit],
    ["forgot", handleForgotSubmit],
    ["reset", handleResetSubmit],
    ["guest", handleGuestSubmit]
  ];

  app.addEventListener("submit", async (event) => {
    const voiceForm = event.target.closest("[data-form='voice-send']");
    if (voiceForm) {
      event.preventDefault();
      state.voiceChatDraft = voiceForm.body.value;
      await sendVoiceChatMessage({ render, setToast, setBusy });
      return;
    }

    for (const [formName, handler] of forms) {
      const form = event.target.closest(`[data-form='${formName}']`);
      if (!form) continue;
      event.preventDefault();
      if (!state.busy) await handler(form);
      return;
    }
  });
}
