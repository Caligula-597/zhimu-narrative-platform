import { getPlayerJoinUrl } from "../api.js";
import { activeRuntimeRoom } from "../components/ui.js";
import {
  closeModal,
  modalEl,
  mountModal
} from "../components/modal.js";
import { escapeHtml } from "../utils/format.js";
import { setHtml } from "../../../shared/safe-dom.js";

let showToastRef = (_msg) => {};

export function bindInviteContext({ showToast }) {
  showToastRef = showToast;
}

function showToast(msg) {
  showToastRef(msg);
}

async function copyText(text, label) {
  if (!text) return showToast(`${label}为空`);
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label}已复制`);
  } catch {
    showToast("复制失败，请手动复制");
  }
}

export function openRoomInviteModal() {
  const room = activeRuntimeRoom();
  if (!room) return showToast("请先选择运行房");
  const code = room.invite_code || "";
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>邀请玩家</h2><p class="wizard-intro">${escapeHtml(room.name)} · 邀请码 <code>${escapeHtml(code)}</code></p><div class="modal-actions"><button class="secondary-btn" data-copy-code>复制邀请码</button><button class="secondary-btn" data-copy-link>复制玩家链接</button><button class="secondary-btn" data-close>关闭</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-copy-code]").onclick = () => copyText(code, "邀请码");
  modalEl.root.querySelector("[data-copy-link]").onclick = () =>
    copyText(getPlayerJoinUrl(code), "玩家链接");
}

export async function copyInviteCode(code) {
  await copyText(code, "邀请码");
}

export async function copyPlayLink(code) {
  await copyText(getPlayerJoinUrl(code), "玩家链接");
}
