export async function handlePlayContentAction({
  action, button, state, api, render, setBusy, setToast, formatApiError,
  loadRecapDetail, loadRecapSummary, patchGameHostBanner,
  handleAddNotebookEntry, handleDeleteNotebookEntry
}) {
  switch (action) {
    case "open-recap-detail":
      await loadRecapDetail();
      return true;
    case "reload-recap":
      await loadRecapSummary();
      return true;
    case "dismiss-host-nudge":
      state.hostNudge = null;
      if (!patchGameHostBanner()) render();
      return true;
    case "retry-exploration":
      setBusy(true, render);
      try {
        state.exploration = await api.exploration(state.roomId);
        state.explorationError = "";
        render();
      } catch (error) {
        state.explorationError = formatApiError(error, "探索数据加载失败");
        render();
      } finally {
        setBusy(false, render);
      }
      return true;
    case "add-notebook-entry":
      await handleAddNotebookEntry();
      return true;
    case "delete-notebook-entry":
      await handleDeleteNotebookEntry(button.dataset.noteId);
      return true;
    default:
      return false;
  }
}
