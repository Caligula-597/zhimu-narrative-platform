export async function handlePlaySocialAction(ctx) {
  const {
    action, button, state, render, api, setBusy, setToast, formatApiError,
    openModalState, closeModalState, normalizeInviteCode, syncPlatformStream,
    loadPublicRooms, loadPlazaPosts, openPlazaThread, handlePlazaReport,
    submitPlazaReport, loadPlazaThread, loadFriends, loadDmConversations,
    openDmConversation, openDmWithPeer, ensureSession, handleLookupInvite
  } = ctx;

  switch (action) {
    case "go-lobby":
      await loadPublicRooms();
      state.view = "lobby";
      syncPlatformStream();
      render();
      return true;
    case "go-plaza":
      await loadPlazaPosts();
      state.view = "plaza";
      syncPlatformStream();
      render();
      return true;
    case "go-friends":
      await loadFriends();
      state.view = "friends";
      syncPlatformStream();
      render();
      return true;
    case "go-messages":
    case "go-messages-ingame":
      await loadDmConversations();
      state.view = "messages";
      if (action === "go-messages") syncPlatformStream();
      render();
      return true;
    case "refresh-plaza":
      await loadPlazaPosts();
      return true;
    case "plaza-open":
      await openPlazaThread(button.dataset.postId);
      return true;
    case "plaza-delete-post":
      openModalState({
        kind: "confirm-delete-post",
        title: "删除帖子",
        message: "确定删除这条帖子？此操作不可撤销。",
        postId: button.dataset.postId
      });
      render();
      return true;
    case "plaza-delete-reply":
      openModalState({
        kind: "confirm-delete-reply",
        title: "删除评论",
        message: "确定删除这条评论？",
        replyId: button.dataset.replyId
      });
      render();
      return true;
    case "plaza-report":
      await handlePlazaReport(button.dataset.targetType, button.dataset.targetId);
      return true;
    case "modal-confirm":
      await confirmSocialDelete(ctx);
      return true;
    case "modal-submit-report":
      await submitPlazaReport();
      return true;
    case "friend-request":
      await runSocialMutation(ctx, {
        operation: async () => {
          await ensureSession();
          await api.sendFriendRequest(button.dataset.userId);
          await loadFriends({ silent: true });
        },
        success: "好友请求已发送",
        failure: "发送失败"
      });
      return true;
    case "friend-accept":
    case "friend-decline": {
      const accepted = action === "friend-accept";
      await runSocialMutation(ctx, {
        operation: async () => {
          await api.respondFriendRequest(button.dataset.userId, accepted);
          await loadFriends({ silent: true });
        },
        success: accepted ? "已添加好友" : "已拒绝请求",
        failure: "操作失败"
      });
      return true;
    }
    case "dm-open":
      await openDmConversation(button.dataset.conversationId);
      return true;
    case "dm-open-peer":
      await openDmWithPeer(button.dataset.userId);
      return true;
    case "plaza-filter":
      state.plazaFilter = button.dataset.kind || "all";
      await loadPlazaPosts();
      return true;
    case "plaza-join":
    case "lobby-join": {
      state.inviteCode = normalizeInviteCode(button.dataset.inviteCode || "");
      if (!state.inviteCode) {
        setToast(action === "plaza-join" ? "邀请码无效" : "房间无效", render);
        return true;
      }
      state.view = "join";
      state.joinStep = 1;
      await handleLookupInvite();
      return true;
    }
    case "refresh-lobby":
      await loadPublicRooms();
      return true;
    default:
      return false;
  }
}

async function confirmSocialDelete(ctx) {
  const { state, api, closeModalState, loadPlazaPosts, loadPlazaThread, setBusy, setToast, formatApiError, render } = ctx;
  const modal = state.modal;
  if (!modal || !["confirm-delete-post", "confirm-delete-reply"].includes(modal.kind)) return;
  setBusy(true, render);
  try {
    if (modal.kind === "confirm-delete-post") {
      await api.deletePlazaPost(modal.postId);
      closeModalState();
      state.view = "plaza";
      state.plazaPostId = "";
      await loadPlazaPosts();
      setToast("帖子已删除", render);
    } else {
      await api.deletePlazaReply(modal.replyId);
      closeModalState();
      await loadPlazaThread({ silent: true });
      setToast("评论已删除", render);
    }
  } catch (error) {
    setToast(formatApiError(error, "删除失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function runSocialMutation(ctx, { operation, success, failure }) {
  const { setBusy, setToast, formatApiError, render } = ctx;
  setBusy(true, render);
  try {
    await operation();
    setToast(success, render);
  } catch (error) {
    setToast(formatApiError(error, failure), render);
  } finally {
    setBusy(false, render);
  }
}
