import { setHtml } from "../../../shared/safe-dom.js";
import { createModalFocusController } from "../../../shared/modal-focus.js";

export function createPlayViewController({
  app,
  state,
  renderApp,
  persistGameSession,
  scrollRestoreKey,
  shouldAutoScrollNearBottom,
  bindPlayReader,
  patchGameSectionsTab,
  getGamePatchCtx,
  setToast,
  syncPlayUrl
}) {
  const modalFocus = createModalFocusController({
    backdropSelector: ".modal-backdrop.is-open",
    closeSelector: "[data-action='modal-close'], [data-action='profile-close']",
    titleIdPrefix: "play-modal-title"
  });

  function bindModalFocus(snapshot) {
    if (snapshot) modalFocus.afterRender(snapshot);
    else modalFocus.sync();
  }

  function render() {
    const modalSnapshot = modalFocus.beforeRender();
    if (state.view === "game" && state.roomId) persistGameSession();
    const restoreKey = scrollRestoreKey(state);
    const scrollTop = window.scrollY;
    const dmEl = state.view === "dm" ? document.querySelector("[data-dm-scroll]") : null;
    const dmStickBottom = state.dmScrollStickBottom || shouldAutoScrollNearBottom(dmEl);
    const voiceLog = state.view === "game" && state.tab === "voice"
      ? document.querySelector("[data-voice-scroll]")
      : null;
    const voiceStickBottom = state.voiceScrollStickBottom || shouldAutoScrollNearBottom(voiceLog);

    setHtml(app, renderApp());
    if (state.view === "dm") {
      const element = document.querySelector("[data-dm-scroll]");
      if (element && dmStickBottom) element.scrollTop = element.scrollHeight;
      state.dmScrollStickBottom = false;
    }
    if (state.view === "game" && state.tab === "voice") {
      const element = document.querySelector("[data-voice-scroll]");
      if (element && voiceStickBottom) element.scrollTop = element.scrollHeight;
      state.voiceScrollStickBottom = false;
    }
    if (state.view === "game" && state.tab === "sections" && state.roomId) {
      bindPlayReader({
        roomId: state.roomId,
        notesSource: () => state.home,
        onPatch: () => patchGameSectionsTab(state, getGamePatchCtx()),
        onToast: (message) => setToast(message, render, { patch: true })
      });
    }
    if (scrollRestoreKey(state) === restoreKey) window.scrollTo(0, scrollTop);
    bindModalFocus(modalSnapshot);
    syncPlayUrl(state);
  }

  return { bindModalFocus, render };
}
