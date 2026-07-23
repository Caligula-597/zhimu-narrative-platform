import { renderWorkspaceEditor } from "../components/workspace-editor.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { evaluatePublishImpact } from "../../shared/publish-impact-preview.js";
import { beginWriterToolSession } from "./writer-tool-session.js";

function roomChoices(data = {}) {
  return [
    { id: "__testing__", name: "假设：测试房", status: "testing" },
    { id: "__active__", name: "假设：正式房", status: "active" },
    ...(data.rooms || []).map((room) => ({
      id: room.id,
      name: `${room.name || "运行房"}（${room.status || "active"}）`,
      status: room.status || "active"
    }))
  ];
}

function optionsHtml(items, selectedId) {
  return items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function impactGroupHtml(title, items = []) {
  if (!items.length) return `<section class="publish-impact-group"><h4>${escapeHtml(title)}</h4><div class="empty-state">无</div></section>`;
  const rows = items.map((item) => `<div class="publish-impact-row ${item.visible ? "is-visible" : "is-hidden"}"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.reason)}</small></div><span class="status-chip ${item.visible ? "published" : "draft"}">${item.visible ? "可见" : "不可见"}</span></div>`).join("");
  return `<section class="publish-impact-group"><h4>${escapeHtml(title)} · ${items.filter((item) => item.visible).length}/${items.length}</h4>${rows}</section>`;
}

function impactResult(data, session) {
  const rooms = roomChoices(data);
  const room = rooms.find((item) => item.id === session.draft.roomId) || rooms[0];
  return evaluatePublishImpact({
    roleSlotId: session.draft.roleId,
    roomStatus: room.status,
    chapters: data.chapters || [],
    sections: data.sections || [],
    scenes: data.scenes || [],
    clues: data.clues || [],
    tasks: data.playerTasks || data.tasks || []
  });
}

export function impactWorkspaceHtml(data, session) {
  const roles = data.roles || [];
  const rooms = roomChoices(data);
  if (!roles.some((item) => item.id === session.draft.roleId)) session.draft.roleId = roles[0]?.id || "";
  if (!rooms.some((item) => item.id === session.draft.roomId)) session.draft.roomId = rooms[0]?.id || "";
  const impact = impactResult(data, session);
  const body = `<div class="writer-impact-controls">
    <label><span>模拟角色</span><select class="field" data-impact-role>${optionsHtml(roles, session.draft.roleId)}</select></label>
    <label><span>房间 / 模式</span><select class="field" data-impact-room>${optionsHtml(rooms, session.draft.roomId)}</select></label>
  </div>
  <p class="publish-impact-summary">预计可见 <strong>${impact.summary.visible}</strong> / 共 ${impact.summary.total} · 房间状态 <code>${escapeHtml(impact.roomStatus)}</code></p>
  <div class="writer-impact-results">
    ${impactGroupHtml("章节", impact.chapters)}
    ${impactGroupHtml("私人分幕", impact.sections)}
    ${impactGroupHtml("场景", impact.scenes)}
    ${impactGroupHtml("线索", impact.clues)}
    ${impactGroupHtml("任务", impact.tasks)}
  </div>`;
  return `<section class="writer-tool-workspace" data-writer-tool-workspace data-writer-tool="impact">
    <button type="button" class="workspace-back-btn" data-action="writer-tool-close">← 返回创作中心</button>
    <div class="writer-tool-grid">
      <aside class="writer-tool-context">
        <p class="section-kicker">PLAYER VISIBILITY</p>
        <h2>发布影响预览</h2>
        <p>按角色和房间阶段推演玩家初始可见内容，用于发现草稿误发布、角色内容串位和章节门槛缺失。</p>
        <dl class="writer-metadata-facts">
          <div><dt>预计可见</dt><dd>${impact.summary.visible}</dd></div>
          <div><dt>预计隐藏</dt><dd>${impact.summary.hidden}</dd></div>
          <div><dt>总项目</dt><dd>${impact.summary.total}</dd></div>
        </dl>
        <div class="writer-metadata-guidance"><strong>预览边界</strong><p>这里不模拟玩家已经获得的私密线索，也不执行运行房中的临时解锁；上线前仍需在真实测试房走一遍玩家视角。</p></div>
      </aside>
      ${renderWorkspaceEditor({
        title: "玩家可见性推演",
        kicker: "IMPACT REVIEW",
        intro: "切换角色或房间阶段即可重新计算，不会修改云端内容。",
        body,
        submitAction: "",
        cancelAction: "writer-tool-close",
        cancelLabel: "返回创作中心",
        className: "writer-impact-editor"
      })}
    </div>
  </section>`;
}

export function openImpactWorkspace() {
  const data = studioStore.get().cloudStudio;
  const roles = data?.roles || [];
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!roles.length) return showToast("请先创建角色");
  const rooms = roomChoices(data);
  const session = beginWriterToolSession("impact", data, {
    draft: {
      roleId: roles[0].id,
      roomId: rooms[0]?.id || "__testing__"
    }
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
}

export function bindImpactWorkspace(_data, session) {
  const root = document.querySelector('[data-writer-tool="impact"]');
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";
  root.querySelector("[data-impact-role]")?.addEventListener("change", (event) => {
    session.draft.roleId = event.target.value;
    render();
  });
  root.querySelector("[data-impact-room]")?.addEventListener("change", (event) => {
    session.draft.roomId = event.target.value;
    render();
  });
}
