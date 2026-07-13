export function createRecapNotebookController({
  api, state, render, setBusy, setToast, formatApiError, pullRoomData
}) {
  async function loadRecapSummary({ silent = false } = {}) {
    if (!state.roomId) return;
    if (!silent) {
      state.recapLoading = true;
      state.recapError = "";
      render();
    }
    try {
      state.recapLatest = await api.latestRecap(state.roomId);
      state.recapError = "";
    } catch (error) {
      if (error.code === "RECAP_NOT_GENERATED") {
        state.recapLatest = null;
        state.recapError = "";
      } else {
        state.recapError = formatApiError(error, "加载复盘失败");
      }
    } finally {
      state.recapLoading = false;
      if (!silent || state.tab === "recap") render();
    }
  }

  async function loadRecapDetail() {
    if (!state.roomId || !state.recapLatest?.id) return;
    setBusy(true, render);
    try {
      state.recapDetail = await api.getRecap(state.roomId, state.recapLatest.id);
      state.recapId = state.recapDetail.id;
      render();
    } catch (error) {
      setToast(formatApiError(error, "无法打开复盘"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function loadMyTimeline({ silent = false } = {}) {
    if (!state.roomId) return;
    if (!silent) {
      state.myTimelineLoading = true;
      state.myTimelineError = "";
      render();
    }
    try {
      state.myTimeline = await api.myTimeline(state.roomId);
      state.myTimelineError = "";
    } catch (error) {
      state.myTimelineError = formatApiError(error, "加载时间线失败");
    } finally {
      state.myTimelineLoading = false;
      if (!silent || state.tab === "timeline") render();
    }
  }

  async function handleAddNotebookEntry() {
    if (!state.roomId) return;
    const title = (state.notesDraftTitle || "").trim();
    const body = (state.notesDraft || "").trim();
    if (!title || !body) {
      setToast("请填写标题和正文", render);
      return;
    }
    setBusy(true, render);
    try {
      await api.addNotebookEntry(state.roomId, {
        sourceType: "free", sourceId: null, title, body
      });
      state.notesDraft = "";
      state.notesDraftTitle = "";
      await pullRoomData({ partial: true });
      setToast("笔记已保存", render);
    } catch (error) {
      setToast(formatApiError(error, "保存失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function handleDeleteNotebookEntry(entryId) {
    if (!state.roomId || !entryId) return;
    setBusy(true, render);
    try {
      await api.deleteNotebookEntry(state.roomId, entryId);
      await pullRoomData({ partial: true });
      setToast("笔记已删除", render);
    } catch (error) {
      setToast(formatApiError(error, "删除失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  return {
    loadRecapSummary, loadRecapDetail, loadMyTimeline,
    handleAddNotebookEntry, handleDeleteNotebookEntry
  };
}
