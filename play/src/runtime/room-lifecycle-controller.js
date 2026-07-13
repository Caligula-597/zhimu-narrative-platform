export function createRoomLifecycleController({
  api, state, render, setBusy, setToast, formatApiError, normalizeInviteCode,
  ensureSession, persistRoom, persistGameSession, isUuid, cleanAuthUrl,
  pullRoomData, syncRoomStream, syncPlatformStream, disconnectRoomEvents,
  roomEventCtx, pauseVoiceSession, loadRecapSummary, loadDmConversations
}) {
  async function goToLanding() {
    if (state.view === "game") {
      disconnectRoomEvents(roomEventCtx);
      await pauseVoiceSession();
    }
    Object.assign(state, {
      view: "landing", joinPreview: null, joinStep: 1,
      plazaPostId: "", plazaPostDetail: null, plazaReplies: null,
      plazaReplyDraft: "", dmConversationId: "", dmThread: null
    });
    syncPlatformStream();
    render();
  }

  async function refreshHome() {
    if (!state.roomId || !isUuid(state.roomId)) {
      if (state.roomId) persistRoom("", isUuid);
      disconnectRoomEvents(roomEventCtx);
      state.home = null;
      state.view = "landing";
      return;
    }
    try {
      await pullRoomData();
      state.view = "game";
      state.tab ||= "home";
      persistGameSession();
      syncRoomStream();
      void loadRecapSummary({ silent: true });
      void loadDmConversations({ silent: true });
    } catch (error) {
      if ([401, 403, 404, 409].includes(error.status)) {
        disconnectRoomEvents(roomEventCtx);
        persistRoom("", isUuid);
        state.home = null;
        state.view = "landing";
        state.error = error.status === 409
          ? "你尚未在本房间选择角色，请重新输入邀请码加入。"
          : "无法进入上次房间，请重新输入邀请码。";
      }
      throw error;
    }
  }

  async function loadPublicRooms({ silent = false } = {}) {
    if (!silent) setBusy(true, render);
    try {
      state.publicRooms = await api.publicRooms();
      state.lobbyError = "";
    } catch (error) {
      state.lobbyError = formatApiError(error, "大厅列表加载失败");
      state.publicRooms ||= { total: 0, items: [] };
    } finally {
      if (!silent) setBusy(false, render);
      else if (state.view === "landing" || state.view === "lobby") render();
    }
  }

  async function refreshJoinPreview(code) {
    state.joinPreview = await api.lookupInvite(code);
    state.inviteCode = code;
    const boundRoleId = state.joinPreview.current_role_slot_id || "";
    const roles = state.joinPreview.roles || [];
    if (boundRoleId) {
      state.selectedRoleId = boundRoleId;
      return state.joinPreview;
    }
    const selected = roles.find((role) => role.id === state.selectedRoleId);
    if (!selected || (selected.occupied && !selected.occupied_by_current)) {
      state.selectedRoleId = roles.find((role) => !role.occupied || role.occupied_by_current)?.id || "";
    }
    return state.joinPreview;
  }

  async function handleLookupInvite({ silent = false } = {}) {
    const code = normalizeInviteCode(state.inviteCode);
    if (!code) {
      if (!silent) setToast("请输入邀请码", render);
      return;
    }
    setBusy(true, render);
    try {
      await ensureSession();
      await refreshJoinPreview(code);
      const boundRoleId = state.joinPreview?.current_role_slot_id || "";
      const roomId = state.joinPreview?.room?.id || "";
      if (boundRoleId && roomId && isUuid(roomId)) {
        persistRoom(roomId, isUuid);
        await refreshHome();
        state.joinPreview = null;
        state.view = "game";
        if (!silent) setToast("已回到你绑定的角色", render);
        else render();
        return;
      }
      state.view = "join";
      state.joinStep = 2;
      render();
    } catch (error) {
      state.joinPreview = null;
      state.joinStep = 1;
      const message = formatApiError(error, "邀请码无效");
      if (!silent) setToast(message, render);
      else state.error = message;
    } finally {
      setBusy(false, render);
    }
  }

  async function handleJoinRoom() {
    const code = normalizeInviteCode(state.inviteCode);
    if (!code || !state.selectedRoleId) return setToast("请选择角色", render);
    setBusy(true, render);
    state.joinStep = 3;
    render();
    try {
      await ensureSession();
      await refreshJoinPreview(code);
      const selected = state.joinPreview?.roles?.find((role) => role.id === state.selectedRoleId);
      if (!selected || (selected.occupied && !selected.occupied_by_current)) {
        state.joinStep = 2;
        setToast("该角色刚被其他玩家选走，请重新选择", render);
        return;
      }
      const result = await api.joinRoom(code, state.selectedRoleId);
      persistRoom(result.roomId, isUuid);
      state.joinPreview = null;
      cleanAuthUrl();
      await refreshHome();
      const sections = state.home?.sections || [];
      state.tab = sections.length && sections.some((section) => !section.completed) ? "sections" : "home";
      setToast("已加入房间，欢迎来到故事现场", render);
    } catch (error) {
      state.joinStep = 2;
      if (error.code === "ROLE_SLOT_OCCUPIED") {
        await refreshJoinPreview(code).catch(() => { state.joinPreview = null; });
      }
      setToast(formatApiError(error, "加入失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function handleJoinOfficial({ silent = false } = {}) {
    setBusy(true, render);
    try {
      await ensureSession();
      const result = await api.joinOfficialExample();
      state.inviteCode = result.room?.invite_code || "";
      if (!state.inviteCode) throw new Error("示例房间创建失败");
      cleanAuthUrl();
      await handleLookupInvite({ silent: true });
      if (!silent) setToast("已创建示例运行房，请选择角色", render);
    } catch (error) {
      if (error.code === "EMAIL_NOT_VERIFIED" || error.status === 403) {
        state.error = "体验官方示例需要登录并验证邮箱。";
        state.view = "auth";
      } else if (!silent) setToast(error.message || "无法进入示例", render);
      else state.error = formatApiError(error, "无法进入官方示例");
    } finally {
      setBusy(false, render);
    }
  }

  return {
    goToLanding, refreshHome, loadPublicRooms, refreshJoinPreview,
    handleLookupInvite, handleJoinRoom, handleJoinOfficial
  };
}
