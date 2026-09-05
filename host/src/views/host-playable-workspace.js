import { state } from "../state.js";
import { escapeHtml } from "../utils/format.js";

function playerOptions(assignedUserIds) {
  const players = (state.cloudHostPlayers || []).filter((p) => p.joined && p.user_id);
  if (!players.length) return `<option value="">暂无已加入玩家</option>`;
  return [
    `<option value="">选择玩家…</option>`,
    ...players.map((p) => {
      const taken = assignedUserIds.has(String(p.user_id));
      return `<option value="${escapeHtml(p.user_id)}" data-role-slot-id="${escapeHtml(p.role_slot_id || "")}" ${taken ? "disabled" : ""}>${escapeHtml(p.player_display_name || p.role_name || p.user_id)}${taken ? "（已分配）" : ""}</option>`;
    }),
  ].join("");
}

export function renderHostPlayableWorkspace() {
  const busy = state.hostPlayableBusy;
  const payload = state.cloudHostPlayableRuntime;
  const header = `<div class="section-head compact"><div><h3>剧本内容运行</h3><p>Playable Runtime · 内容分幕与玩法桥接</p></div>
    <button type="button" class="secondary-btn" data-action="host-playable-refresh" ${busy ? "disabled" : ""}>刷新</button></div>`;

  if (!payload) {
    return `<section class="card host-playable-workspace">${header}<div class="empty-state">正在加载剧本运行态…</div></section>`;
  }
  if (payload.missing || payload.error) {
    return `<section class="card host-playable-workspace">${header}
      <div class="host-mechanism-onboarding">
        <strong>尚未绑定 PlayableProject</strong>
        <p>${escapeHtml(payload.error || "点击绑定后，将冻结当前 READY 合同（或商会库房案 fixture）快照。")}</p>
        <button type="button" class="primary-btn" data-action="host-playable-initialize" ${busy ? "disabled" : ""}>${busy ? "处理中…" : "绑定剧本并开局准备"}</button>
      </div></section>`;
  }

  const view = payload.view || {};
  const assignedUsers = new Set(
    (view.playerRoles || []).filter((r) => r.assignedUserId).map((r) => String(r.assignedUserId)),
  );

  const roleRows = (view.playerRoles || [])
    .map((role) => {
      if (role.assigned) {
        const uid = String(role.assignedUserId || "");
        return `<div class="host-playable-role"><strong>${escapeHtml(role.name)}</strong><span>✓ ${escapeHtml(uid.slice(0, 8))}… · 已读 ${Number(role.read) || 0}/${Number(role.visible) || 0}</span></div>`;
      }
      return `<div class="host-playable-role"><strong>${escapeHtml(role.name)}</strong>
        <select data-playable-assign-for="${escapeHtml(role.roleId)}">${playerOptions(assignedUsers)}</select>
        <button type="button" class="secondary-btn" data-action="host-playable-assign" data-playable-role-id="${escapeHtml(role.roleId)}" ${busy ? "disabled" : ""}>分配</button>
      </div>`;
    })
    .join("");

  const clues = (view.releasableClues || [])
    .map(
      (c) =>
        `<label class="host-playable-clue"><span>□ ${escapeHtml(c.title || c.id)}</span>
        <button type="button" class="secondary-btn" data-action="host-playable-release-clue" data-clue-id="${escapeHtml(c.id)}" ${busy || view.status !== "RUNNING" ? "disabled" : ""}>发放</button></label>`,
    )
    .join("") || `<p class="muted-note">本幕无可发线索</p>`;

  const placements = (view.placements || [])
    .map((p) => {
      const placementId = p.placementId || p.id;
      let controls = "";
      if (p.canStart) {
        controls = `<button type="button" class="primary-btn" data-action="host-playable-start-mechanism" data-placement-id="${escapeHtml(placementId)}" ${busy ? "disabled" : ""}>${escapeHtml(p.startLabel || "开始竞价")}</button>`;
      } else if (p.canSettle) {
        controls = `<button type="button" class="primary-btn" data-action="host-playable-settle-mechanism" data-placement-id="${escapeHtml(placementId)}" ${busy ? "disabled" : ""}>${escapeHtml(p.settleLabel || "结算竞价")}</button>`;
      } else {
        const progress =
          p.submittedCount != null
            ? `已提交：${Number(p.submittedCount) || 0} / ${Number(p.participantCount) || 0}`
            : "";
        controls = `<span>${escapeHtml(p.outcomeSummary || progress || p.note || p.status || "")}</span>`;
      }
      return `<div class="host-playable-placement"><div><strong>${escapeHtml(p.title || placementId)}</strong><small>${escapeHtml(p.status || "")}</small></div>${controls}</div>`;
    })
    .join("") || `<p class="muted-note">本幕无玩法位置</p>`;

  const endingBlock = view.endingSummary
    ? `<div class="host-playable-ending"><h4>终局结算</h4><p>${escapeHtml(view.endingSummary.hostSummary || view.endingSummary.publicSummary || "")}</p>
       ${view.canConfirmEnding ? `<button type="button" class="primary-btn" data-action="host-playable-finish" ${busy ? "disabled" : ""}>确认终局 / 结束本局</button>` : ""}</div>`
    : "";

  const stageLabel =
    view.status === "NOT_STARTED"
      ? "未开局"
      : view.status === "FINISHED"
        ? "已结束"
        : `Stage ${view.stageIndex || "?"} / ${view.stageCount || "?"} · ${escapeHtml(view.currentStageTitle || "")}`;

  return `<section class="card host-playable-workspace">
    ${header}
    ${state.hostPlayableError ? `<div class="host-mechanism-warning"><b>操作未完成</b><span>${escapeHtml(state.hostPlayableError)}</span></div>` : ""}
    <p><strong>${stageLabel}</strong> · 修订 ${escapeHtml(String(view.playableFingerprint || "").slice(0, 12))} · R${Number(view.revision) || 0}</p>
    <h4>角色分配</h4>
    <div class="host-playable-roles">${roleRows}</div>
    ${
      view.status === "NOT_STARTED"
        ? `<button type="button" class="primary-btn" data-action="host-playable-start" ${busy ? "disabled" : ""}>开始剧本</button>`
        : ""
    }
    ${
      view.status === "RUNNING"
        ? `<h4>主持可发线索</h4><div class="host-playable-clues">${clues}</div>
           <h4>玩法位置</h4><div class="host-playable-placements">${placements}</div>
           ${endingBlock}
           <div class="row" style="margin-top:12px;gap:8px">
             ${
               view.stageIndex < view.stageCount
                 ? `<button type="button" class="primary-btn" data-action="host-playable-advance" ${busy ? "disabled" : ""}>进入下一幕</button>`
                 : view.canConfirmEnding
                   ? `<button type="button" class="primary-btn" data-action="host-playable-finish" ${busy ? "disabled" : ""}>结束本局</button>`
                   : `<button type="button" class="primary-btn" disabled title="需先完成最终指认并结算">结束本局</button>`
             }
           </div>`
        : ""
    }
    ${view.status === "FINISHED" ? `<p class="muted-note">本局已结束。${escapeHtml(view.endingSummary?.publicSummary || "")}</p>` : ""}
  </section>`;
}
