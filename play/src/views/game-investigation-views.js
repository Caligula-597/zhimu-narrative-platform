import { asArray, escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";
import { clueIsRead, clueOwnerLabel, clueShareRoleCount } from "../utils/clues.js";

function renderOwnedClueDetail(clue) {
  if (!clue) return "";
  const read = clueIsRead(clue, { owned: true });
  const roleShareCount = clueShareRoleCount(clue);
  return `
    <article class="card detail clue-detail">
      <div class="clue-detail-head">
        <h3>${escapeHtml(clue.name)}</h3>
        <div class="status-chips">
          ${clue.shared_with_room ? `<span class="status-chip published">已公开</span>` : ""}
          ${roleShareCount ? `<span class="status-chip testing">已私享 ${roleShareCount} 人</span>` : ""}
          ${read ? `<span class="status-chip ok">已读</span>` : `<span class="status-chip draft">未读</span>`}
        </div>
      </div>
      <p class="story-body">${escapeHtml(clue.public_text || "暂无内容")}</p>
      ${clue.player_note ? `<div class="clue-note-box"><strong>我的解读</strong><p>${escapeHtml(clue.player_note)}</p></div>` : ""}
      <div class="row-actions clue-actions">
        ${!read ? `<button class="btn outline" type="button" data-action="read-clue" data-clue-id="${clue.id}" ${state.busy ? "disabled" : ""}>标记已读</button>` : ""}
        <button class="btn quiet" type="button" data-action="edit-clue-note" data-clue-id="${clue.id}">${clue.player_note ? "修改解读" : "添加解读"}</button>
        <button class="btn quiet" type="button" data-action="share-clue-room" data-clue-id="${clue.id}">${clue.shared_with_room ? "取消公开" : "公开到全房间"}</button>
        <button class="btn quiet" type="button" data-action="share-clue-roles" data-clue-id="${clue.id}">私享给玩家</button>
      </div>
    </article>`;
}

function renderSharedClueDetail(clue) {
  if (!clue) return "";
  const read = clueIsRead(clue, { owned: false });
  const scopeLabel =
    clue.shared_scope === "roles"
      ? `私享 · ${escapeHtml(clueOwnerLabel(clue))}`
      : `来自 ${escapeHtml(clueOwnerLabel(clue))}`;
  return `
    <article class="card detail clue-detail">
      <div class="clue-detail-head">
        <h3>${escapeHtml(clue.name)}</h3>
        <span class="status-chip ${clue.shared_scope === "roles" ? "testing" : "published"}">${scopeLabel}</span>
      </div>
      <p class="story-body">${escapeHtml(clue.public_text || "暂无内容")}</p>
      ${clue.player_note ? `<div class="clue-note-box"><strong>分享者解读</strong><p>${escapeHtml(clue.player_note)}</p></div>` : ""}
      ${!read ? `<button class="btn outline" type="button" data-action="read-clue" data-clue-id="${clue.id}" data-shared="1" ${state.busy ? "disabled" : ""}>标记已读</button>` : `<p class="done-note">✓ 已读</p>`}
    </article>`;
}

export function renderClues() {
  const owned = state.home?.clues || [];
  const shared = state.home?.sharedClues || [];
  const roomShared = shared.filter((c) => c.shared_scope !== "roles");
  const roleShared = shared.filter((c) => c.shared_scope === "roles");

  if (!owned.length && !shared.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">🔍</span>还没有获得线索。完成分幕阅读或探索场景中的调查点后，线索会出现在这里。</div>`;
  }

  const activeId = state.clueId || owned[0]?.id || shared[0]?.id;
  const activeOwned = owned.find((c) => c.id === activeId);
  const activeShared = shared.find((c) => c.id === activeId);
  const showingOwned = Boolean(activeOwned);

  const ownedList = owned
    .map(
      (clue) => `
    <button type="button" class="list-item ${clue.id === activeId && showingOwned ? "is-active" : ""}" data-action="pick-clue" data-clue-id="${clue.id}" data-owned="1">
      <strong>${escapeHtml(clue.name)}</strong>
      ${clueIsRead(clue, { owned: true }) ? "<span>已读</span>" : '<span class="tag">未读</span>'}
    </button>`
    )
    .join("");

  const sharedList = (section, items) =>
    items
      .map(
        (clue) => `
    <button type="button" class="list-item ${clue.id === activeId && !showingOwned ? "is-active" : ""}" data-action="pick-clue" data-clue-id="${clue.id}" data-owned="0">
      <strong>${escapeHtml(clue.name)}</strong>
      <span class="tag subtle">${section}</span>
    </button>`
      )
      .join("");

  return `
    <div class="clues-layout">
      <aside class="clues-sidebar">
        ${owned.length ? `<section class="clues-group"><h4>我的线索</h4><div class="list">${ownedList}</div></section>` : ""}
        ${roomShared.length ? `<section class="clues-group"><h4>公共讨论区</h4><div class="list">${sharedList("公开", roomShared)}</div></section>` : ""}
        ${roleShared.length ? `<section class="clues-group"><h4>私享线索</h4><div class="list">${sharedList("私享", roleShared)}</div></section>` : ""}
      </aside>
      ${showingOwned ? renderOwnedClueDetail(activeOwned) : renderSharedClueDetail(activeShared)}
    </div>`;
}

export function renderExploration() {
  if (state.explorationError) {
    return `
      <div class="banner error inline-retry">
        ${escapeHtml(state.explorationError)}
        <button class="btn outline compact" type="button" data-action="retry-exploration">重试</button>
      </div>`;
  }
  const scenes = state.exploration?.scenes || [];
  if (!scenes.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">🗺</span>当前还没有开放探索场景。读完分幕并等待主持人解锁后，新地点会出现在这里。</div>`;
  }
  return scenes
    .map(
      (scene) => `
    <article class="card scene-card">
      <header>
        <p class="eyebrow">场景</p>
        <h3>${escapeHtml(scene.name)}</h3>
      </header>
      <p>${escapeHtml(scene.public_text || "")}</p>
      <div class="point-list">
        ${asArray(scene.investigation_points)
          .map(
            (point) => `
          <div class="point-row">
            <div>
              <strong>${escapeHtml(point.name)}</strong>
              <p>${escapeHtml(point.description || "")}</p>
              ${point.requiredItemName ? `<span class="tag">需要：${escapeHtml(point.requiredItemName)}</span>` : ""}
              ${point.investigated && point.resultText ? `<p class="result-text">${escapeHtml(point.resultText)}</p>` : ""}
            </div>
            <button class="btn ${point.investigated ? "quiet" : "outline"}" type="button"
              data-action="investigate" data-point-id="${point.id}"
              ${point.investigated || !point.hasRequiredItem || state.busy ? "disabled" : ""}>
              ${point.investigated ? "已调查" : "调查"}
            </button>
          </div>`
          )
          .join("")}
      </div>
    </article>`
    )
    .join("");
}

export function renderInventory() {
  const items = state.home?.inventory || [];
  if (!items.length) return `<div class="empty enriched-empty"><span class="empty-icon">🎒</span>背包是空的。探索场景或完成剧情后，物品会出现在这里。</div>`;
  return `
    <div class="inventory-grid">
      ${items
        .map(
          (item) => `
        <article class="card inventory-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="qty">× ${item.quantity}</span>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        </article>`
        )
        .join("")}
    </div>`;
}
