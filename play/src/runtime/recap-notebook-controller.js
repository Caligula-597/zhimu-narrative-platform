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
      try {
        const library = await api.recapLibrary();
        state.recapLibrary = Array.isArray(library?.recaps) ? library.recaps : [];
        state.recapLibraryError = "";
      } catch (error) {
        state.recapLibraryError = formatApiError(error, "加载历史复盘失败");
      }
      state.recapLoading = false;
      if (!silent || state.tab === "recap") render();
    }
  }

  async function loadRecapDetail(recapId = "") {
    const targetId = recapId || state.recapLatest?.id;
    if (!targetId) return;
    setBusy(true, render);
    try {
      state.recapDetail = recapId
        ? await api.recapLibraryDetail(recapId)
        : await api.getRecap(state.roomId, targetId);
      state.recapLibrarySelected = recapId
        ? state.recapLibrary.find((entry) => entry.id === recapId) || state.recapDetail
        : null;
      state.recapId = state.recapDetail.id;
      render();
    } catch (error) {
      setToast(formatApiError(error, "无法打开复盘"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function hideRecapLibraryEntry(recapId) {
    if (!recapId) return;
    setBusy(true, render);
    try {
      await api.hideRecapLibraryEntry(recapId);
      state.recapLibrary = state.recapLibrary.filter((entry) => entry.id !== recapId);
      if (state.recapLibrarySelected?.id === recapId) {
        state.recapLibrarySelected = null;
        state.recapDetail = null;
      }
      setToast("已从你的复盘库移除；主持人的原始复盘未删除", render);
    } catch (error) {
      setToast(formatApiError(error, "移除复盘失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function updateRecapRetention(roomId, retentionDays) {
    if (!roomId || !Number.isSafeInteger(retentionDays)) return;
    setBusy(true, render);
    try {
      await api.updateRecapLibraryPreferences(roomId, retentionDays);
      await loadRecapSummary({ silent: true });
      setToast(retentionDays ? `本房间复盘仅保留最近 ${retentionDays} 天` : "本房间复盘设为长期保留", render);
    } catch (error) {
      setToast(formatApiError(error, "更新隐私期限失败"), render);
    } finally {
      setBusy(false, render);
    }
  }

  async function exportRecapLibraryEntry(recapId) {
    if (!recapId) return;
    try {
      const recap = await api.recapLibraryDetail(recapId);
      const blob = new Blob([JSON.stringify(recap, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zhimu-recap-${recapId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setToast("复盘已按你的角色视角导出", render);
    } catch (error) {
      setToast(formatApiError(error, "导出复盘失败"), render);
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
        sourceType: "manual", sourceId: null, title, body
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
    handleAddNotebookEntry, handleDeleteNotebookEntry,
    hideRecapLibraryEntry, updateRecapRetention, exportRecapLibraryEntry
  };
}
