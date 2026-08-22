import { asArray, escapeHtml } from "../../../shared/security.js";
import { api } from "../api.js";
import { state } from "../state.js";
import { clueIsRead, clueOwnerLabel, clueShareRoleCount } from "../utils/clues.js";

function clueImageSlot(clue) {
  const assetId = clue?.image_asset_id;
  if (!assetId) return "";
  return `<div class="clue-card-image" data-clue-card-image="${escapeHtml(assetId)}"><span>线索卡加载中…</span></div>`;
}

export function hydrateClueCardImages(root = document) {
  const slots = [...(root.querySelectorAll?.("[data-clue-card-image]") || [])];
  slots.forEach((slot) => {
    if (slot.dataset.hydrated) return;
    slot.dataset.hydrated = "1";
    const assetId = slot.dataset.clueCardImage;
    if (!assetId) return;
    api.getAssetDownloadUrl(assetId).then((ticket) => {
      const url = ticket?.downloadUrl;
      if (!url) {
        slot.innerHTML = "<span>线索卡暂不可用</span>";
        return;
      }
      slot.innerHTML = `<img src="${escapeHtml(url)}" alt="线索卡" loading="lazy">`;
    }).catch(() => {
      slot.innerHTML = "<span>线索卡加载失败</span>";
    });
  });
}

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
      ${clueImageSlot(clue)}
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
      ${clueImageSlot(clue)}
      <p class="story-body">${escapeHtml(clue.public_text || "暂无内容")}</p>
      ${clue.player_note ? `<div class="clue-note-box"><strong>分享者解读</strong><p>${escapeHtml(clue.player_note)}</p></div>` : ""}
      ${!read ? `<button class="btn outline" type="button" data-action="read-clue" data-clue-id="${clue.id}" data-shared="1" ${state.busy ? "disabled" : ""}>标记已读</button>` : `<p class="done-note">✓ 已读</p>`}
    </article>`;
}

export function renderClues() {
  const owned = state.home?.clues || [];
  const shared = state.home?.sharedClues || [];
  const booklets = state.home?.materialBooklets || [];
  const roomShared = shared.filter((c) => c.shared_scope !== "roles");
  const roleShared = shared.filter((c) => c.shared_scope === "roles");

  if (!owned.length && !shared.length && !booklets.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">🔍</span>还没有获得线索。完成分幕阅读或探索场景中的调查点后，线索会出现在这里。</div>`;
  }

  const activeId = state.clueId || (!state.bookletId ? (owned[0]?.id || shared[0]?.id) : "");
  const activeOwned = owned.find((c) => c.id === activeId);
  const activeShared = shared.find((c) => c.id === activeId);
  const showingOwned = Boolean(activeOwned);
  const activeBookletId = state.bookletId
    || (!activeId && booklets[0] ? booklets[0].id : "");
  const activeBooklet = booklets.find((item) => String(item.id) === String(activeBookletId));
  const showingBooklet = Boolean(activeBooklet) && Boolean(state.bookletId || !activeId);

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

  const bookletList = booklets
    .map(
      (booklet) => `
    <button type="button" class="list-item ${String(booklet.id) === String(activeBookletId) && showingBooklet ? "is-active" : ""}" data-action="pick-booklet" data-booklet-id="${escapeHtml(String(booklet.id))}">
      <strong>${escapeHtml(booklet.title || "未命名物料册")}</strong>
      <span class="tag subtle">${escapeHtml(booklet.kind || "diary")}</span>
    </button>`
    )
    .join("");

  const bookletDetail = activeBooklet
    ? `<article class="card detail clue-detail">
      <div class="clue-detail-head">
        <h3>${escapeHtml(activeBooklet.title || "未命名物料册")}</h3>
        <div class="status-chips">
          <span class="status-chip published">物料册</span>
          ${activeBooklet.phaseLabel ? `<span class="status-chip testing">${escapeHtml(activeBooklet.phaseLabel)}</span>` : ""}
        </div>
      </div>
      ${activeBooklet.summary ? `<p class="story-body">${escapeHtml(activeBooklet.summary)}</p>` : ""}
      <div class="booklet-pages">
        ${(Array.isArray(activeBooklet.pages) ? activeBooklet.pages : []).map((page, index) => `
          <section class="clue-note-box">
            <strong>${escapeHtml(page?.title || `第 ${index + 1} 页`)}</strong>
            <p>${escapeHtml(page?.body || page?.text || "")}</p>
          </section>
        `).join("") || `<p class="done-note">此物料册暂无正文页。</p>`}
      </div>
    </article>`
    : "";

  return `
    <div class="clues-layout">
      <aside class="clues-sidebar">
        ${booklets.length ? `<section class="clues-group"><h4>物料册</h4><div class="list">${bookletList}</div></section>` : ""}
        ${owned.length ? `<section class="clues-group"><h4>我的线索</h4><div class="list">${ownedList}</div></section>` : ""}
        ${roomShared.length ? `<section class="clues-group"><h4>公共讨论区</h4><div class="list">${sharedList("公开", roomShared)}</div></section>` : ""}
        ${roleShared.length ? `<section class="clues-group"><h4>私享线索</h4><div class="list">${sharedList("私享", roleShared)}</div></section>` : ""}
      </aside>
      ${showingBooklet ? bookletDetail : showingOwned ? renderOwnedClueDetail(activeOwned) : renderSharedClueDetail(activeShared)}
    </div>`;
}

function renderCurrentLocationContext() {
  const map = state.home?.currentState?.presentation?.map;
  if (!map?.visible || !Array.isArray(map.locations) || !map.locations.length) return "";
  const active = map.locations.find((location) => String(location.id) === String(map.activeLocationId))
    || map.activeLocation
    || map.locations[0];
  const discovery = (state.discoverySessions || []).find(
    (session) => String(session.locationId) === String(active?.id)
  );
  const phaseLabel = {
    scanning: "正在侦测",
    ready: "等待抽取",
    drawing: "探索进行中",
    complete: "本地已完成",
  }[discovery?.phase] || "等待探索";
  return `<article class="exploration-location-context card" aria-label="当前地图位置">
    <div>
      <p class="eyebrow">${escapeHtml(map.title || "当前地图")} · ${escapeHtml(phaseLabel)}</p>
      <h2>${escapeHtml(active?.name || "等待主持人指定地点")}</h2>
      <p>${escapeHtml(active?.description || "主持人推进后，这里会同步当前地点说明。")}</p>
    </div>
    <div class="exploration-location-meta">
      <span>已揭示 ${map.locations.length} 个地点</span>
      ${discovery ? `<span>已抽 ${discovery.drawnClueIds?.length || 0} · 剩余 ${Number(discovery.remainingCount) || 0}</span>` : ""}
      <button class="btn outline compact" type="button" data-action="switch-tab" data-tab="home">查看地图与场景状态</button>
    </div>
  </article>`;
}

export function renderExploration() {
  const locationContext = renderCurrentLocationContext();
  if (state.explorationError) {
    return `${locationContext}
      <div class="banner error inline-retry">
        ${escapeHtml(state.explorationError)}
        <button class="btn outline compact" type="button" data-action="retry-exploration">重试</button>
      </div>`;
  }
  const scenes = state.exploration?.scenes || [];
  if (!scenes.length) {
    return `${locationContext}<div class="empty enriched-empty"><span class="empty-icon">🗺</span>当前还没有开放探索场景。读完分幕并等待主持人解锁后，新地点会出现在这里。</div>`;
  }
  return locationContext + scenes
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
        .map((item) => {
          const action = item.metadata?.itemActions?.[0];
          const latest = (state.itemActions || []).find((entry) => entry.itemId === item.item_id);
          const pending = latest?.status === "pending";
          const roleOptions = (state.home?.voiceRoster || [])
            .filter((member) => member.role_slot_id)
            .map((member) => `<option value="${escapeHtml(member.role_slot_id)}">${escapeHtml(member.role_name || member.display_name || "角色")}</option>`)
            .join("");
          const combineOptions = items
            .filter((candidate) => candidate.item_id !== item.item_id && action?.combineWithItemIds?.includes(candidate.item_id))
            .map((candidate) => `<option value="${escapeHtml(candidate.item_id)}">${escapeHtml(candidate.name)}</option>`)
            .join("");
          const targetControl = action?.targetType === "role"
            ? `<label>作用角色<select class="field" data-item-action-target>${roleOptions}</select></label>`
            : "";
          const combineControl = action?.kind === "combine"
            ? `<label>组合物<select class="field" data-item-action-combine>${combineOptions}</select></label>`
              : "";
          const unavailable = (action?.targetType === "role" && !roleOptions)
            || (action?.kind === "combine" && !combineOptions);
          const statusLabel = latest?.status === "pending"
            ? "等待主持确认"
            : latest?.status === "approved"
              ? (latest.resultText || "动作已完成")
              : latest?.status === "rejected"
                ? "主持人未批准"
                : latest?.status === "failed" ? "库存变化后无法完成" : "";
          return `
        <article class="card inventory-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="qty">× ${item.quantity}</span>
          ${item.description || item.public_text ? `<p>${escapeHtml(item.description || item.public_text)}</p>` : ""}
          ${latest ? `<small class="inventory-action-status is-${escapeHtml(latest.status)}">${escapeHtml(statusLabel)}</small>` : ""}
          ${action ? `<div class="inventory-action" data-item-action-card>${targetControl}${combineControl}<button class="btn outline" type="button" data-action="submit-item-action" data-item-id="${escapeHtml(item.item_id)}" data-action-key="${escapeHtml(action.key)}" data-target-type="${escapeHtml(action.targetType || "none")}" ${pending || unavailable || state.busy ? "disabled" : ""}>${escapeHtml(pending ? "等待确认" : action.label)}</button><small>${unavailable ? "当前没有符合契约的可选目标" : action.requiresHostConfirmation ? "提交后由主持人确认，确认前不会扣减库存" : "动作会立即结算并同步到房间状态"}</small></div>` : ""}
        </article>`;
        })
        .join("")}
    </div>`;
}
