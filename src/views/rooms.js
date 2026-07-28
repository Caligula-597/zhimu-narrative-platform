import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { roomContentBindingPresentation } from "../../shared/room-content-binding.js";
import {
  availableRoomReleaseTargets,
  bindRoomReleaseTargetFields,
  createRoomReleaseChangeController,
  emptyRoomReleaseChange,
  reconcileRoomReleaseChange,
  renderRoomReleaseChangePanel,
  roomReleaseId
} from "./room-release-workspace.js";

const DEFAULT_ROOM_CONTENT_POLICY = Object.freeze({
  defaultMode: "live_draft",
  defaultReleaseEnabled: false,
  publicListingRequiresRelease: true,
  allowExplicitLiveDraft: true
});

let loadSequence = 0;
let roomWorkspaceState = createRoomWorkspaceState();

function createRoomWorkspaceState(worldId = zhimuApi.context.worldId || "") {
  return {
    worldId,
    status: "idle",
    rooms: [],
    releases: [],
    releasesUnavailable: false,
    contentPolicy: { ...DEFAULT_ROOM_CONTENT_POLICY },
    releaseSelectionTouched: false,
    runtimeStates: {},
    error: "",
    createSaving: false,
    rowActionId: "",
    releaseChange: emptyRoomReleaseChange(),
    draft: { name: "", releaseId: "", publicListing: false }
  };
}

function ensureCurrentWorldState() {
  const worldId = zhimuApi.context.worldId || "";
  if (roomWorkspaceState.worldId !== worldId) {
    loadSequence += 1;
    roomWorkspaceState = createRoomWorkspaceState(worldId);
  }
  return roomWorkspaceState;
}

function isCurrentRoomWorkspace(state) {
  return roomWorkspaceState === state && zhimuApi.context.worldId === state.worldId;
}

const roomReleaseController = createRoomReleaseChangeController({
  getState: ensureCurrentWorldState,
  isCurrent: isCurrentRoomWorkspace,
  render
});

function currentWorld() {
  return studioStore.get().cloudStudio?.world || worldStore.get().cloudWorkspacePreview?.world || null;
}

function releaseOptions(state) {
  return state.releases.map((release) =>
    `<option value="${escapeHtml(release.id)}" ${state.draft.releaseId === release.id ? "selected" : ""}>R${Number(release.releaseNumber) || "?"} · ${escapeHtml(release.label)} · revision ${Number(release.sourceRevision) || 0}${state.releases[0]?.id === release.id ? " · 最新" : ""}</option>`
  ).join("");
}

function roomRow(room, state) {
  const active = room.id === zhimuApi.context.roomId;
  const busy = state.rowActionId === room.id;
  const listingLabel = room.public_listing
    ? `<span class="status-chip published">公开大厅</span>`
    : `<span class="status-chip draft">仅邀请码</span>`;
  const listingAction = room.public_listing
    ? `<button class="text-btn" data-action="room-listing-off" data-room-id="${escapeHtml(room.id)}" ${busy ? "disabled" : ""}>取消公开</button>`
    : `<button class="text-btn" data-action="room-listing-on" data-room-id="${escapeHtml(room.id)}" ${busy ? "disabled" : ""}>公开到大厅</button>`;
  const seatHint = room.role_slot_count != null ? ` · ${Number(room.role_slot_count)} 个席位` : "";
  const binding = roomContentBindingPresentation(room.contentBinding);
  const runtimeState = state.runtimeStates[room.id];
  const runtimeLine = runtimeState
    ? `<p class="muted-note"><strong>${escapeHtml(runtimeState.phase?.label || "状态待确认")}</strong> · ${escapeHtml(runtimeState.phase?.detail || "")} · 游标 ${Number(runtimeState.syncState?.serverCursor) || 0}</p>`
    : "";
  const releaseTargets = availableRoomReleaseTargets(room, state.releases);
  const releaseAction = releaseTargets.length
    ? `<button class="secondary-btn" data-action="room-release-open" data-room-id="${escapeHtml(room.id)}" ${busy ? "disabled" : ""}>评估切换版本</button>`
    : "";
  return `<article class="parallel-room-row room-workspace-row ${active ? "active" : ""}" ${busy ? 'aria-busy="true"' : ""}>
    <div>
      <div class="row room-workspace-row-head"><h3>${escapeHtml(room.name)}</h3>${listingLabel}<span class="status-chip ${escapeHtml(binding.tone)}">${escapeHtml(binding.label)}</span></div>
      <p>邀请码：<code>${escapeHtml(room.invite_code)}</code> · ${Number(room.member_count) || 0} 名玩家已选角${seatHint} · ${escapeHtml(room.status)}</p>
      <p class="muted-note room-content-binding-note">${escapeHtml(binding.detail)}</p>
      ${runtimeLine}
      <p class="muted-note">${room.public_listing ? "陌生人可在玩家端大厅发现并入房。" : "仅持有邀请码的玩家可加入，不会出现在公开大厅。"}</p>
    </div>
    <div class="row">
      <button class="secondary-btn" data-action="room-invite" data-room-id="${escapeHtml(room.id)}" data-room-name="${escapeHtml(room.name)}" data-invite-code="${escapeHtml(room.invite_code)}">邀请玩家</button>
      <button class="secondary-btn" data-action="open-player-portal" data-invite-code="${escapeHtml(room.invite_code)}">打开玩家端</button>
      <button class="secondary-btn" data-action="open-host-console" data-room-id="${escapeHtml(room.id)}">打开主持端</button>
      ${releaseAction}
      ${listingAction}
      <button class="${active ? "secondary-btn" : "primary-btn"}" data-action="room-select" data-room-id="${escapeHtml(room.id)}" ${active || busy ? "disabled" : ""}>${active ? "当前房间" : "进入房间"}</button>
    </div>
    ${renderRoomReleaseChangePanel(room, state)}
  </article>`;
}

function loadingPage(world) {
  return `<section class="room-workspace-page"><div class="room-workspace-head"><div><button class="workspace-back-btn" data-go="overview">← 返回项目总控</button><p class="section-kicker">RUNTIME ROOMS</p><h2>${escapeHtml(world?.name || "当前剧本")} · 运行房</h2><p>正在读取房间和内容版本…</p></div></div><div class="empty-state">正在加载运行房工作区…</div></section>`;
}

export function rooms() {
  const state = ensureCurrentWorldState();
  const world = currentWorld();
  if (!state.worldId) return `<section class="card"><h3>尚未选择剧本</h3><p>请先选择或创建剧本，再建立运行房。</p></section>`;
  if (state.status === "idle") {
    state.status = "loading";
    queueMicrotask(() => void refreshRoomWorkspace());
  }
  if (state.status === "loading" && !state.rooms.length) return loadingPage(world);
  const releaseHint = state.releasesUnavailable
    ? `<div class="workspace-inline-warning"><strong>版本列表暂时不可用</strong><p>本次仍可创建实时草稿测试房；不会错误绑定未知版本。</p></div>`
    : `<p class="muted-note room-content-binding-note">${state.contentPolicy.defaultReleaseEnabled ? "新房默认选择最新 Release。" : "当前灰度策略仍允许默认实时草稿。"}选择 Release 后，Host、Player、规则、调查和知识投影会统一读取不可变快照；公开房必须绑定 Release。</p>`;
  return `<section class="room-workspace-page">
    <header class="room-workspace-head">
      <div><button class="workspace-back-btn" data-go="overview">← 返回项目总控</button><p class="section-kicker">RUNTIME ROOMS</p><h2>${escapeHtml(world?.name || "当前剧本")} · 运行房工作区</h2><p>创建测试房、管理公开状态、切换当前运行上下文，并向玩家分享邀请码。</p></div>
      <div class="room-workspace-head-actions"><button class="secondary-btn" data-action="room-join">使用邀请码加入</button><button class="secondary-btn" data-action="room-workspace-refresh" ${state.status === "loading" ? "disabled" : ""}>刷新列表</button><button class="primary-btn" data-action="open-host-console" data-room-id="${escapeHtml(zhimuApi.context.roomId || "")}">打开${zhimuApi.context.roomId ? "当前房间" : ""}主持端</button></div>
    </header>
    ${state.error ? `<div class="workspace-inline-error" role="alert"><strong>操作未完成</strong><p>${escapeHtml(state.error)}</p></div>` : ""}
    <div class="room-workspace-grid">
      <aside class="room-create-panel" ${state.createSaving ? 'aria-busy="true"' : ""}>
        <div><p class="section-kicker">CREATE ROOM</p><h3>开放新运行房</h3><p>不同房间的玩家、进度、事件和复盘相互隔离。</p></div>
        <div class="form-group">
          <label for="room-workspace-name">房间名称</label><input id="room-workspace-name" class="field" data-room-draft="name" value="${escapeHtml(state.draft.name)}" placeholder="例如：周末测试组 A" ${state.createSaving ? "disabled" : ""}>
          <label for="room-workspace-release">内容版本</label><select id="room-workspace-release" class="field" data-room-draft="releaseId" ${state.releasesUnavailable || state.createSaving ? "disabled" : ""}><option value="">实时草稿（仅用于私有联调）</option>${releaseOptions(state)}</select>
          ${releaseHint}
          <label class="check-row"><input type="checkbox" data-room-draft="publicListing" ${state.draft.publicListing ? "checked" : ""} ${state.createSaving ? "disabled" : ""}> 创建后公开到玩家大厅</label>
        </div>
        <button class="primary-btn full-btn" data-action="room-create" ${state.createSaving ? "disabled" : ""}>${state.createSaving ? "正在创建…" : "＋ 开放新运行房"}</button>
      </aside>
      <main class="room-workspace-list-panel">
        <div class="section-head"><div><p class="section-kicker">ROOM INSTANCES</p><h3>已有运行房</h3><p>${state.rooms.length} 个可访问房间 · 当前房间会作为 Host、Player 和 SSE 的同步上下文</p></div></div>
        <div class="parallel-room-list room-workspace-list">${state.rooms.length ? state.rooms.map((room) => roomRow(room, state)).join("") : `<div class="empty-state enriched-empty"><p><strong>尚未建立运行房</strong></p><p>先创建一个仅邀请码测试房，完成主持端与玩家端的端到端验收后，再考虑公开到大厅。</p></div>`}</div>
      </main>
    </div>
  </section>`;
}

export async function refreshRoomWorkspace() {
  const state = ensureCurrentWorldState();
  const worldId = state.worldId;
  if (!worldId) return;
  const sequence = ++loadSequence;
  state.status = "loading";
  state.error = "";
  render();
  try {
    const activeRoomId = zhimuApi.context.roomId || "";
    const [roomsResult, releasesResult, policyResult, runtimeStateResult] = await Promise.allSettled([
      zhimuApi.getWorldRooms(),
      zhimuApi.getWorldReleases(worldId),
      zhimuApi.getRoomContentPolicy(worldId),
      activeRoomId
        ? zhimuApi.getCreatorRoomCurrentState(worldId, activeRoomId)
        : Promise.resolve(null)
    ]);
    if (sequence !== loadSequence || zhimuApi.context.worldId !== worldId) return;
    if (roomsResult.status !== "fulfilled") throw roomsResult.reason;
    state.rooms = roomsResult.value || [];
    state.releases = releasesResult.status === "fulfilled" ? releasesResult.value || [] : [];
    state.contentPolicy = policyResult.status === "fulfilled"
      ? { ...DEFAULT_ROOM_CONTENT_POLICY, ...policyResult.value }
      : { ...DEFAULT_ROOM_CONTENT_POLICY };
    if (runtimeStateResult.status === "fulfilled" && runtimeStateResult.value) {
      state.runtimeStates = {
        ...state.runtimeStates,
        [activeRoomId]: runtimeStateResult.value
      };
    }
    state.releasesUnavailable = releasesResult.status === "rejected";
    reconcileRoomReleaseChange(state);
    if (state.releasesUnavailable) {
      state.draft.releaseId = "";
    } else if (
      !state.releaseSelectionTouched
      && state.contentPolicy.defaultReleaseEnabled
      && state.releases[0]?.id
    ) {
      state.draft.releaseId = state.releases[0].id;
    } else if (
      state.draft.releaseId
      && !state.releases.some((release) => release.id === state.draft.releaseId)
    ) {
      state.draft.releaseId = "";
    }
    state.status = "ready";
  } catch (error) {
    if (sequence !== loadSequence || zhimuApi.context.worldId !== worldId) return;
    state.status = "error";
    state.error = normalizeError(error, "运行房列表加载失败");
  }
  render();
}

export function bindRoomWorkspace() {
  const state = ensureCurrentWorldState();
  const root = document.querySelector(".room-workspace-page");
  if (!root || root.dataset.bound) return;
  root.dataset.bound = "1";
  root.querySelectorAll("[data-room-draft]").forEach((field) => {
    const update = () => {
      const key = field.dataset.roomDraft;
      state.draft[key] = field.type === "checkbox" ? Boolean(field.checked) : field.value;
      if (key === "releaseId") state.releaseSelectionTouched = true;
      if (key === "publicListing" && state.draft.publicListing && !state.draft.releaseId) {
        const latestReleaseId = state.releases[0]?.id || "";
        if (latestReleaseId) {
          state.draft.releaseId = latestReleaseId;
          state.releaseSelectionTouched = true;
          root.querySelector("[data-room-draft=releaseId]")?.setAttribute("value", latestReleaseId);
          const releaseField = root.querySelector("[data-room-draft=releaseId]");
          if (releaseField) releaseField.value = latestReleaseId;
        } else {
          state.draft.publicListing = false;
          field.checked = false;
          state.error = "公开运行房必须先创建并绑定 Release";
          render();
          return;
        }
      }
      if (state.error) state.error = "";
    };
    field.addEventListener("input", update);
    field.addEventListener("change", update);
  });
  bindRoomReleaseTargetFields(root, state, render);
}

export async function createParallelRoom() {
  const state = ensureCurrentWorldState();
  if (state.createSaving) return;
  const name = String(state.draft.name || "").trim();
  if (!name) {
    state.error = "请填写运行房名称";
    render();
    document.querySelector("[data-room-draft=name]")?.focus();
    return;
  }
  if (state.draft.publicListing && !state.draft.releaseId) {
    state.error = "公开运行房必须绑定 Release；请先发布版本或取消公开";
    render();
    document.querySelector("[data-room-draft=releaseId]")?.focus();
    return;
  }
  state.createSaving = true;
  state.error = "";
  render();
  const wasPublic = Boolean(state.draft.publicListing);
  let room;
  try {
    room = await zhimuApi.createRoom(state.worldId, {
      name,
      publicListing: wasPublic,
      releaseId: state.draft.releaseId || null
    });
  } catch (error) {
    state.createSaving = false;
    if (!isCurrentRoomWorkspace(state)) return;
    state.error = normalizeError(error, "运行房创建失败");
    render();
    return;
  }
  if (!isCurrentRoomWorkspace(state)) {
    state.createSaving = false;
    showToast(`运行房「${name}」已在原剧本创建；当前剧本未被切换`);
    return;
  }
  state.rooms = [room, ...state.rooms.filter((item) => item.id !== room.id)];
  state.releaseSelectionTouched = false;
  state.draft = {
    name: "",
    releaseId: state.contentPolicy.defaultReleaseEnabled ? state.releases[0]?.id || "" : "",
    publicListing: false
  };
  window.zhimuContext?.prepareRoomSwitch?.(room.id);
  try {
    await loadCloudData(true, true);
  } catch (error) {
    if (!isCurrentRoomWorkspace(state)) return;
    state.createSaving = false;
    state.error = normalizeError(error, "运行房已创建，但当前数据刷新失败；请点击刷新列表恢复");
    render();
    showToast(`运行房已创建：${room.invite_code}`);
    return;
  }
  if (!isCurrentRoomWorkspace(state)) return;
  state.createSaving = false;
  render();
  showToast(wasPublic ? `运行房已开放并公开到大厅：${room.invite_code}` : `运行房已开放：${room.invite_code}`);
}

export function openRoomReleaseChange(roomId) {
  roomReleaseController.open(roomId);
}

export function closeRoomReleaseChange(roomId) {
  roomReleaseController.close(roomId);
}

export async function previewRoomReleaseChange(roomId) {
  return roomReleaseController.preview(roomId);
}

export async function confirmRoomReleaseChange(roomId) {
  return roomReleaseController.confirm(roomId);
}

export async function setRoomPublicListing(roomId, publicListing) {
  const state = ensureCurrentWorldState();
  if (!roomId || state.rowActionId) return;
  const room = state.rooms.find((item) => item.id === roomId);
  if (publicListing && !roomReleaseId(room)) {
    state.error = "公开运行房必须先绑定 Release；请先完成版本影响评估";
    openRoomReleaseChange(roomId);
    return;
  }
  state.rowActionId = roomId;
  state.error = "";
  render();
  try {
    const updated = await zhimuApi.updateRoomPublicListing(state.worldId, roomId, publicListing);
    if (!isCurrentRoomWorkspace(state)) return;
    state.rooms = state.rooms.map((room) => room.id === roomId
      ? { ...room, ...(updated || {}), public_listing: publicListing }
      : room);
    state.rowActionId = "";
    render();
    showToast(publicListing ? "已公开到玩家大厅" : "已改为仅邀请码入房");
  } catch (error) {
    if (!isCurrentRoomWorkspace(state)) return;
    state.rowActionId = "";
    state.error = normalizeError(error, "房间公开状态更新失败");
    render();
  }
}

export async function selectParallelRoom(roomId) {
  const state = ensureCurrentWorldState();
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room || room.id === zhimuApi.context.roomId || state.rowActionId) return;
  state.rowActionId = roomId;
  state.error = "";
  render();
  try {
    window.zhimuContext?.prepareRoomSwitch?.(roomId);
    await loadCloudData(true, true);
    const runtimeState = await zhimuApi.getCreatorRoomCurrentState(state.worldId, roomId)
      .catch(() => null);
    if (!isCurrentRoomWorkspace(state)) return;
    if (runtimeState) {
      state.runtimeStates = { ...state.runtimeStates, [roomId]: runtimeState };
    }
    state.rowActionId = "";
    render();
    showToast(`已切换到「${room.name}」`);
  } catch (error) {
    if (!isCurrentRoomWorkspace(state)) return;
    state.rowActionId = "";
    state.error = normalizeError(error, "切换运行房失败");
    render();
  }
}

export function leaveRoomWorkspace() {
  go("overview");
}

export const roomsViewApi = {
  rooms,
  refreshRoomWorkspace,
  bindRoomWorkspace,
  createParallelRoom,
  openRoomReleaseChange,
  closeRoomReleaseChange,
  previewRoomReleaseChange,
  confirmRoomReleaseChange,
  setRoomPublicListing,
  selectParallelRoom,
  leaveRoomWorkspace
};
registerView("rooms", roomsViewApi);
