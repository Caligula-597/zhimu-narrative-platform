/**
 * Plaza / friends / DM controllers extracted from play/src/main.js.
 */
export function createSocialController({
  api,
  state,
  render,
  setBusy,
  setToast,
  formatApiError,
  ensureSession,
  openModalState,
  closeModalState,
  normalizeInviteCode
}) {
  async function loadPlazaThread({ silent = false } = {}) {
    if (!state.plazaPostId) return;
    if (!silent) setBusy(true, render);
    try {
      const [post, replies] = await Promise.all([
        api.plazaPost(state.plazaPostId),
        api.plazaReplies(state.plazaPostId)
      ]);
      state.plazaPostDetail = post;
      state.plazaReplies = replies;
    } catch (error) {
      if (!silent) setToast(formatApiError(error, "无法加载帖子"), render);
      state.view = "plaza";
      state.plazaPostId = "";
    } finally {
      if (!silent) setBusy(false, render);
      else if (state.view === "plaza-thread") render();
    }
  }

  async function loadFriends({ silent = false } = {}) {
    if (!silent) setBusy(true, render);
    try {
      await ensureSession();
      state.friendsData = await api.listFriends();
      state.friendsError = "";
    } catch (error) {
      state.friendsError = formatApiError(error, "好友列表加载失败");
      if (!state.friendsData) state.friendsData = { friends: [], incoming: [], outgoing: [] };
    } finally {
      if (!silent) setBusy(false, render);
      else if (state.view === "friends") render();
    }
  }

  async function loadDmConversations({ silent = false } = {}) {
    if (!silent) setBusy(true, render);
    try {
      await ensureSession();
      state.dmConversations = await api.listDmConversations();
    } catch {
      if (!state.dmConversations) state.dmConversations = { items: [] };
    } finally {
      if (!silent) setBusy(false, render);
      else if (state.view === "messages" || state.view === "dm") render();
    }
  }

  async function loadDmThread({ silent = false } = {}) {
    if (!state.dmConversationId) return;
    if (!silent) setBusy(true, render);
    try {
      state.dmThread = await api.listDmMessages(state.dmConversationId);
    } catch (error) {
      if (!silent) setToast(formatApiError(error, "无法加载私信"), render);
      state.view = "messages";
      state.dmConversationId = "";
    } finally {
      if (!silent) setBusy(false, render);
      else if (state.view === "dm") render();
    }
  }

  async function openPlazaThread(postId) {
    state.plazaPostId = postId;
    state.view = "plaza-thread";
    render();
    await loadPlazaThread();
  }

  async function openDmConversation(conversationId) {
    state.dmConversationId = conversationId;
    state.view = "dm";
    render();
    await loadDmThread();
  }

  async function openDmWithPeer(peerUserId) {
    setBusy(true, render);
    try {
      await ensureSession();
      const { conversationId } = await api.openDmConversation(peerUserId);
      await loadDmConversations({ silent: true });
      await openDmConversation(conversationId);
    } catch (error) {
      setToast(formatApiError(error, "无法打开私信"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function handlePlazaReplySubmit(form) {
    const body = form.body.value.trim();
    if (!body || !state.plazaPostId) return;
    setBusy(true, render);
    try {
      await ensureSession();
      await api.createPlazaReply(state.plazaPostId, { body });
      state.plazaReplyDraft = "";
      await loadPlazaThread({ silent: true });
      setToast("评论已发布", render);
    } catch (error) {
      setToast(formatApiError(error, "评论失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function handlePlayerSearch(form) {
    const q = form.q.value.trim();
    state.playerSearchQuery = q;
    if (q.length < 2) return setToast("请输入至少 2 个字", render);
    setBusy(true, render);
    try {
      await ensureSession();
      state.playerSearchResults = await api.searchPlayers(q);
    } catch (error) {
      setToast(formatApiError(error, "搜索失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function handleDmSend(form) {
    const body = form.body.value.trim();
    if (!body || !state.dmConversationId) return;
    setBusy(true, render);
    try {
      await ensureSession();
      await api.sendDmMessage(state.dmConversationId, body);
      state.dmDraftBody = "";
      state.dmScrollStickBottom = true;
      await Promise.all([loadDmThread({ silent: true }), loadDmConversations({ silent: true })]);
    } catch (error) {
      setToast(formatApiError(error, "发送失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function handlePlazaReport(targetType, targetId) {
    openModalState({
      kind: "report",
      title: "举报内容",
      targetType,
      targetId
    });
    render();
  }

  async function submitPlazaReport() {
    const reason = (state.modalDraft || "").trim();
    if (reason.length < 4) return setToast("请填写至少 4 个字的举报原因", render);
    const { targetType, targetId } = state.modal || {};
    if (!targetType || !targetId) return;
    setBusy(true, render);
    try {
      await ensureSession();
      await api.reportPlaza({ targetType, targetId, reason });
      closeModalState();
      setToast("已提交举报，感谢反馈", render);
    } catch (error) {
      setToast(formatApiError(error, "举报失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function loadPlazaPosts({ silent = false } = {}) {
    if (!silent) setBusy(true, render);
    try {
      const kind = state.plazaFilter === "all" ? undefined : state.plazaFilter;
      state.plazaPosts = await api.plazaPosts({ kind });
      state.plazaError = "";
    } catch (error) {
      state.plazaError = formatApiError(error, "广场加载失败");
      if (!state.plazaPosts) state.plazaPosts = { total: 0, items: [] };
    } finally {
      if (!silent) setBusy(false, render);
      else if (state.view === "plaza") render();
    }
  }

  async function handlePlazaSubmit(form) {
    const kind = form.kind.value === "recruit" ? "recruit" : "chat";
    const body = form.body.value.trim();
    const inviteCode = normalizeInviteCode(form.inviteCode?.value || "");
    if (!body) return setToast("请填写内容", render);
    setBusy(true, render);
    try {
      await ensureSession();
      const result = await api.createPlazaPost({
        kind,
        body,
        ...(kind === "recruit" && inviteCode ? { inviteCode } : {})
      });
      state.plazaDraftBody = "";
      state.plazaDraftInvite = "";
      state.plazaDraftKind = kind;
      if (result.reviewPending) {
        setToast(result.message || "帖子已提交，等待人工复核", render);
      } else {
        await loadPlazaPosts({ silent: true });
        setToast("已通过审核并发布到广场", render);
      }
    } catch (error) {
      setToast(formatApiError(error, "发布失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  return {
    loadPlazaThread,
    loadFriends,
    loadDmConversations,
    loadDmThread,
    openPlazaThread,
    openDmConversation,
    openDmWithPeer,
    handlePlazaReplySubmit,
    handlePlayerSearch,
    handleDmSend,
    handlePlazaReport,
    submitPlazaReport,
    loadPlazaPosts,
    handlePlazaSubmit
  };
}
