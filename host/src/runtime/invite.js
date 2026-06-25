import { api, getPlayOrigin } from "../api.js";
import { activeRuntimeRoom } from "../components/ui.js";
import {
  closeModal,
  modalEl,
  mountModal,
  studioField,
  studioValues
} from "../components/modal.js";
import { escapeHtml } from "../utils/format.js";
import { refreshHostRoom } from "../runtime/data.js";

let renderRef = () => {};
let showToastRef = (_msg) => {};

export function bindArchiveModalsContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() {
  renderRef();
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

export function openCreateRecapModal() {
  if (!activeRuntimeRoom()) return showToast("请先选择运行房");
  mountModal();
  modalEl.root.className = "modal";
  modalEl.root.innerHTML = `<h2>生成房间复盘</h2><p class="wizard-intro">系统会按章节串联全剧脉络（上帝视角），并汇总各角色阅读、线索、调查与笔记表现。</p><div class="form-group">${studioField("复盘标题", "recapTitle", "input", "例如：第一夜 · 完整复盘")}${studioField("主持备注", "recapDescription", "textarea", "记录本局结局、未解之谜或下次补充说明")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-recap-submit>确认生成</button></div>`;
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-recap-submit]").onclick = async () => {
    try {
      const values = studioValues();
      if (!values.recapTitle) return showToast("请填写复盘标题");
      await api.createRecap({ title: values.recapTitle, description: values.recapDescription });
      closeModal();
      await refreshHostRoom();
      render();
      showToast("房间复盘已生成");
    } catch (error) {
      showToast(error.message);
    }
  };
}

export function openCreateCheckpointModal() {
  if (!activeRuntimeRoom()) return showToast("请先选择运行房");
  mountModal();
  modalEl.root.className = "modal";
  modalEl.root.innerHTML = `<h2>创建运行房存档点</h2><p class="wizard-intro">保存当前玩家进度、线索归属、开放场景与待确认事件。</p><div class="form-group">${studioField("存档名称", "checkpointTitle", "input", "例如：第一夜收工")}${studioField("主持备注", "checkpointDescription", "textarea", "记录今晚推进到了哪里、下次从哪里继续")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-checkpoint-submit>确认创建</button></div>`;
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-checkpoint-submit]").onclick = async () => {
    try {
      const values = studioValues();
      if (!values.checkpointTitle) return showToast("请填写存档名称");
      await api.createCheckpoint({ title: values.checkpointTitle, description: values.checkpointDescription });
      closeModal();
      await refreshHostRoom();
      showToast("运行房存档点已创建");
    } catch (error) {
      showToast(error.message);
    }
  };
}

export function openRoomInviteModal() {
  const room = activeRuntimeRoom();
  if (!room) return showToast("请先选择运行房");
  const code = room.invite_code || "";
  mountModal();
  modalEl.root.className = "modal";
  modalEl.root.innerHTML = `<h2>邀请玩家</h2><p class="wizard-intro">${escapeHtml(room.name)} · 邀请码 <code>${escapeHtml(code)}</code></p><div class="modal-actions"><button class="secondary-btn" data-copy-code>复制邀请码</button><button class="secondary-btn" data-copy-link>复制玩家链接</button><button class="secondary-btn" data-close>关闭</button></div>`;
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-copy-code]").onclick = () => copyText(code, "邀请码");
  modalEl.root.querySelector("[data-copy-link]").onclick = () =>
    copyText(code ? `${getPlayOrigin()}/?join=${encodeURIComponent(code)}` : getPlayOrigin(), "玩家链接");
}

export async function copyInviteCode(code) {
  await copyText(code, "邀请码");
}

export async function copyPlayLink(code) {
  const url = code ? `${getPlayOrigin()}/?join=${encodeURIComponent(code)}` : getPlayOrigin();
  await copyText(url, "玩家链接");
}
