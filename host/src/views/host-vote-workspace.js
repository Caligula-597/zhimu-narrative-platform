import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  HOST_VOTE_LIMITS,
  HOST_VOTE_TYPES,
  HOST_VOTE_VISIBILITIES,
  hostVoteWorkspaceContextIsCurrent,
  hostVoteWorkspaceIsLocked,
  hostVoteWorkspaceIsPending
} from "../runtime/host-vote-workspace-model.js";
import { escapeHtml } from "../utils/format.js";

function statusHtml(workspace) {
  if (!workspace.message && !workspace.errors.length) return "";
  const tone = workspace.status === "error"
    ? "error"
    : workspace.status === "uncertain" || workspace.status === "confirm-discard"
      ? "warning"
      : workspace.status === "success"
        ? "success"
        : "pending";
  return `<section class="host-vote-status ${tone}" role="${tone === "error" ? "alert" : "status"}">
    ${workspace.message ? `<p>${escapeHtml(workspace.message)}</p>` : ""}
    ${workspace.errors.length ? `<ul>${workspace.errors.map((error) => `<li>${escapeHtml(error.message || String(error))}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function selectOptions(options, current) {
  return options.map(([value, label]) =>
    `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");
}

export function renderHostVoteWorkspace() {
  const workspace = state.hostVoteWorkspace;
  if (!workspace || !hostVoteWorkspaceContextIsCurrent(workspace, getRoomId())) return "";
  const locked = hostVoteWorkspaceIsLocked(workspace);
  return `<section class="host-vote-workspace" data-host-vote-workspace aria-labelledby="host-vote-workspace-title">
    <header class="host-vote-workspace-head">
      <div><p class="section-kicker">LIVE VOTE WORKSPACE</p><h2 id="host-vote-workspace-title">创建现场投票</h2><p>投票固定写入当前运行房；未单独配置候选项时，系统会使用本房间角色席位。</p></div>
      <button type="button" class="secondary-btn" data-action="host-vote-workspace-close" ${hostVoteWorkspaceIsPending(workspace) ? "disabled" : ""}>${workspace.status === "confirm-discard" ? "放弃草稿" : "返回监控台"}</button>
    </header>
    ${statusHtml(workspace)}
    <div class="host-vote-workspace-grid">
      <div class="host-vote-form">
        <label>投票标题 <span>${workspace.title.length}/${HOST_VOTE_LIMITS.TITLE_MAX}</span>
          <input class="field" type="text" maxlength="${HOST_VOTE_LIMITS.TITLE_MAX}" data-host-vote-field="title" value="${escapeHtml(workspace.title)}" placeholder="例如：第二幕凶手指认" ${locked ? "disabled" : ""}>
        </label>
        <label>玩家提示 <span>${workspace.prompt.length}/${HOST_VOTE_LIMITS.PROMPT_MAX}</span>
          <textarea class="field" maxlength="${HOST_VOTE_LIMITS.PROMPT_MAX}" data-host-vote-field="prompt" rows="5" ${locked ? "disabled" : ""}>${escapeHtml(workspace.prompt)}</textarea>
        </label>
        <div class="host-vote-two-column">
          <label>投票类型
            <select class="field" data-host-vote-field="voteType" ${locked ? "disabled" : ""}>${selectOptions(HOST_VOTE_TYPES, workspace.voteType)}</select>
          </label>
          <label>结果可见性
            <select class="field" data-host-vote-field="visibility" ${locked ? "disabled" : ""}>${selectOptions(HOST_VOTE_VISIBILITIES, workspace.visibility)}</select>
          </label>
        </div>
        ${workspace.voteType === "accusation" ? `<div class="host-vote-options-note"><strong>候选角色自动同步</strong><p>未自定义候选项时，服务端会使用当前运行房的角色席位。</p></div>` : `<label>候选项（每行一个）
          <textarea class="field" data-host-vote-field="optionsText" rows="6" placeholder="${workspace.voteType === "rating" ? "留空时自动生成 1–5 分" : "例如：继续调查&#10;公开线索&#10;进入下一幕"}" ${locked ? "disabled" : ""}>${escapeHtml(workspace.optionsText)}</textarea>
          <small>${workspace.voteType === "rating" ? "评分投票留空时使用 1–5 分。" : "最多 80 项，每项最多 200 字，不能重名。"}</small>
        </label>`}
      </div>
      <aside class="host-vote-impact">
        <p class="section-kicker">PLAYER IMPACT</p>
        <h3>玩家端表现</h3>
        <ol>
          <li>创建成功后，当前房间玩家通过实时通道收到投票更新。</li>
          <li>${workspace.voteType === "accusation" ? "指认候选项默认取当前角色席位，避免现场重复录入。" : workspace.voteType === "rating" ? "评分留空时自动使用 1–5 分，也可逐行自定义。" : "候选项按表单逐行创建，并在服务端一次性提交。"}</li>
          <li>“公布前保密”不会在主持公布前暴露实时票数。</li>
        </ol>
        <div class="host-vote-summary">
          <span>当前房间</span><strong>${escapeHtml(state.room?.name || "未命名运行房")}</strong>
          <span>候选席位</span><strong>${(state.cloudHostPlayers || []).length} 个</strong>
        </div>
        <div class="host-vote-actions">
          ${workspace.status === "uncertain" ? `<button type="button" class="secondary-btn" data-action="host-vote-workspace-reconcile">核对创建结果</button>` : ""}
          <button type="button" class="primary-btn" data-action="host-vote-workspace-submit" ${locked || workspace.status === "success" ? "disabled" : ""}>${hostVoteWorkspaceIsPending(workspace) ? "正在创建…" : workspace.status === "success" ? "已创建" : "确认创建投票"}</button>
        </div>
      </aside>
    </div>
  </section>`;
}
