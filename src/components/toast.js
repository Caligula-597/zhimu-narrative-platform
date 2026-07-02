/* Toast notifications — migrated to real ES Module exports. */
import { getToast } from "../dom.js";
import { roomStore } from "../state/index.js";
import { activeRuntimeRoom as workspaceActiveRuntimeRoom } from "../runtime/workspace-store.js";
function activeRuntimeRoom() {
  return window.zhimuUi?.activeRuntimeRoom?.() ?? workspaceActiveRuntimeRoom() ?? null;
}

export function showToast(text, duration = 2200) {
  const toast = getToast();
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
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
