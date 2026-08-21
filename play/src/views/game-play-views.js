import { asArray, escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";

function communicationTemplate(kind) {
  return asArray(state.home?.communicationTemplates)
    .find((template) => template.kind === kind && template.enabled !== false) || null;
}

function deadlineText(template) {
  return Number(template?.deadlineMinutes) > 0
    ? `正式开场后 ${template.deadlineMinutes} 分钟截止`
    : "本局开放期间可提交";
}

function testimonyForm() {
  const template = communicationTemplate("testimony");
  if (!template) return "";
  return `<article class="card testimony-form-card" data-communication-form="testimony">
    <h3>${escapeHtml(template.title)}</h3>
    <p class="muted">${escapeHtml(template.privacyNotice)}</p>
    <p class="communication-deadline">${escapeHtml(deadlineText(template))}</p>
    <textarea class="input" rows="4" data-testimony-body placeholder="${escapeHtml(template.placeholder)}"></textarea>
    <button class="btn primary" type="button" data-action="submit-testimony" data-template-key="testimony">${escapeHtml(template.title)}</button>
  </article>`;
}

function privateCommunicationForms() {
  return ["public_statement", "secret_action", "ask_host"]
    .map(communicationTemplate)
    .filter(Boolean)
    .map((template) => `<article class="card notes-editor communication-action-card" data-communication-form="${escapeHtml(template.key)}">
      <div class="communication-action-head"><h3>${escapeHtml(template.title)}</h3><span>${escapeHtml(deadlineText(template))}</span></div>
      <p class="muted">${escapeHtml(template.privacyNotice)}</p>
      <textarea class="input" rows="3" data-private-action-body placeholder="${escapeHtml(template.placeholder)}"></textarea>
      <button class="btn ${template.kind === "public_statement" ? "primary" : "outline"}" type="button" data-action="submit-private-action" data-template-key="${escapeHtml(template.key)}">提交</button>
    </article>`).join("");
}

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
      ${testimonyForm()}
      ${testimonies.length
          ? `<article class="card testimony-form-card"><div class="testimony-history"><p class="eyebrow">已提交</p>${testimonies
              .slice(0, 3)
              .map(
                (row) => `<div class="testimony-row">
                  <time>${escapeHtml(String(row.submitted_at || "").slice(0, 16))}</time>
                  <p>${escapeHtml(row.body)}</p>
                  ${row.host_flag ? `<span class="host-flag">${row.host_flag === "contradiction" ? "主持标记：矛盾" : "主持已阅"}</span>` : ""}
                </div>`
              )
              .join("")}</div></article>`
          : ""}
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
        <div class="notes-item-head"><strong>${escapeHtml(row.title)}</strong>${row.visibility === "public" ? `<span class="notes-source">${escapeHtml(row.actor_role_name || "公开")}</span>` : ""}<time class="notes-time">${escapeHtml(String(row.created_at || "").slice(0, 16))}</time></div>
        <p class="notes-body">${escapeHtml(row.body || "")}</p>
        ${row.host_response ? `<p class="muted">主持回复：${escapeHtml(row.host_response)}</p>` : ""}
        <span class="status-chip ${row.status === "accepted" ? "published" : row.status === "rejected" ? "draft" : "testing"}">${escapeHtml(row.status || "submitted")}</span>
      </article>`
        )
        .join("")
    : "";

  return `<div class="social-panel">
    <p class="eyebrow">社交博弈</p>
    <p class="muted small">每个入口的可见范围和截止时间均来自当前剧本发布版本。</p>
    <section class="social-section"><h3>投票 / 指认</h3>${voteBlocks}</section>
    <section class="social-section">
      <h3>交流动作</h3>
      <div class="communication-action-grid">${privateCommunicationForms() || `<div class="empty enriched-empty">本剧本未开放额外交流动作。</div>`}</div>
      ${actionHistory ? `<div class="notes-list">${actionHistory}</div>` : `<div class="empty enriched-empty"><span class="empty-icon">🤫</span>尚无秘密行动记录。</div>`}
    </section>
  </div>`;
}

export function renderSuspicionsTab() {
  const members = (state.home?.roomMembers || []).filter((m) => m.role_slot_id && m.role_slot_id !== state.home?.role?.id);
  const suspicions = new Map((state.home?.suspicions || []).map((row) => [row.target_role_slot_id, row]));
  const relationships = asArray(state.relationships);
  const statusLabels = { unknown: "未定义", allied: "结盟", trusted: "信任", strained: "紧张", hostile: "敌对", broken: "决裂" };
  const relationshipPanel = `<section class="relationship-trajectory-panel"><div><p class="eyebrow">人物关系轨迹</p><p class="muted small">主持只会公开现场已经发生、且允许你查看的变化。</p></div>${relationships.length ? relationships.map((relationship) => `<article class="relationship-trajectory-card">
    <div class="relationship-trajectory-head"><strong>${escapeHtml(relationship.fromRoleName)} → ${escapeHtml(relationship.toRoleName)}</strong><span class="status-chip">${escapeHtml(statusLabels[relationship.status] || relationship.status)}</span></div>
    <p>${escapeHtml(relationship.publicLabel)}</p>${relationship.publicNote ? `<p class="muted">${escapeHtml(relationship.publicNote)}</p>` : ""}
    <div class="relationship-strength"><span>关系强度</span><meter min="-10" max="10" low="-4" high="4" optimum="8" value="${Number(relationship.currentStrength)}">${Number(relationship.currentStrength)}</meter><b>${Number(relationship.currentStrength)}</b></div>
    ${relationship.history?.length ? `<ol class="relationship-history">${relationship.history.slice(-4).reverse().map((entry) => `<li><time>${escapeHtml(String(entry.changedAt || "").slice(0,16))}</time><span>${escapeHtml(statusLabels[entry.status] || entry.status)} · ${Number(entry.strength)}</span>${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ""}</li>`).join("")}</ol>` : ""}
  </article>`).join("") : `<div class="empty enriched-empty">当前没有向你公开的人物关系变化。</div>`}</section>`;
  if (!members.length) return `${relationshipPanel}<div class="empty enriched-empty">尚无其他角色入席，无法标注怀疑对象。</div>`;
  return `
    <div class="suspicions-panel">
      ${relationshipPanel}
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
