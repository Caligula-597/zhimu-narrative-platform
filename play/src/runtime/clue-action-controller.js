export async function handlePlayClueAction({
  action,
  button,
  state,
  api,
  render,
  setBusy,
  setToast,
  formatApiError,
  openModalState,
  closeModalState,
  pullRoomData
}) {
  const clueId = button.dataset.clueId;
  switch (action) {
    case "edit-clue-note": {
      const clue = findOwnedClue(state, clueId);
      if (!clue) {
        setToast("线索不存在", render);
        return true;
      }
      openModalState({
        kind: "clue-note",
        title: `我的线索解读 · ${clue.name}`,
        clueId: clue.id,
        initialNote: clue.player_note || ""
      });
      render();
      return true;
    }
    case "share-clue-room":
      await shareClueRoom({ clue: findOwnedClue(state, clueId), state, api, render, setBusy, setToast, formatApiError, pullRoomData });
      return true;
    case "share-clue-roles": {
      const clue = findOwnedClue(state, clueId);
      if (!clue) {
        setToast("线索不存在", render);
        return true;
      }
      openModalState({
        kind: "clue-share",
        title: `私享线索 · ${clue.name}`,
        clueId: clue.id,
        initialRoles: clue.shared_with_roles || []
      });
      render();
      return true;
    }
    case "modal-save-clue-note":
      await saveClueMutation({
        state, api, render, setBusy, setToast, formatApiError, closeModalState, pullRoomData, clueId,
        operation: () => api.updateCluePlayerNote(state.roomId, clueId, state.modalDraft || ""),
        success: "线索解读已保存"
      });
      return true;
    case "modal-save-clue-share": {
      const roles = state.clueShareRoles || [];
      await saveClueMutation({
        state, api, render, setBusy, setToast, formatApiError, closeModalState, pullRoomData, clueId,
        operation: () => api.shareClueToRoles(state.roomId, clueId, roles),
        success: roles.length ? `已私享给 ${roles.length} 名玩家` : "已清空私享名单"
      });
      return true;
    }
    default:
      return false;
  }
}

function findOwnedClue(state, clueId) {
  return (state.home?.clues || []).find((clue) => clue.id === clueId);
}

async function shareClueRoom({ clue, state, api, render, setBusy, setToast, formatApiError, pullRoomData }) {
  if (!clue) {
    setToast("线索不存在", render);
    return;
  }
  setBusy(true, render);
  try {
    const next = !clue.shared_with_room;
    await api.shareClueToRoom(state.roomId, clue.id, next);
    await pullRoomData();
    state.clueId = clue.id;
    setToast(next ? `已公开「${clue.name}」到全房间` : `已取消公开「${clue.name}」`, render);
  } catch (error) {
    setToast(formatApiError(error, "操作失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function saveClueMutation(ctx) {
  const { state, render, setBusy, setToast, formatApiError, closeModalState, pullRoomData, clueId, operation, success } = ctx;
  setBusy(true, render);
  try {
    await operation();
    closeModalState();
    await pullRoomData();
    state.clueId = clueId;
    setToast(success, render);
  } catch (error) {
    setToast(formatApiError(error, "保存失败"), render);
  } finally {
    setBusy(false, render);
  }
}
