export async function handlePlaySessionAction(ctx) {
  const {
    action, button, event, state, render, normalizeInviteCode, handleLookupInvite,
    handleJoinRoom, handleJoinOfficial, handleResendVerification, goToLanding,
    handleGuestSubmit, handleOAuth, handleLogout, resetVoiceOnLeave,
    disconnectRoomEvents, roomEventCtx, persistRoom, isUuid, syncPlatformStream,
    refreshHome, setToast
  } = ctx;
  switch (action) {
    case "go-home":
      event.preventDefault();
      await goToLanding();
      return true;
    case "start-join":
      if (!normalizeInviteCode(state.inviteCode)) {
        state.view = "join";
        state.joinStep = 1;
        render();
        return true;
      }
      state.view = "join";
      state.joinStep = 1;
      await handleLookupInvite();
      return true;
    case "lookup-invite":
      await handleLookupInvite();
      return true;
    case "confirm-join":
      await handleJoinRoom();
      return true;
    case "join-official":
      await handleJoinOfficial();
      return true;
    case "resend-verification":
      await handleResendVerification();
      return true;
    case "back-landing":
      await goToLanding();
      return true;
    case "guest-continue":
      await handleGuestSubmit({ displayName: { value: "" } });
      return true;
    case "oauth":
      await handleOAuth(button.dataset.provider);
      return true;
    case "logout":
      await handleLogout();
      return true;
    case "leave-room":
      await resetVoiceOnLeave();
      disconnectRoomEvents(roomEventCtx);
      persistRoom("", isUuid);
      state.home = null;
      state.recapLatest = null;
      state.recapDetail = null;
      state.view = "landing";
      state.tab = "home";
      syncPlatformStream();
      render();
      return true;
    case "return-game":
      if (state.roomId && isUuid(state.roomId)) await refreshHome();
      else setToast("当前没有进行中的对局", render);
      return true;
    default:
      return false;
  }
}
