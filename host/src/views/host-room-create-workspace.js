import { getWorldId } from "../session.js";
import { state } from "../state.js";
import {
  HOST_ROOM_NAME_MAX,
  hostRoomCreateContextIsCurrent,
  hostRoomCreateIsLocked,
  hostRoomCreateIsPending
} from "../runtime/host-room-create-model.js";
import { escapeHtml } from "../../../shared/security.js";

function statusHtml(workspace) {
  if (!workspace.message && !workspace.errors.length) return "";
  const tone = workspace.status === "error"
    ? "error"
    : workspace.status === "uncertain" || workspace.status === "confirm-discard"
      ? "warning"
      : workspace.status === "success"
        ? "success"
        : "pending";
  return `<section class="host-room-create-status ${tone}" role="${tone === "error" ? "alert" : "status"}">
    ${workspace.message ? `<p>${escapeHtml(workspace.message)}</p>` : ""}
    ${workspace.errors.length ? `<ul>${workspace.errors.map((error) => `<li>${escapeHtml(error.message || String(error))}</li>`).join("")}</ul>` : ""}
  </section>`;
}

export function renderHostRoomCreateWorkspace() {
  const workspace = state.hostRoomCreateWorkspace;
  if (!workspace || !hostRoomCreateContextIsCurrent(workspace, getWorldId())) return "";
  const locked = hostRoomCreateIsLocked(workspace);
  const created = workspace.createdRoom;
  return `<section class="host-room-create-workspace" data-host-room-create-workspace aria-labelledby="host-room-create-title">
    <header class="host-room-create-head">
      <div><p class="eyebrow">NEW RUNTIME ROOM</p><h2 id="host-room-create-title">创建运行房</h2><p>先确认房间用途与公开范围。创建成功后再进入监控台，避免网络抖动造成重复房间。</p></div>
      <button type="button" class="secondary-btn" data-action="host-room-create-close" ${hostRoomCreateIsPending(workspace) ? "disabled" : ""}>${workspace.status === "confirm-discard" ? "放弃草稿" : "返回房间列表"}</button>
    </header>
    ${statusHtml(workspace)}
    <div class="host-room-create-grid">
      <div class="host-room-create-form">
        <label>运行房名称 <span>${workspace.name.length}/${HOST_ROOM_NAME_MAX}</span>
          <input class="field" type="text" maxlength="${HOST_ROOM_NAME_MAX}" data-host-room-create-field="name" value="${escapeHtml(workspace.name)}" ${locked || created ? "disabled" : ""}>
        </label>
        <label class="host-room-public-field">
          <input type="checkbox" data-host-room-create-field="publicListing" ${workspace.publicListing ? "checked" : ""} ${locked || created ? "disabled" : ""}>
          <span><strong>允许公开发现</strong><small>关闭时仅持邀请码的玩家可加入；商业测试建议保持关闭。</small></span>
        </label>
      </div>
      <aside class="host-room-create-summary">
        <span>所属剧本</span><strong>${escapeHtml(state.studio?.world?.name || "当前剧本")}</strong>
        <span>内容版本</span><strong>实时草稿（作者修改会同步）</strong>
        <span>加入方式</span><strong>${workspace.publicListing ? "公开发现 + 邀请码" : "仅邀请码"}</strong>
        ${created ? `<div class="host-room-created-code"><span>玩家邀请码</span><strong>${escapeHtml(created.invite_code || "—")}</strong></div>` : ""}
        <div class="host-room-create-actions">
          ${workspace.status === "uncertain" ? `<button type="button" class="secondary-btn" data-action="host-room-create-reconcile">核对创建结果</button>` : ""}
          ${created
            ? `<button type="button" class="primary-btn" data-action="host-room-create-enter">进入监控台</button>`
            : `<button type="button" class="primary-btn" data-action="host-room-create-submit" ${locked ? "disabled" : ""}>${hostRoomCreateIsPending(workspace) ? "正在创建…" : "确认创建运行房"}</button>`}
        </div>
      </aside>
    </div>
  </section>`;
}
