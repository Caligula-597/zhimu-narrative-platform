/** DOM event wiring — extracted from app.js bootstrap. */
import { showToast, pendingHostEventCount } from "../components/toast.js";
import { closeModal } from "../components/modal.js";
import { activeRuntimeRoom } from "../components/emptyState.js";

export function initEvents({ content, modalBackdrop, R, go }) {
  content.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-go]");
    if (nav) {
      event.preventDefault();
      go(nav.dataset.go);
    }
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.view)));
  document.querySelector("#run-btn").onclick = () => window.open(window.zhimuInviteLinks?.hostConsoleUrl?.(), "_blank", "noopener,noreferrer");
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
  document.querySelector("#create-world-btn").onclick = () => R.openWizard();
  document.querySelector("#catalog-world-btn")?.addEventListener("click", () => R.openWorldLibrary("catalog"));
  document.querySelector(".world-switcher").onclick = () => R.openWorldLibrary();
  document.querySelector(".profile").onclick = () => R.openAuth();
  modalBackdrop.onclick = (e) => {
    if (e.target === modalBackdrop) closeModal();
  };
}
