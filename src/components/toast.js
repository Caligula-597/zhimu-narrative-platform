/* Toast notifications — migrated to real ES Module exports. */
import { getToast } from "../dom.js";
import { roomStore } from "../state/index.js";
import { activeRuntimeRoom as workspaceActiveRuntimeRoom } from "../runtime/workspace-store.js";
function activeRuntimeRoom() {
  return workspaceActiveRuntimeRoom() ?? null;
}

let toastTimer = null;
function clearToastTimer() {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

export function showToast(text, duration = 2200) {
  const toast = getToast();
  if (!toast) return;
  toast.className = "toast";
  toast.textContent = text;
  toast.classList.add("show");
  clearToastTimer();
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

/**
 * Show a toast with an optional action button (e.g. "上报故障").
 * Decoupled from feedback-button.js — caller passes the onAction callback,
 * so no circular import is introduced.
 * @param {string} text
 * @param {{ actionLabel?: string, onAction?: () => void, duration?: number }} [opts]
 */
export function showToastWithAction(text, { actionLabel, onAction, duration = 6000 } = {}) {
  const toast = getToast();
  if (!toast) return;
  toast.className = "toast toast-with-action";
  toast.innerHTML = "";
  const msg = document.createElement("span");
  msg.className = "toast-message";
  msg.textContent = text;
  toast.appendChild(msg);
  if (actionLabel && typeof onAction === "function") {
    const btn = document.createElement("button");
    btn.className = "toast-action";
    btn.type = "button";
    btn.textContent = actionLabel;
    btn.onclick = () => {
      clearToastTimer();
      toast.classList.remove("show");
      try { onAction(); } catch (_) { /* ignore callback errors */ }
    };
    toast.appendChild(btn);
  }
  const dismiss = document.createElement("button");
  dismiss.className = "toast-dismiss";
  dismiss.type = "button";
  dismiss.setAttribute("aria-label", "关闭");
  dismiss.textContent = "×";
  dismiss.onclick = () => { clearToastTimer(); toast.classList.remove("show"); };
  toast.appendChild(dismiss);
  toast.classList.add("show");
  clearToastTimer();
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
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
    if (!badge) { badge = document.createElement("span"); badge.className = "notify-count"; btn.appendChild(badge); }
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
