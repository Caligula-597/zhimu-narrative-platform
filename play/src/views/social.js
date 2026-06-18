import { escapeHtml } from "../security.js";
import { state } from "../state.js";
import { formatRelativeTime } from "../utils/format.js";
import { isRegisteredUser } from "../utils/user.js";

export function renderFriends() {
  const data = state.friendsData || { friends: [], incoming: [], outgoing: [] };
  const searchResults = state.playerSearchResults?.items || [];
  const canWrite = isRegisteredUser(state.user);
  return `
    <section class="social-shell">
      <div class="plaza-head">
        <div>
          <p class="eyebrow">FRIENDS · 好友</p>
          <h1>添加好友，方便约局私聊</h1>
          <p class="lede">搜索玩家昵称发送好友请求；通过后可在「消息」里一对一私聊。</p>
        </div>
      </div>

      ${canWrite
        ? `
      <article class="card social-search">
        <h3>搜索玩家</h3>
        <form class="inline-form" data-form="player-search">
          <input class="field" name="q" type="search" minlength="2" maxlength="40" placeholder="输入昵称关键词" value="${escapeHtml(state.playerSearchQuery || "")}" data-bind="playerSearch" />
          <button class="btn outline" type="submit" ${state.busy ? "disabled" : ""}>搜索</button>
        </form>
        ${searchResults.length
          ? `
          <ul class="player-search-results">
            ${searchResults
              .map(
                (player) => `
              <li>
                <span>${escapeHtml(player.displayName)}</span>
                <button class="btn outline compact" type="button" data-action="friend-request" data-user-id="${escapeHtml(player.userId)}">加好友</button>
              </li>`
              )
              .join("")}
          </ul>`
          : state.playerSearchQuery
            ? `<p class="hint muted">未找到匹配的玩家。</p>`
            : ""}
      </article>`
        : `
      <article class="card auth-gate card-soft">
        <p>添加好友需要注册登录。</p>
        <button class="btn outline" type="button" data-action="show-auth">登录 / 注册</button>
      </article>`}

      ${data.incoming?.length
        ? `
        <article class="card">
          <h3>收到的好友请求</h3>
          <ul class="friend-list">
            ${data.incoming
              .map(
                (item) => `
              <li>
                <span>${escapeHtml(item.displayName)}</span>
                <div class="inline-actions">
                  <button class="btn primary compact" type="button" data-action="friend-accept" data-user-id="${escapeHtml(item.userId)}">接受</button>
                  <button class="btn quiet compact" type="button" data-action="friend-decline" data-user-id="${escapeHtml(item.userId)}">拒绝</button>
                </div>
              </li>`
              )
              .join("")}
          </ul>
        </article>`
        : ""}

      ${data.outgoing?.length
        ? `
        <article class="card">
          <h3>已发出的请求</h3>
          <ul class="friend-list muted">
            ${data.outgoing.map((item) => `<li><span>${escapeHtml(item.displayName)}</span><span class="hint">等待对方回应</span></li>`).join("")}
          </ul>
        </article>`
        : ""}

      <article class="card">
        <h3>我的好友 (${data.friends?.length || 0})</h3>
        ${data.friends?.length
          ? `
          <ul class="friend-list">
            ${data.friends
              .map(
                (item) => `
              <li>
                <span>${escapeHtml(item.displayName)}</span>
                <button class="btn outline compact" type="button" data-action="dm-open-peer" data-user-id="${escapeHtml(item.userId)}">发私信</button>
              </li>`
              )
              .join("")}
          </ul>`
          : `<p class="hint muted">还没有好友。在广场认识新玩家，或搜索昵称添加吧。</p>`}
      </article>

      <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
    </section>`;
}

export function renderMessages() {
  const items = state.dmConversations?.items || [];
  return `
    <section class="social-shell">
      <div class="plaza-head">
        <div>
          <p class="eyebrow">MESSAGES · 私信</p>
          <h1>与好友一对一私聊</h1>
          <p class="lede">仅已添加的好友可以互发私信。</p>
        </div>
      </div>

      <div class="dm-inbox">
        ${items.length
          ? items
              .map(
                (conv) => `
          <button class="dm-row card" type="button" data-action="dm-open" data-conversation-id="${escapeHtml(conv.id)}">
            <div class="dm-row-head">
              <strong>${escapeHtml(conv.peerDisplayName)}</strong>
              <time>${formatRelativeTime(conv.lastMessageAt)}</time>
            </div>
            <p class="dm-preview">${conv.lastMessageFromMe ? "我：" : ""}${escapeHtml(conv.lastMessage || "（暂无消息）")}</p>
            ${conv.unreadCount ? `<span class="dm-unread">${conv.unreadCount}</span>` : ""}
          </button>`
              )
              .join("")
          : `
          <article class="card plaza-empty enriched-empty">
            <span class="empty-icon" aria-hidden="true">◎</span>
            <p>还没有私信会话。添加好友后，在好友页点击「发私信」开始聊天。</p>
          </article>`}
      </div>

      <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
    </section>`;
}

export function renderDm() {
  const thread = state.dmThread;
  if (!thread) {
    return `
      <section class="social-shell">
        <p class="hint">加载会话中…</p>
        <button class="text-btn" type="button" data-action="go-messages">← 返回消息列表</button>
      </section>`;
  }
  const messages = thread.items || [];
  return `
    <section class="social-shell dm-chat">
      <button class="text-btn" type="button" data-action="go-messages">← 返回消息列表</button>
      <header class="dm-chat-head">
        <h2>${escapeHtml(thread.peerDisplayName || "玩家")}</h2>
      </header>
      <div class="dm-messages" data-dm-scroll>
        ${messages.length
          ? messages
              .map(
                (msg) => `
          <div class="dm-bubble ${msg.fromMe ? "is-mine" : "is-theirs"}">
            <p>${escapeHtml(msg.body).replace(/\n/g, "<br>")}</p>
            <time>${formatRelativeTime(msg.createdAt)}</time>
          </div>`
              )
              .join("")
          : `<p class="hint muted">还没有消息，打个招呼吧。</p>`}
      </div>
      <form class="dm-compose" data-form="dm-send">
        <textarea class="field" name="body" rows="2" maxlength="1000" placeholder="输入私信内容…" required data-bind="dmBody">${escapeHtml(state.dmDraftBody || "")}</textarea>
        <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>发送</button>
      </form>
    </section>`;
}
