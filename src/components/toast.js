/* Toast notifications — uses shared DOM toast controller. */
import { getToast } from "../dom.js";
import { createDomToastController } from "../../shared/toast.js";
import { roomStore } from "../state/index.js";
import { activeRuntimeRoom as workspaceActiveRuntimeRoom } from "../runtime/workspace-store.js";

function activeRuntimeRoom() {
  return workspaceActiveRuntimeRoom() ?? null;
}

const domToast = createDomToastController(getToast, 2200);

export function showToast(text, duration = 2200) {
  domToast.show(text, duration);
}

/**
 * Show a toast with an optional action button (e.g. "上报故障").
 * @param {string} text
 * @param {{ actionLabel?: string, onAction?: () => void, duration?: number }} [opts]
 */
export function showToastWithAction(text, { actionLabel, onAction, duration = 6000 } = {}) {
  domToast.showWithAction(text, { actionLabel, onAction, duration });
}

export function pendingHostEventCount() {
  return activeRuntimeRoom() ? (roomStore.get().cloudHostEvents || []).length : 0;
}

export function updateNotifyBadge() {
  const btn = document.querySelector("#notify-btn");
  if (!btn) return;
  const count = pendingHostEventCount();
  let badge = btn.querySelector(".notify-count");
  const dot = btn.querySelector(".notify");
  if (count > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notify-count";
      btn.appendChild(badge);
    }
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.style.display = "";
    if (dot) dot.style.display = "none";
    btn.setAttribute("aria-label", `${count} 条待确认主持事件`);
  } else {
    if (badge) badge.style.display = "none";
    if (dot) dot.style.display = "none";
    btn.setAttribute("aria-label", "通知");
  }
}
