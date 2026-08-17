/** DOM event wiring — extracted from app.js bootstrap. */
import { showToast, pendingHostEventCount } from "../components/toast.js";
import { closeModal } from "../components/modal.js";
import { activeRuntimeRoom } from "../components/emptyState.js";
import { uiStore } from "../state/index.js";

export function initEvents({ content, modalBackdrop, R, go }) {
  function dispatchDelegatedAction(event, root) {
    const nav = event.target.closest("[data-go]");
    if (nav && root.contains(nav)) {
      event.preventDefault();
      go(nav.dataset.go);
      return true;
    }
    const action = event.target.closest("[data-action]");
    if (action && root.contains(action)) {
      event.preventDefault();
      R.handle?.(action.dataset.action, action);
      return true;
    }
    return false;
  }

  content.addEventListener("click", (event) => {
    dispatchDelegatedAction(event, content);
  });
  content.addEventListener("change", (event) => {
    const action = event.target.closest("[data-action]");
    if (action && content.contains(action)) R.handle?.(action.dataset.action, action);
  });

  const mainNav = document.querySelector(".main-nav");
  mainNav?.addEventListener("click", (event) => {
    dispatchDelegatedAction(event, mainNav);
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.view)));
  document.querySelector("#run-btn").onclick = () => {
    if (document.body.dataset.productMode === "board-game") {
      if (uiStore.get().view === "boardGame") {
        void R.handle?.("board-tab-select", { dataset: { boardTab: "playground" } });
        return;
      }
      uiStore.set({ boardGameRequestedTab: "playground" });
      go("boardGame");
      return;
    }
    window.open(window.zhimuInviteLinks?.hostConsoleUrl?.(), "_blank", "noopener,noreferrer");
  };
  document.querySelector("#preview-btn").onclick = () => {
    const room = activeRuntimeRoom();
    window.open(window.zhimuInviteLinks?.playerJoinUrl?.(room?.invite_code), "_blank", "noopener,noreferrer");
  };
  document.querySelector("#search-btn").onclick = () => window.zhimuGlobalSearch?.openGlobalSearch?.();
  document.querySelector("#auth-banner-login")?.addEventListener("click", () => R.openAuth());
  document.querySelector("#notify-btn").onclick = () => {
    if (!activeRuntimeRoom()) return showToast("请先选择运行房后再查看主持待办");
    window.open(window.zhimuInviteLinks?.hostConsoleUrl?.(), "_blank", "noopener,noreferrer");
    if (!pendingHostEventCount()) showToast("当前没有待确认事件，已为你打开独立主持端");
  };
  document.querySelector("#create-world-btn").onclick = () => R.openWizard(
    document.body.dataset.productMode === "board-game" ? "board_game" : ""
  );
  document.querySelector("#catalog-world-btn")?.addEventListener("click", () => R.openWorldLibrary("catalog"));
  document.querySelector(".world-switcher").onclick = () => R.openWorldLibrary();
  document.querySelector(".profile").onclick = () => R.openAuth();
  modalBackdrop.onclick = (event) => {
    if (dispatchDelegatedAction(event, modalBackdrop)) return;
    if (event.target === modalBackdrop) closeModal();
  };
  modalBackdrop.addEventListener("change", (event) => {
    const action = event.target.closest("[data-action]");
    if (action && modalBackdrop.contains(action)) R.handle?.(action.dataset.action, action);
  });
}
