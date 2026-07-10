export async function runPlayStartup(ctx) {
  const {
    state, api, render, setBusy, setToast, formatApiError, normalizeUser,
    setSessionToken, clearSession, cleanAuthUrl, loadSessionUser, ensureSession,
    loadAuthConfig, loadPlatform, loadPublicRooms, loadDmConversations,
    loadPlazaPosts, loadFriends, loadPlazaThread, handleJoinOfficial,
    handleLookupInvite, refreshHome, loadRecapSummary, syncPlatformStream,
    normalizeInviteCode, isUuid, persistRoom, resolveInitialRoute
  } = ctx;
  const params = new URLSearchParams(window.location.search);
  const { joinCode, wantOfficial } = resolveInitialRoute({
    state, params, normalizeInviteCode, isUuid, persistRoom
  });

  if (state.view === "landing") state.busy = true;
  else setBusy(true, render);
  try {
    await Promise.all([loadAuthConfig(), loadPlatform(), loadPublicRooms({ silent: true })]);
    const oauthCode = params.get("oauth_code");
    const oauthError = params.get("oauth_error");
    if (oauthError) state.error = `OAuth login failed: ${oauthError}`;
    else if (oauthCode) {
      const result = await api.oauthComplete(oauthCode);
      setSessionToken(result.token);
      state.user = normalizeUser(result.user);
      setToast(`Welcome, ${result.user.displayName || "player"}`, render);
      cleanAuthUrl();
    }
    await loadSessionUser();
    if (state.user?.id && state.view === "auth" && ["login", "register"].includes(state.authMode)) {
      state.view = state.roomId ? "game" : (state.joinPreview ? "join" : "landing");
    }
    const shouldCreateGuest = state.view !== "auth" || Boolean(joinCode) || wantOfficial || Boolean(state.roomId);
    if (shouldCreateGuest && !state.user?.id) await ensureSession();
    if (state.pendingVerifyToken) {
      try { await ctx.handleEmailVerify(state.pendingVerifyToken); }
      catch (error) { state.error = formatApiError(error, "Email verification failed"); }
      state.pendingVerifyToken = "";
    }
    await loadDmConversations({ silent: true }).catch(() => {});
    if (state.view === "plaza") await loadPlazaPosts({ silent: true });
    if (state.view === "friends") await loadFriends({ silent: true });
    if (state.view === "messages") await loadDmConversations({ silent: true });
    if (state.view === "plaza-thread" && state.plazaPostId) await loadPlazaThread({ silent: true });
    if (wantOfficial) await handleJoinOfficial({ silent: true });
    else if (joinCode) {
      state.inviteCode = joinCode;
      await handleLookupInvite({ silent: true });
    } else if (state.roomId && state.view === "game") {
      await refreshHome();
      if (state.tab === "recap") await loadRecapSummary({ silent: true });
    }
  } catch (error) {
    if (!state.error) state.error = formatApiError(error, "Loading failed");
    if (error.status === 401 || error.status === 403) {
      clearSession();
      persistRoom("", isUuid);
    }
  } finally {
    setBusy(false, render);
    syncPlatformStream();
  }
}
