import { api } from "../api.js";
import {
  closeModal,
  modalEl,
  mountModal,
  studioField,
  studioOptionsHtml,
  studioSelect,
  studioValues
} from "../components/modal.js";
import { state } from "../state.js";
import { escapeHtml, formatTime, hostOperationLabel } from "../utils/format.js";
import { setHtml } from "../../../shared/safe-dom.js";
import { resolveHostStuckIntervention } from "../../../shared/host-stuck-intervention.js";
import { resolveSectionSegmentKey } from "../../../shared/segment-contract.js";
import { refreshHostClueMatrix, refreshHostPlayers, refreshHostRoom } from "./data.js";
import { pendingEventRoleIds } from "./host-event-queue.js";
import { hostRunbooks } from "../views/host-layout.js";

let showToastRef = () => {};

export function bindHostInterventionContext({ showToast }) {
  showToastRef = showToast;
}

function showToast(message) { showToastRef(message); }

export function grantModeLabel(mode) {
  return { auto: "自动发放", host_confirm: "主持确认", explore: "探索获得" }[mode] || "";
}

function grantTargetMatchesPlayer(player, roleKey) {
  if (!roleKey) return true;
  return [player.role_key, player.roleKey, player.role_slot_id, player.role_name, player.name]
    .filter(Boolean)
    .some((value) => String(value) === String(roleKey));
}

function hostActClueIds(actKey) {
  if (!actKey) return [];
  const book = hostRunbooks().find((item) =>
    [item.actKey, item.segmentKey, item.key]
      .filter(Boolean)
      .some((value) => String(value) === String(actKey))
  );
  return (book?.clueGrants || []).map((grant) => grant.clueId || grant.clue_id).filter(Boolean);
}

function sectionMatchesAct(section, actKey) {
  if (!actKey) return false;
  return String(resolveSectionSegmentKey(section, section.sequence || 1)) === String(actKey);
}

function sectionOptionsForRole(sections, roleId, actKey) {
  return sections
    .filter((section) => String(section.role_slot_id) === String(roleId))
    .slice()
    .sort((a, b) =>
      Number(sectionMatchesAct(b, actKey)) - Number(sectionMatchesAct(a, actKey))
      || (a.sequence || 0) - (b.sequence || 0)
    )
    .map((section) => ({
      id: section.id,
      name: `${sectionMatchesAct(section, actKey) ? "本幕 · " : ""}${section.sequence}. ${section.title}`
    }));
}

export function resolveInitialUnlockRoleId(players, sections, options = {}) {
  const requested = options.roleSlotId;
  if (requested && players.some((player) => String(player.role_slot_id) === String(requested))) {
    return requested;
  }
  const matching = players.find((player) => sections.some((section) =>
    String(section.role_slot_id) === String(player.role_slot_id)
    && sectionMatchesAct(section, options.actKey || "")
  ));
  return matching?.role_slot_id || players[0]?.role_slot_id || "";
}

export async function kickHostPlayer(roleSlotId) {
  const player = (state.cloudHostPlayers || []).find(
    (item) => String(item.role_slot_id) === String(roleSlotId)
  );
  if (!player?.joined) return showToast("该席位尚无玩家");
  const name = player.player_display_name || "玩家";
  if (!window.confirm(`确定将「${name}」移出角色「${player.role_name}」？\n\n同账号重新选角可继承进度；其他账号接席将从零开始。`)) return;
  try {
    await api.hostKickPlayer(roleSlotId);
    closeModal();
    await refreshHostRoom();
    showToast(`已移出 ${name}`);
  } catch (error) {
    showToast(error.message);
  }
}

export async function openHostPlayerDetail(roleSlotId) {
  try {
    const detail = await api.getHostPlayerDetail(roleSlotId);
    const role = detail.role;
    const sectionRows = detail.sections.map((section) => {
      const stateLabel = section.completed ? "已完成" : section.unlocked || section.sequence === 1 ? "可阅读" : "未解锁";
      const actions = [
        !section.completed && !(section.unlocked || section.sequence === 1)
          ? `<button class="text-btn" data-unlock-section="${escapeHtml(section.id)}" data-role="${escapeHtml(roleSlotId)}">解锁</button>` : "",
        !section.completed
          ? `<button class="text-btn" data-skip-section="${escapeHtml(section.id)}" data-role="${escapeHtml(roleSlotId)}">跳过并完成</button>` : "",
        section.unlocked && Number(section.sequence) > 1
          ? `<button class="text-btn danger-text" data-relock-section="${escapeHtml(section.id)}" data-role="${escapeHtml(roleSlotId)}">撤回</button>` : ""
      ].filter(Boolean).join("");
      return `<div class="host-detail-row"><div><strong>${section.sequence}. ${escapeHtml(section.title)}</strong><p>${stateLabel} · ${escapeHtml(section.publication_status)}</p></div><div class="row">${section.completed ? `<span class="status-chip published">完成</span>` : ""}${actions}</div></div>`;
    }).join("") || `<div class="empty-state">尚无分幕。</div>`;
    const clueRows = detail.clues.map((clue) => `<div class="host-detail-row"><div><strong>${escapeHtml(clue.name)}</strong><p>${clue.read_at ? "已阅读" : "未阅读"}${clue.shared_with_room ? " · 已公开" : ""} · ${formatTime(clue.acquired_at)}</p>${clue.player_note ? `<small>玩家解读：${escapeHtml(clue.player_note)}</small>` : ""}${clue.host_note ? `<small>主持备注：${escapeHtml(clue.host_note)}</small>` : ""}</div><div class="row"><button class="text-btn" data-resend-clue="${escapeHtml(clue.id)}" data-role="${escapeHtml(roleSlotId)}">补发</button><button class="text-btn danger-text" data-revoke-clue="${escapeHtml(clue.id)}" data-role="${escapeHtml(roleSlotId)}">撤回</button></div></div>`).join("") || `<div class="empty-state">尚未获得线索。</div>`;
    mountModal();
    modalEl.root.className = "modal host-detail-modal";
    setHtml(modalEl.root, `<h2>${escapeHtml(role.player_display_name || role.name)} · ${escapeHtml(role.name)}</h2><p class="wizard-intro">${escapeHtml(role.public_profile || "尚未补充公开身份")}</p><aside class="tutorial-tip"><strong>该玩家现在知道什么</strong><span>下方汇总其可读分幕、已获得线索、调查、笔记与最近操作。撤回只会移除当前访问权，不会抹去玩家已看过的记忆、笔记或审计历史。</span></aside><div class="host-detail-grid"><section><h3>分幕进度</h3><div class="host-detail-list">${sectionRows}</div></section><section><h3>线索 · ${detail.clues.length}</h3><div class="host-detail-list">${clueRows}</div></section><section><h3>调查记录 · ${detail.investigations.length}</h3><div class="host-detail-list">${detail.investigations.map((item) => `<div class="host-detail-row"><strong>${escapeHtml(item.point_name)}</strong><p>${escapeHtml(item.scene_name)} · ${formatTime(item.investigated_at)}</p></div>`).join("") || `<div class="empty-state">尚无调查记录。</div>`}</div></section><section><h3>笔记 · ${detail.notes.length}</h3><div class="host-detail-list">${detail.notes.slice(0, 6).map((note) => `<div class="host-detail-row"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.body.slice(0, 80))}</p></div>`).join("") || `<div class="empty-state">尚无笔记。</div>`}</div></section><section><h3>最近日志</h3><div class="host-detail-list">${detail.recentLogs.slice(0, 8).map((log) => `<div class="host-detail-row"><strong>${escapeHtml(hostOperationLabel(log.event_type, log.message))}</strong><p>${escapeHtml(log.message)} · ${formatTime(log.created_at)}</p></div>`).join("") || `<div class="empty-state">尚无相关日志。</div>`}</div></section></div><label>主持备注</label><textarea class="field" rows="3" data-host-notes>${escapeHtml(role.host_notes || "")}</textarea><div class="modal-actions">${role.player_display_name ? `<button class="secondary-btn host-kick-btn" data-kick-player="${escapeHtml(roleSlotId)}">踢出玩家</button>` : ""}<button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-save-host-notes>保存备注</button></div>`);
    modalEl.backdrop.classList.add("show");
    modalEl.root.querySelector("[data-close]").onclick = closeModal;
    const kickButton = modalEl.root.querySelector("[data-kick-player]");
    if (kickButton) kickButton.onclick = () => kickHostPlayer(kickButton.dataset.kickPlayer);
    modalEl.root.querySelector("[data-save-host-notes]").onclick = async () => {
      try {
        await api.hostSaveNotes(roleSlotId, modalEl.root.querySelector("[data-host-notes]").value);
        closeModal();
        await refreshHostPlayers();
        showToast("主持备注已保存");
      } catch (error) { showToast(error.message); }
    };
    modalEl.root.querySelectorAll("[data-unlock-section]").forEach((button) => {
      button.onclick = async () => {
        try {
          await api.hostUnlockSection({
            roleSlotId: button.dataset.role,
            scriptSectionId: button.dataset.unlockSection
          });
          closeModal();
          await refreshHostRoom();
          showToast("分幕已手动解锁");
        } catch (error) { showToast(error.message); }
      };
    });
    modalEl.root.querySelectorAll("[data-skip-section]").forEach((button) => {
      button.onclick = async () => {
        if (!window.confirm("跳过会把该分幕标记为完成，并可能触发后续自动规则。确定继续？")) return;
        try {
          await api.hostSkipSection({
            roleSlotId: button.dataset.role,
            scriptSectionId: button.dataset.skipSection
          });
          closeModal();
          await refreshHostRoom();
          showToast("已跳过分幕并继续推进");
        } catch (error) { showToast(error.message); }
      };
    });
    modalEl.root.querySelectorAll("[data-relock-section]").forEach((button) => {
      button.onclick = async () => {
        if (!window.confirm("确定撤回这个分幕的阅读权限？已产生的阅读记录和玩家笔记会保留。")) return;
        try {
          await api.hostRelockSection({
            roleSlotId: button.dataset.role,
            scriptSectionId: button.dataset.relockSection
          });
          closeModal();
          await refreshHostRoom();
          showToast("分幕访问权已撤回");
        } catch (error) { showToast(error.message); }
      };
    });
    modalEl.root.querySelectorAll("[data-resend-clue]").forEach((button) => {
      button.onclick = async () => {
        try {
          await api.hostResendClue({ roleSlotId: button.dataset.role, clueId: button.dataset.resendClue });
          closeModal();
          await refreshHostRoom();
          showToast("线索已重新推送");
        } catch (error) { showToast(error.message); }
      };
    });
    modalEl.root.querySelectorAll("[data-revoke-clue]").forEach((button) => {
      button.onclick = async () => {
        if (!window.confirm("确定撤回该玩家的线索访问权？已产生的笔记、分享和审计记录不会被抹除。")) return;
        try {
          await api.hostRevokeClue({ roleSlotId: button.dataset.role, clueId: button.dataset.revokeClue });
          closeModal();
          await refreshHostRoom();
          showToast("线索访问权已撤回");
        } catch (error) { showToast(error.message); }
      };
    });
  } catch (error) {
    showToast(error.message);
  }
}

export async function openHostClueNote(clueId, roleSlotId) {
  const matrix = state.cloudHostClueMatrix;
  const clue = (matrix?.clues || []).find((row) => row.id === clueId);
  const player = (matrix?.players || []).find((row) => row.role_slot_id === roleSlotId);
  if (!clue || !player) return showToast("找不到线索或玩家席位");
  const existing = matrix?.cells?.[clueId]?.[roleSlotId]?.hostNote || "";
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>线索主持备注</h2><p class="wizard-intro">${escapeHtml(player.player_display_name || player.role_name)} · ${escapeHtml(clue.name)}</p><textarea class="field" rows="4" data-host-clue-note>${escapeHtml(existing)}</textarea><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-save-host-clue-note>保存备注</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-save-host-clue-note]").onclick = async () => {
    try {
      await api.hostClueNote(clueId, {
        roleSlotId,
        hostNote: modalEl.root.querySelector("[data-host-clue-note]").value
      });
      closeModal();
      await refreshHostClueMatrix();
      showToast("线索主持备注已保存");
    } catch (error) { showToast(error.message); }
  };
}

export function openHostGrantClueModal(options = {}) {
  const players = (state.cloudHostPlayers || []).filter((player) => player.joined);
  const clues = state.studio?.clues || [];
  if (!players.length) return showToast("当前没有已加入的玩家");
  if (!clues.length) return showToast("当前世界尚未创建线索");
  const actClueIds = hostActClueIds(options.actKey);
  const actClueSet = new Set(actClueIds.map(String));
  const selectedClueId = options.clueId || actClueIds[0] || clues[0]?.id || "";
  const clueOptions = clues.slice()
    .sort((a, b) => Number(actClueSet.has(String(b.id))) - Number(actClueSet.has(String(a.id))) || String(a.name || "").localeCompare(String(b.name || "")))
    .map((clue) => {
      const suffix = clue.metadata?.grantMode && clue.metadata.grantMode !== "auto"
        ? ` · ${grantModeLabel(clue.metadata.grantMode)}` : "";
      return { id: clue.id, name: `${actClueSet.has(String(clue.id)) ? "本幕 · " : ""}${clue.name}${suffix}` };
    });
  const checkedRoleIds = new Set(players
    .filter((player) => grantTargetMatchesPlayer(player, options.roleKey || ""))
    .map((player) => String(player.role_slot_id)));
  const message = options.actKey ? "主持人按当前幕手册发放线索" : "主持人手动发放线索";
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>手动发放线索</h2><p class="wizard-intro">${options.actKey ? "已按当前幕预选线索与目标；" : "可一次发给多名玩家；"}每人独立获得 clue_ownership，不会默认公开给全房间。标注「主持确认」的线索通常由规则触发，此处为手动 override。</p><div class="form-group">${studioSelect("线索", "grantClue", clueOptions, selectedClueId)}<label>目标角色（可多选）</label><div class="member-picker">${players.map((player) => `<label><input type="checkbox" data-grant-role value="${escapeHtml(player.role_slot_id)}" ${checkedRoleIds.has(String(player.role_slot_id)) ? "checked" : ""}> <span><b>${escapeHtml(player.player_display_name || "玩家")}</b> · ${escapeHtml(player.role_name)}</span></label>`).join("")}</div>${studioField("日志说明", "grantMessage", "input", message)}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-submit>确认发放</button></div>`);
  modalEl.backdrop.classList.add("show");
  const messageInput = modalEl.root.querySelector('[data-studio-field="grantMessage"]');
  if (messageInput) messageInput.value = message;
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-host-grant-submit]").onclick = async () => {
    try {
      const values = studioValues();
      const roleSlotIds = [...modalEl.root.querySelectorAll("[data-grant-role]:checked")].map((item) => item.value);
      if (!roleSlotIds.length) return showToast("请至少选择一名玩家");
      await api.hostGrantClue({ roleSlotIds, clueId: values.grantClue, message: values.grantMessage });
      closeModal();
      await refreshHostRoom();
      showToast(`线索已发放给 ${roleSlotIds.length} 名玩家`);
    } catch (error) { showToast(error.message); }
  };
}

export function openHostGrantItemModal() {
  const players = (state.cloudHostPlayers || []).filter((player) => player.joined);
  const items = state.studio?.items || [];
  if (!players.length) return showToast("当前没有已加入的玩家");
  if (!items.length) return showToast("当前世界尚未创建物品");
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>手动发放物品</h2><p class="wizard-intro">物品会写入指定角色的背包（inventory），并可能触发 item_owned 规则。</p><div class="form-group">${studioSelect("目标角色", "grantRole", players.map((player) => ({ id: player.role_slot_id, name: `${player.player_display_name || "玩家"} · ${player.role_name}` })))}${studioSelect("物品", "grantItem", items.map((item) => ({ id: item.id, name: item.name })))}${studioField("数量", "grantQuantity", "input", "1")}${studioField("日志说明", "grantMessage", "input", "主持人手动发放物品")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-item-submit>确认发放</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-host-grant-item-submit]").onclick = async () => {
    try {
      const values = studioValues();
      await api.hostGrantItem({ roleSlotId: values.grantRole, itemId: values.grantItem, quantity: Math.max(1, Number(values.grantQuantity) || 1), message: values.grantMessage });
      closeModal();
      await refreshHostRoom();
      showToast("物品已发放");
    } catch (error) { showToast(error.message); }
  };
}

export function openHostUnlockSectionModal(options = {}) {
  const players = (state.cloudHostPlayers || []).filter((player) => player.joined);
  if (!players.length) return showToast("当前没有已加入的玩家");
  const sections = state.studio?.sections || [];
  const actKey = options.actKey || "";
  const firstRoleId = resolveInitialUnlockRoleId(players, sections, options);
  const message = actKey ? "主持人按当前幕手动解锁分幕" : "主持人手动解锁分幕";
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>手动解锁分幕</h2><p class="wizard-intro">${actKey ? "已按当前幕优先展示对应分幕；" : "解锁后，对应玩家即可阅读该私人分幕。"}</p><div class="form-group">${studioSelect("目标角色", "unlockRole", players.map((player) => ({ id: player.role_slot_id, name: `${player.player_display_name || "玩家"} · ${player.role_name}` })), firstRoleId)}${studioSelect("分幕", "unlockSection", sectionOptionsForRole(sections, firstRoleId, actKey))}${studioField("日志说明", "unlockMessage", "input", message)}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-unlock-submit>确认解锁</button></div>`);
  modalEl.backdrop.classList.add("show");
  const roleSelect = modalEl.root.querySelector('[data-studio-field="unlockRole"]');
  const sectionSelect = modalEl.root.querySelector('[data-studio-field="unlockSection"]');
  const messageInput = modalEl.root.querySelector('[data-studio-field="unlockMessage"]');
  if (messageInput) messageInput.value = message;
  const refreshSections = () => {
    const optionsHtml = sectionOptionsForRole(sections, roleSelect.value, actKey);
    setHtml(sectionSelect, optionsHtml.length ? studioOptionsHtml(optionsHtml, optionsHtml[0]?.id || "") : '<option value="">该角色尚无分幕</option>');
  };
  roleSelect.onchange = refreshSections;
  refreshSections();
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-host-unlock-submit]").onclick = async () => {
    try {
      const values = studioValues();
      if (!values.unlockSection) return showToast("请选择要解锁的分幕");
      await api.hostUnlockSection({ roleSlotId: values.unlockRole, scriptSectionId: values.unlockSection, message: values.unlockMessage });
      closeModal();
      await refreshHostRoom();
      showToast("分幕已解锁");
    } catch (error) { showToast(error.message); }
  };
}

export function openHostUnlockSceneModal() {
  const scenes = state.studio?.scenes || [];
  if (!scenes.length) return showToast("当前世界尚未创建场景");
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>手动开放场景</h2><p class="wizard-intro">开放后所有已入房玩家可在探索页看到该场景。</p><div class="form-group">${studioSelect("场景", "unlockScene", scenes.map((scene) => ({ id: scene.id, name: scene.name })))}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-scene-submit>确认开放</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-host-scene-submit]").onclick = async () => {
    try {
      await api.hostUnlockScene(modalEl.root.querySelector('[data-studio-field="unlockScene"]').value);
      closeModal();
      await refreshHostRoom();
      showToast("场景已开放");
    } catch (error) { showToast(error.message); }
  };
}

export function openHostLogModal() {
  const players = (state.cloudHostPlayers || []).filter((player) => player.joined);
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>添加主持日志</h2><p class="wizard-intro">记录会写入本房间的时间线，可在世界运行日志中查看。</p><div class="form-group">${studioSelect("关联角色", "logRole", [{ id: "", name: "不指定角色" }, ...players.map((player) => ({ id: player.role_slot_id, name: `${player.player_display_name || "玩家"} · ${player.role_name}` }))])}${studioField("日志内容", "logMessage", "textarea", "例如：提醒林夏继续阅读序章")}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-log-submit>写入日志</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-host-log-submit]").onclick = async () => {
    try {
      const values = studioValues();
      const payload = { message: values.logMessage, eventType: "host_note" };
      if (values.logRole) payload.roleSlotId = values.logRole;
      await api.hostAddLog(payload);
      closeModal();
      await refreshHostRoom();
      showToast("主持日志已写入");
    } catch (error) { showToast(error.message); }
  };
}

export function openHostStuckIntervention(roleSlotId = "") {
  const resolved = resolveHostStuckIntervention(state.cloudHostPlayers || [], roleSlotId);
  if (!resolved.ok) return showToast(resolved.reason || "当前没有需要干预的卡关玩家");
  const { action, target } = resolved;
  if (action === "unlock_section") return openHostUnlockSectionModal({ roleSlotId: target.role_slot_id });
  if (action === "inspect") return openHostPlayerDetail(target.role_slot_id);
  if (action === "invite") return showToast("该席位尚未有玩家加入，请分享邀请链接");
  return openHostNudgeWaitingModal(roleSlotId, "stuck");
}

export function openHostNudgeWaitingModal(roleSlotId = "", mode = "waiting") {
  const allPlayers = (state.cloudHostPlayers || []).filter((player) => player.joined);
  const waitingIds = pendingEventRoleIds();
  const isStuck = mode === "stuck";
  const players = isStuck
    ? allPlayers.filter((player) => player.maybe_stuck && (!roleSlotId || String(player.role_slot_id) === String(roleSlotId)))
    : allPlayers.filter((player) => !waitingIds.size || waitingIds.has(String(player.role_slot_id)));
  if (!players.length) return showToast(isStuck ? "当前没有需要干预的卡关玩家" : "当前没有已入房且可能在等待的玩家");
  const defaultMessage = isStuck
    ? players[0]?.suggested_nudge || "当前剧情似乎停住了，可以查看「现在」页的建议下一步，或联系主持人获取提示。"
    : "主持人正在处理待确认事件，请稍候 — 确认后新内容会自动解锁。";
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>${isStuck ? "帮助卡关玩家" : "提醒等待中的玩家"}</h2><p class="wizard-intro">${isStuck ? "系统已根据玩家进度生成建议话术，发送前可以修改。" : "消息会通过实时推送送达 play 端与玩家视角，不会发送站外私信。"}</p><div class="form-group"><label>提醒内容</label><textarea class="field" rows="3" data-nudge-message>${escapeHtml(defaultMessage)}</textarea><label>通知对象</label><div class="member-picker">${players.map((player) => `<label><input type="checkbox" data-nudge-role value="${escapeHtml(player.role_slot_id)}" checked> <span><b>${escapeHtml(player.player_display_name || "玩家")}</b> · ${escapeHtml(player.role_name)}${player.stuck_label ? ` · ${escapeHtml(player.stuck_label)}` : ""}</span></label>`).join("")}</div></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-nudge-submit>发送提醒</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-nudge-submit]").onclick = async () => {
    try {
      const message = modalEl.root.querySelector("[data-nudge-message]").value;
      const roleSlotIds = [...modalEl.root.querySelectorAll("[data-nudge-role]:checked")].map((item) => item.value);
      if (!roleSlotIds.length) return showToast("请至少选择一名玩家");
      const result = await api.hostNudgeWaiting({ message, roleSlotIds });
      closeModal();
      showToast(`已提醒 ${result.notifiedCount} 名玩家`);
    } catch (error) { showToast(error.message); }
  };
}
