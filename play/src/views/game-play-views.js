import { asArray, escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";

export function renderTasksTab() {
  const home = state.home;
  const tasks = asArray(home?.tasks);
  const actKey = home?.currentActKey || "ch1";
  const testimonies = asArray(home?.testimonies);
  const taskList = tasks.length
    ? tasks
        .map(
          (task) => `
      <article class="card task-card ${task.status === "completed" ? "is-done" : ""}">
        <div class="task-head">
          <span class="task-visibility">${task.visibility === "secret" ? "秘密" : task.visibility === "optional" ? "可选" : "公开"}</span>
          <strong>${escapeHtml(task.body)}</strong>
        </div>
        ${task.tips ? `<p class="muted task-tips">${escapeHtml(task.tips)}</p>` : ""}
        ${task.status === "completed"
          ? `<span class="task-done-label">已完成</span>`
          : `<button class="btn outline compact" type="button" data-action="complete-player-task" data-task-id="${task.id}">标记完成</button>`}
      </article>`
        )
        .join("")
    : `<div class="empty enriched-empty"><span class="empty-icon">📋</span>当前幕（${escapeHtml(actKey)}）暂无任务。导入 Matrix 角色档案后会自动下发。</div>`;

  return `
    <div class="tasks-panel">
      <p class="eyebrow">本幕任务 · ${escapeHtml(actKey)}</p>
      <div class="task-list">${taskList}</div>
      <article class="card testimony-form-card">
        <h3>提交口供</h3>
        <p class="muted">向主持人提交本幕陈述（其他玩家默认不可见）。</p>
        <textarea class="input" rows="4" data-testimony-body placeholder="写下你此刻愿意公开陈述的内容…"></textarea>
        <button class="btn primary" type="button" data-action="submit-testimony">提交口供</button>
        ${testimonies.length
          ? `<div class="testimony-history"><p class="eyebrow">已提交</p>${testimonies
              .slice(0, 3)
              .map(
                (row) => `<div class="testimony-row">
                  <time>${escapeHtml(String(row.submitted_at || "").slice(0, 16))}</time>
                  <p>${escapeHtml(row.body)}</p>
                  ${row.host_flag ? `<span class="host-flag">${row.host_flag === "contradiction" ? "主持标记：矛盾" : "主持已阅"}</span>` : ""}
                </div>`
              )
              .join("")}</div>`
          : ""}
      </article>
    </div>`;
}

function parseVoteOptions(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

export function renderSocialTab() {
  const votes = asArray(state.home?.activeVotes);
  const actions = asArray(state.home?.privateActions);
  const voteBlocks = votes.length
    ? votes
        .map((vote) => {
          const options = parseVoteOptions(vote.options);
          const submitted = Boolean(vote.submitted_at);
          const canVote = vote.status === "open" && !submitted;
          const optionHtml = canVote
            ? options
                .map(
                  (opt) =>
                    `<button class="btn outline compact" type="button" data-action="submit-vote-ballot" data-vote-id="${escapeHtml(String(vote.id))}" data-option-id="${escapeHtml(String(opt.id))}">${escapeHtml(opt.label)}</button>`
                )
                .join(" ")
            : submitted
              ? `<span class="muted">已提交</span>`
              : `<span class="muted">${vote.status === "published" ? "结果已公布" : "投票已关闭"}</span>`;
          return `<article class="card vote-card">
          <h3>${escapeHtml(vote.title)}</h3>
          ${vote.prompt ? `<p class="muted">${escapeHtml(vote.prompt)}</p>` : ""}
          <div class="vote-options row">${optionHtml}</div>
        </article>`;
        })
        .join("")
    : `<div class="empty enriched-empty"><span class="empty-icon">🗳</span>主持人尚未开启投票/指认。</div>`;

  const actionHistory = actions.length
    ? actions
        .slice(0, 10)
        .map(
          (row) => `<article class="notes-item">
        <div class="notes-item-head"><strong>${escapeHtml(row.title)}</strong><span class="notes-source">${escapeHtml(row.action_type || "")}</span><time class="notes-time">${escapeHtml(String(row.created_at || "").slice(0, 16))}</time></div>
        <p class="notes-body">${escapeHtml(row.body || "")}</p>
        ${row.host_response ? `<p class="muted">主持回复：${escapeHtml(row.host_response)}</p>` : ""}
        <span class="status-chip ${row.status === "accepted" ? "published" : row.status === "rejected" ? "draft" : "testing"}">${escapeHtml(row.status || "submitted")}</span>
      </article>`
        )
        .join("")
    : "";

  return `<div class="social-panel">
    <p class="eyebrow">社交博弈</p>
    <p class="muted small">投票由主持人发起；秘密行动/询问仅主持可见（部分类型目标角色可见）。</p>
    <section class="social-section"><h3>投票 / 指认</h3>${voteBlocks}</section>
    <section class="social-section">
      <h3>秘密行动 / 询问主持</h3>
      <article class="card notes-editor">
        <select class="input" data-private-action-type>
          <option value="ask_host">询问主持</option>
          <option value="secret_action">秘密行动</option>
          <option value="trade">交易提议</option>
          <option value="promise">承诺</option>
          <option value="accusation_note">指认笔记</option>
        </select>
        <input class="input" type="text" data-private-action-title placeholder="标题（必填）">
        <textarea class="input" rows="3" data-private-action-body placeholder="详细说明…"></textarea>
        <button class="btn primary" type="button" data-action="submit-private-action">提交</button>
      </article>
      ${actionHistory ? `<div class="notes-list">${actionHistory}</div>` : `<div class="empty enriched-empty"><span class="empty-icon">🤫</span>尚无秘密行动记录。</div>`}
    </section>
  </div>`;
}

export function renderSuspicionsTab() {
  const members = (state.home?.roomMembers || []).filter((m) => m.role_slot_id && m.role_slot_id !== state.home?.role?.id);
  const suspicions = new Map((state.home?.suspicions || []).map((row) => [row.target_role_slot_id, row]));
  if (!members.length) {
    return `<div class="empty enriched-empty"><span class="empty-icon">🕵️</span>尚无其他角色入席，无法标注怀疑对象。</div>`;
  }
  return `
    <div class="suspicions-panel">
      <p class="eyebrow">怀疑度（仅自己可见）</p>
      ${members
        .map((member) => {
          const current = suspicions.get(member.role_slot_id) || { level: 0, reason: "" };
          return `
        <article class="card suspicion-card" data-target-role="${member.role_slot_id}">
          <strong>${escapeHtml(member.role_name)}</strong>
          <label class="suspicion-level">怀疑度
            <input type="range" min="0" max="5" step="1" value="${current.level || 0}" data-suspicion-level />
            <span data-suspicion-level-label>${current.level || 0}</span>
          </label>
          <textarea class="input" rows="2" data-suspicion-reason placeholder="原因（可选）">${escapeHtml(current.reason || "")}</textarea>
          <button class="btn outline compact" type="button" data-action="save-suspicion" data-target-role="${member.role_slot_id}">保存</button>
        </article>`;
        })
        .join("")}
    </div>`;
}
