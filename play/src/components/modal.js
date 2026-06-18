import { escapeHtml } from "../security.js";
import { state } from "../state.js";

export function renderModal() {
  const modal = state.modal;
  if (!modal) return "";

  const { kind, title, message = "" } = modal;

  let body = "";
  if (kind === "report") {
    body = `
      <p class="modal-lede">${escapeHtml(message || "请简要说明举报原因（4～200 字）")}</p>
      <textarea class="field" rows="4" maxlength="200" placeholder="描述具体问题…" data-bind="modalDraft" required>${escapeHtml(state.modalDraft || "")}</textarea>`;
  } else if (kind === "clue-note") {
    body = `
      <p class="modal-lede">写下你对这条线索的理解。公开线索时，其他玩家也能看到你的解读。</p>
      <textarea class="field" rows="5" maxlength="2000" data-bind="modalDraft">${escapeHtml(state.modalDraft || "")}</textarea>`;
  } else if (kind === "clue-share") {
    const myRoleId = state.home?.role?.id;
    const members = (state.home?.roomMembers || []).filter((m) => m.role_slot_id !== myRoleId);
    const selected = new Set(state.clueShareRoles || []);
    body = `
      <p class="modal-lede">选择可以查看这条线索的玩家角色。私享不会进入全房间讨论区。</p>
      <div class="member-picker">
        ${members.length
          ? members
              .map((member) => {
                const disabled = !member.online && !selected.has(member.role_slot_id);
                const checked = selected.has(member.role_slot_id);
                return `
            <label class="member-pick ${disabled && !checked ? "is-disabled" : ""}">
              <input type="checkbox" data-share-role value="${escapeHtml(member.role_slot_id)}" ${checked ? "checked" : ""} ${disabled && !checked ? "disabled" : ""} />
              <span>
                <strong>${escapeHtml(member.role_name || "未命名角色")}</strong>
                ${member.display_name ? ` · ${escapeHtml(member.display_name)}` : ""}
                ${member.online ? " · 已入房" : " · 尚未入房"}
              </span>
            </label>`;
              })
              .join("")
          : `<p class="hint muted">当前房间没有其他角色席位。</p>`}
      </div>`;
  } else if (kind === "investigate") {
    const inv = modal.investigation || {};
    body = `
      <p class="modal-lede">调查完成</p>
      <div class="investigate-result card-soft">
        <p>${escapeHtml(inv.resultText || "没有发现新的异常。")}</p>
        ${inv.clueName ? `<p class="hint accent-line">获得线索：<strong>${escapeHtml(inv.clueName)}</strong></p>` : ""}
      </div>`;
  } else if (kind === "voice-pick") {
    const rooms = state.home?.voiceRooms || [];
    body = `
      <p class="modal-lede">公共讨论与私密房相互隔离。房内文字消息也只对有权限的成员开放。</p>
      <div class="voice-modal-list">
        ${rooms.length
          ? rooms
              .map((room) => {
                const isPrivate = room.room_type !== "public";
                const active = state.voiceRoomId === room.id;
                return `
            <article class="voice-option ${isPrivate ? "is-private" : ""}">
              <span class="voice-option-icon">${isPrivate ? "♙" : "♬"}</span>
              <div>
                <strong>${escapeHtml(room.name)}</strong>
                <p>${isPrivate ? "仅受邀玩家可见" : "全体房间成员均可加入"}</p>
              </div>
              <div class="voice-option-actions">
                ${isPrivate
                  ? `<button class="btn quiet compact" type="button" data-action="voice-room-invite" data-voice-id="${escapeHtml(room.id)}" data-voice-name="${escapeHtml(room.name)}">邀请</button>`
                  : ""}
                <button class="btn ${active ? "quiet" : "primary"} compact" type="button" data-action="voice-join" data-voice-id="${escapeHtml(room.id)}" data-voice-name="${escapeHtml(room.name)}">${active ? "当前" : "加入"}</button>
              </div>
            </article>`;
              })
              .join("")
          : `<p class="hint muted">当前没有可加入的语音房。</p>`}
      </div>`;
  } else if (kind === "voice-create") {
    const seats = state.home?.roomMembers || [];
    const myUserId = state.user?.id;
    const selected = new Set(state.voiceInviteUserIds || []);
    body = `
      <p class="modal-lede">从已进入房间的角色中选择受邀者。你会自动加入密谈。</p>
      <label class="field-label">房间名称
        <input class="field" type="text" maxlength="40" value="${escapeHtml(state.modalDraft || "临时密谈")}" data-bind="modalDraft" />
      </label>
      <label class="field-label">邀请其他玩家</label>
      <div class="member-picker">
        ${seats.length
          ? seats
              .map((member) => {
                const self = member.user_id === myUserId;
                const disabled = self || !member.online;
                const checked = selected.has(member.user_id);
                return `
            <label class="member-pick ${disabled && !self ? "is-disabled" : ""}">
              <input type="checkbox" data-voice-invite value="${escapeHtml(member.user_id || "")}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
              <span>
                <strong>${escapeHtml(member.role_name || "未命名角色")}</strong>
                ${member.display_name ? ` · ${escapeHtml(member.display_name)}` : ""}
                ${self ? " · 当前角色" : member.online ? " · 可邀请" : " · 尚未入房"}
              </span>
            </label>`;
              })
              .join("")
          : `<p class="hint muted">当前房间尚未有角色成员。</p>`}
      </div>`;
  } else if (kind === "voice-invite") {
    const seats = state.home?.roomMembers || [];
    const myUserId = state.user?.id;
    const selected = new Set(state.voiceInviteUserIds || []);
    body = `
      <p class="modal-lede">从已进入房间的角色中追加邀请。</p>
      <div class="member-picker">
        ${seats
          .map((member) => {
            const self = member.user_id === myUserId;
            const disabled = self || !member.online;
            const checked = selected.has(member.user_id);
            return `
            <label class="member-pick ${disabled && !self ? "is-disabled" : ""}">
              <input type="checkbox" data-voice-invite value="${escapeHtml(member.user_id || "")}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
              <span>
                <strong>${escapeHtml(member.role_name || "未命名角色")}</strong>
                ${member.display_name ? ` · ${escapeHtml(member.display_name)}` : ""}
                ${self ? " · 当前角色" : member.online ? " · 可邀请" : " · 尚未入房"}
              </span>
            </label>`;
          })
          .join("")}
      </div>`;
  } else {
    body = `<p class="modal-lede">${escapeHtml(message)}</p>`;
  }

  const primaryAction =
    kind === "report"
      ? `<button class="btn primary" type="button" data-action="modal-submit-report" ${state.busy ? "disabled" : ""}>提交举报</button>`
      : kind === "clue-note"
        ? `<button class="btn primary" type="button" data-action="modal-save-clue-note" data-clue-id="${escapeHtml(modal.clueId || "")}" ${state.busy ? "disabled" : ""}>保存解读</button>`
        : kind === "clue-share"
          ? `<button class="btn primary" type="button" data-action="modal-save-clue-share" data-clue-id="${escapeHtml(modal.clueId || "")}" ${state.busy ? "disabled" : ""}>保存私享</button>`
          : kind === "investigate"
            ? `<button class="btn primary" type="button" data-action="modal-close">知道了</button>`
            : kind === "voice-create"
              ? `<button class="btn primary" type="button" data-action="modal-create-voice" ${state.busy ? "disabled" : ""}>创建并进入</button>`
              : kind === "voice-invite"
                ? `<button class="btn primary" type="button" data-action="modal-voice-invite" ${state.busy ? "disabled" : ""}>发送邀请</button>`
                : kind === "voice-pick"
                  ? `<button class="btn quiet" type="button" data-action="voice-room-create">＋ 创建密谈</button>`
                  : `<button class="btn primary" type="button" data-action="modal-confirm" ${state.busy ? "disabled" : ""}>确认</button>`;

  return `
    <div class="modal-backdrop is-open" data-action="modal-backdrop-close">
      <div class="modal card" role="dialog" aria-modal="true" aria-labelledby="play-modal-title">
        <h2 id="play-modal-title">${escapeHtml(title)}</h2>
        ${body}
        <div class="modal-actions">
          ${kind !== "investigate" && kind !== "voice-pick" ? `<button class="btn quiet" type="button" data-action="modal-close">取消</button>` : kind === "voice-pick" ? `<button class="btn quiet" type="button" data-action="modal-close">关闭</button>` : ""}
          ${primaryAction}
        </div>
      </div>
    </div>`;
}

export function closeModalState() {
  state.modal = null;
  state.modalDraft = "";
  state.clueShareRoles = [];
  state.voiceInviteUserIds = [];
}

export function openModalState(modal) {
  state.modal = modal;
  if (modal.kind === "clue-note") {
    state.modalDraft = modal.initialNote || "";
  } else if (modal.kind === "clue-share") {
    state.clueShareRoles = [...(modal.initialRoles || [])];
  } else {
    state.modalDraft = "";
  }
}
