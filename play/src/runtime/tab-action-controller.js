export async function handlePlayTabAction({
  action, button, state, render, gamePatchCtx,
  flushPendingRoomRefresh, defaultGameTabFor, tabGroupFor, clearTabPulse,
  primaryTabFor, patchGameTabSwitch, syncPlayUrl, ensureDefaultVoiceRoom,
  refreshVoiceMessages, loadRecapSummary, loadMyTimeline, bindPlayReader,
  pullRoomData, setToast
}) {
  if (action !== "switch-tab") return false;
  await flushPendingRoomRefresh();
  state.tab = defaultGameTabFor(button.dataset.primaryTab || button.dataset.tab);
  for (const tabId of tabGroupFor(state.tab)) clearTabPulse(tabId);
  const primaryTab = primaryTabFor(state.tab);

  if (state.view === "game" && patchGameTabSwitch(state, gamePatchCtx)) {
    syncPlayUrl(state);
    if (state.tab === "voice") {
      ensureDefaultVoiceRoom();
      if (state.voiceRoomId) {
        await refreshVoiceMessages(render, { silent: true }).catch(() => {});
        patchGameTabSwitch(state, gamePatchCtx);
      }
    } else if (primaryTab === "recap") {
      await loadRecapSummary({ silent: true });
      if (state.roomId) await loadMyTimeline({ silent: true });
      patchGameTabSwitch(state, gamePatchCtx);
    } else if (primaryTab === "story" && state.roomId) {
      bindPlayReader({
        roomId: state.roomId,
        notesSource: () => state.home,
        onRefresh: async () => pullRoomData({ partial: true }),
        onToast: (message) => setToast(message, render)
      });
    } else if (state.tab === "timeline" && state.roomId) {
      await loadMyTimeline({ silent: true });
      patchGameTabSwitch(state, gamePatchCtx);
    }
    return true;
  }

  if (state.tab === "voice") {
    ensureDefaultVoiceRoom();
    if (state.voiceRoomId) await refreshVoiceMessages(render).catch(() => render());
    else render();
  } else if (primaryTab === "recap") {
    await loadRecapSummary();
    if (state.roomId) await loadMyTimeline({ silent: true });
  } else if (state.tab === "timeline" && state.roomId) {
    await loadMyTimeline();
  } else {
    render();
  }
  return true;
}
