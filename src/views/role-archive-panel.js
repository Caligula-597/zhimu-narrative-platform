/** Role archive panel for writer professional view. */
import { escapeHtml } from "../utils/format.js";
import { ARC_STAGES } from "../../shared/creator-bible-contract.js";

export function renderRoleArchiveFields(role, archive = {}) {
  const arc = archive.arc || {};
  const arcFields = ARC_STAGES.map((stage) => `
    <label class="cockpit-field compact"><span>弧光 · ${stage}</span>
      <textarea data-arc-field="${stage}" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(arc[stage] || "")}</textarea></label>`).join("");
  return `<div class="role-archive-panel" data-role-archive="${escapeHtml(role.id)}">
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <strong>角色档案 · ${escapeHtml(role.name)}</strong>
      <button type="button" class="primary-btn compact" data-action="save-role-archive" data-role-id="${escapeHtml(role.id)}">保存档案</button>
    </div>
    <div class="role-archive-grid">
      <label class="cockpit-field compact"><span>玩家可见身份</span><textarea data-archive-field="publicIdentity" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.publicIdentity || "")}</textarea></label>
      <label class="cockpit-field compact"><span>隐藏身份</span><textarea data-archive-field="hiddenIdentity" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.hiddenIdentity || "")}</textarea></label>
      <label class="cockpit-field compact"><span>外在目标</span><textarea data-archive-field="externalGoal" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.externalGoal || "")}</textarea></label>
      <label class="cockpit-field compact"><span>内在需求</span><textarea data-archive-field="internalNeed" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.internalNeed || "")}</textarea></label>
      <label class="cockpit-field compact"><span>最大秘密</span><textarea data-archive-field="secret" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.secret || "")}</textarea></label>
      <label class="cockpit-field compact"><span>行动线</span><textarea data-archive-field="actionLine" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.actionLine || "")}</textarea></label>
      <label class="cockpit-field compact"><span>内在冲突</span><textarea data-archive-field="innerConflict" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.innerConflict || "")}</textarea></label>
      <label class="cockpit-field compact"><span>说话风格提示</span><textarea data-archive-field="voiceHints" data-role-id="${escapeHtml(role.id)}" rows="2">${escapeHtml(archive.voiceHints || "")}</textarea></label>
    </div>
    <details class="segment-refs-summary" open><summary>人物弧光（四段）</summary>${arcFields}</details>
  </div>`;
}

export function archiveMapFromList(archives = []) {
  return Object.fromEntries((archives || []).map((a) => [a.roleSlotId, a]));
}
