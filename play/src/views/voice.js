import { escapeHtml } from "../security.js";
import { voiceHubParticipants, voiceLiveStatusLabel } from "../runtime/voice.js";
import { state } from "../state.js";
import { formatTime } from "../utils/format.js";

function currentVoiceRoom() {
  return (state.home?.voiceRooms || []).find((item) => item.id === state.voiceRoomId);
}

function renderVoiceHubActions(room, connected, connecting, failed) {
  const participants = voiceHubParticipants();
  return `
    <div class="voice-hub-actions">
      <div class="voice-hub-users">
        ${participants
          .slice(0, 8)
          .map(
            (participant) => `
          <div class="voice-avatar ${participant.micEnabled === false ? "is-muted" : ""}" title="${escapeHtml(participant.name)}">
            ${escapeHtml(String(participant.name)[0] || "?")}
          </div>`
          )
          .join("")}
      </div>
      <div class="voice-hub-btns">
        ${connected
          ? `
          <button class="btn outline compact" type="button" data-action="voice-mic-toggle">${state.voiceMicEnabled ? "🎙 麦克风开" : "🔇 麦克风关"}</button>
          <button class="btn quiet compact" type="button" data-action="voice-live-disconnect">退出音频</button>`
          : room && !connecting
            ? `<button class="btn primary compact" type="button" data-action="voice-live-connect">${failed ? "重试音频" : "连接音频"}</button>`
            : ""}
        <button class="btn outline compact" type="button" data-action="voice-room">切换语音房</button>
        ${room?.room_type === "invite_private"
          ? `<button class="btn quiet compact" type="button" data-action="voice-room-invite" data-voice-id="${escapeHtml(room.id)}" data-voice-name="${escapeHtml(room.name)}">邀请成员</button>`
          : ""}
        <button class="btn quiet compact" type="button" data-action="voice-room-create">＋ 密谈</button>
      </div>
    </div>`;
}

export function renderVoiceHub() {
  const room = currentVoiceRoom();
  const connected = state.voiceLiveStatus === "connected";
  const connecting = state.voiceLiveStatus === "connecting";
  const failed = state.voiceLiveStatus === "error";
  const participantCount = voiceHubParticipants().length;

  return `
    <section class="voice-hub card ${failed ? "voice-hub-error" : ""}">
      <div class="voice-hub-main">
        <div class="voice-hub-icon" aria-hidden="true">${connected ? "🎙" : connecting ? "…" : "♬"}</div>
        <div class="voice-hub-copy">
          <strong>语音空间 · ${escapeHtml(room?.name || state.voiceRoomName || "尚未选择")}</strong>
          <p>
            ${room?.room_type === "public" ? "所有房间成员可进入" : room ? "私密通话 · 仅受邀玩家可见" : "选择或创建语音空间"}
            · ${voiceLiveStatusLabel()}${connected && participantCount ? ` · ${participantCount} 人在线` : ""}
          </p>
        </div>
      </div>
      ${renderVoiceHubActions(room, connected, connecting, failed)}
    </section>`;
}

export function renderVoiceChat() {
  const messages = state.voiceMessages || [];
  return `
    <article class="voice-chat card">
      <div class="voice-chat-head">
        <div>
          <strong>房内文字频道</strong>
          <p class="hint">文字消息与 LiveKit 音频并行；无音频配置时仍可使用文字讨论。</p>
        </div>
        <button class="text-btn" type="button" data-action="voice-chat-refresh">刷新</button>
      </div>
      <div class="voice-chat-log" data-voice-scroll>
        ${messages.length
          ? messages
              .map(
                (message) => `
          <div class="voice-message">
            <div class="voice-message-meta">
              <b>${escapeHtml(message.sender_name || "玩家")}</b>
              <time>${formatTime(message.created_at)}</time>
            </div>
            <p>${escapeHtml(message.body)}</p>
          </div>`
              )
              .join("")
          : `<p class="hint muted voice-chat-empty">当前语音房还没有消息，发第一条吧。</p>`}
      </div>
      <form class="voice-chat-compose" data-form="voice-send">
        <input class="field" name="body" type="text" maxlength="1000" placeholder="发送给当前语音房成员…" value="${escapeHtml(state.voiceChatDraft || "")}" data-bind="voiceChat" autocomplete="off" />
        <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>发送</button>
      </form>
    </article>`;
}

/** Compact strip on overview tab */
export function renderVoiceCompact() {
  const room = currentVoiceRoom();
  if (!room && !(state.home?.voiceRooms || []).length) return "";
  const connected = state.voiceLiveStatus === "connected";
  return `
    <button class="voice-compact card-soft" type="button" data-action="switch-tab" data-tab="voice">
      <span class="voice-compact-icon">${connected ? "🎙" : "♬"}</span>
      <span class="voice-compact-copy">
        <strong>${escapeHtml(room?.name || "语音空间")}</strong>
        <small>${voiceLiveStatusLabel()}</small>
      </span>
      <span class="voice-compact-go">进入 →</span>
    </button>`;
}

export function renderVoiceTab() {
  const rooms = state.home?.voiceRooms || [];
  if (!rooms.length) {
    return `
      <div class="voice-tab-shell">
        <article class="card enriched-empty">
          <span class="empty-icon">♬</span>
          <h3>暂无语音空间</h3>
          <p class="muted">主持人创建平行房时通常会建立「公共讨论房」。你也可以自己创建临时密谈。</p>
          <button class="btn primary" type="button" data-action="voice-room-create">创建临时密谈</button>
        </article>
      </div>`;
  }
  return `
    <div class="voice-tab-shell">
      ${renderVoiceHub()}
      ${renderVoiceChat()}
    </div>`;
}
