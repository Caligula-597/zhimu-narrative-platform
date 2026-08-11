import { escapeHtml } from "../../../shared/security.js";
import {
  privateVoiceRoomsEnabled,
  privateVoiceRoomsUnavailableMessage,
  voiceHubParticipants,
  voiceLiveStatusLabel
} from "../runtime/voice.js";
import { state } from "../state.js";
import { formatTime } from "../utils/format.js";

function currentVoiceRoom() {
  return (state.home?.voiceRooms || []).find((item) => item.id === state.voiceRoomId);
}

function renderVoiceHubActions(room, connected, connecting, failed) {
  const participants = voiceHubParticipants();
  const privateEnabled = privateVoiceRoomsEnabled();
  return `
    <div class="voice-hub-actions">
      <div class="voice-hub-users">
        ${participants
          .slice(0, 8)
          .map(
            (participant) => `
          <div class="voice-avatar ${participant.connected === false ? "is-offline" : ""} ${participant.micEnabled === false ? "is-muted" : ""}" title="${escapeHtml(`${participant.roleName || "成员"} · ${participant.name}${participant.connected ? " · 已连接语音" : " · 已在房间"}`)}">
            ${escapeHtml(String(participant.name)[0] || "?")}
          </div>`
          )
          .join("")}
      </div>
      <div class="voice-hub-btns">
        ${connected
          ? `
          ${state.voicePlaybackBlocked ? `<button class="btn primary compact" type="button" data-action="voice-playback-unlock">开启扬声器</button>` : ""}
          <button class="btn outline compact" type="button" data-action="voice-mic-toggle">${state.voiceMicEnabled ? "🎙 麦克风开" : "🔇 麦克风关"}</button>
          <button class="btn quiet compact" type="button" data-action="voice-live-disconnect">退出音频</button>`
          : room && !connecting
            ? `<button class="btn primary compact" type="button" data-action="voice-live-connect">${failed ? "重试音频" : "连接音频"}</button>`
            : ""}
        <button class="btn outline compact" type="button" data-action="voice-room">切换语音房</button>
        ${room?.room_type === "invite_private"
          ? `<button class="btn quiet compact" type="button" data-action="voice-room-invite" data-voice-id="${escapeHtml(room.id)}" data-voice-name="${escapeHtml(room.name)}">邀请成员</button>`
          : ""}
        <button class="btn quiet compact" type="button" data-action="voice-room-create" ${privateEnabled ? "" : "disabled"} title="${privateEnabled ? "创建仅受邀玩家可见的语音房" : privateVoiceRoomsUnavailableMessage()}">＋ ${privateEnabled ? "密谈" : ["completed", "archived"].includes(state.home?.voicePolicy?.roomStatus) ? "密谈已关闭" : "开场后开放"}</button>
      </div>
    </div>`;
}

export function renderVoiceHub() {
  const room = currentVoiceRoom();
  const connected = state.voiceLiveStatus === "connected";
  const connecting = state.voiceLiveStatus === "connecting";
  const failed = state.voiceLiveStatus === "error";
  const participants = voiceHubParticipants();
  const participantCount = participants.length;
  const connectedCount = participants.filter((participant) => participant.connected).length;
  const privateEnabled = privateVoiceRoomsEnabled();

  return `
    <section class="voice-hub card ${failed ? "voice-hub-error" : ""}">
      <div class="voice-hub-main">
        <div class="voice-hub-icon" aria-hidden="true">${connected ? "🎙" : connecting ? "…" : "♬"}</div>
        <div class="voice-hub-copy">
          <strong>语音空间 · ${escapeHtml(room?.name || state.voiceRoomName || "尚未选择")}</strong>
          <p>
            ${room?.room_type === "public" ? "全员主语音房 · 主持人与全部玩家均在名单中" : room ? "私密通话 · 仅受邀玩家可见" : "选择语音空间"}
            · ${voiceLiveStatusLabel()}${room?.room_type === "public" ? ` · ${connectedCount}/${participantCount} 已连接语音` : connected && participantCount ? ` · ${participantCount} 人在线` : ""}
          </p>
          ${room?.room_type === "public" && participantCount ? `<div class="voice-roster-list" aria-label="主语音房成员">
            ${participants.map((participant) => `<span class="voice-roster-person ${participant.connected ? "is-connected" : ""}"><b>${escapeHtml(participant.roleName || "玩家")}</b>${escapeHtml(participant.name)}<i>${participant.connected ? "语音在线" : "已入房"}</i></span>`).join("")}
          </div>` : ""}
          ${room?.room_type === "public" ? `<p class="voice-room-policy ${privateEnabled ? "is-open" : ""}">${privateEnabled ? "场次已正式开始，玩家可邀请其他同伴创建临时密谈。" : ["completed", "archived"].includes(state.home?.voicePolicy?.roomStatus) ? "场次已结束，私密语音房已经关闭；全员主房仍可用于复盘。" : "候场阶段仅开放全员主语音房；主持人正式开场后才会开放密谈。"}</p>` : ""}
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
          <p class="muted">主语音房尚未建立，请联系主持人刷新房间配置。密谈不会替代全员主房。</p>
        </article>
      </div>`;
  }
  return `
    <div class="voice-tab-shell">
      ${renderVoiceHub()}
      ${renderVoiceChat()}
    </div>`;
}
