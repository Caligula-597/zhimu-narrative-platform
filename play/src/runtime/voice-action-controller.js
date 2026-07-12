export async function handlePlayVoiceAction({
  action,
  button,
  render,
  setBusy,
  setToast,
  formatApiError,
  openVoiceRoomPicker,
  openCreateVoiceRoomModal,
  openInviteVoiceRoomModal,
  joinVoiceRoom,
  connectVoiceLive,
  disconnectVoiceLive,
  toggleVoiceMicLive,
  unlockVoicePlayback,
  refreshVoiceMessages,
  sendVoiceChatMessage,
  submitCreateVoiceRoom,
  submitVoiceInvite
}) {
  const ui = { render, setToast };
  const modalUi = { render, setBusy, setToast };
  switch (action) {
    case "voice-room":
      openVoiceRoomPicker(render);
      return true;
    case "voice-room-create":
      openCreateVoiceRoomModal(render);
      return true;
    case "voice-room-invite":
      openInviteVoiceRoomModal(button.dataset.voiceId, button.dataset.voiceName, render);
      return true;
    case "voice-join":
      await joinVoiceRoom(button.dataset.voiceId, button.dataset.voiceName, ui);
      return true;
    case "voice-live-connect":
      await connectVoiceLive(ui);
      return true;
    case "voice-live-disconnect":
      await disconnectVoiceLive(ui);
      return true;
    case "voice-mic-toggle":
      await toggleVoiceMicLive(ui);
      return true;
    case "voice-playback-unlock":
      await unlockVoicePlayback(ui);
      return true;
    case "voice-chat-refresh":
      try {
        await refreshVoiceMessages(render);
      } catch (error) {
        setToast(formatApiError(error, "刷新失败"), render);
      }
      return true;
    case "voice-chat-send":
      await sendVoiceChatMessage(modalUi);
      return true;
    case "modal-create-voice":
      await submitCreateVoiceRoom(modalUi);
      return true;
    case "modal-voice-invite":
      await submitVoiceInvite(modalUi);
      return true;
    default:
      return false;
  }
}
