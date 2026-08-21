/** Role archive panel for writer professional view. */
import { escapeHtml } from "../utils/format.js";
import { ARC_STAGES } from "../../shared/creator-bible-contract.js";

function appearanceRowsHtml(archive = {}, { readOnly = false } = {}) {
  const rows = Array.isArray(archive.appearanceStates) && archive.appearanceStates.length
    ? archive.appearanceStates
    : [{ phaseLabel: "", appearance: "", notes: "" }];
  const readonly = readOnly ? " readonly" : "";
  return rows.map((row, index) => `
    <div class="appearance-state-row" data-appearance-index="${index}">
      <label class="cockpit-field compact"><span>阶段（幕/日）</span>
        <input class="field" data-appearance-field="phaseLabel" value="${escapeHtml(row.phaseLabel || "")}"${readonly} placeholder="如 D1 / 第二幕"></label>
      <label class="cockpit-field compact"><span>此时外形 / 状态</span>
        <input class="field" data-appearance-field="appearance" value="${escapeHtml(row.appearance || "")}"${readonly} placeholder="玩家当天看到的外形"></label>
      <label class="cockpit-field compact"><span>备注</span>
        <input class="field" data-appearance-field="notes" value="${escapeHtml(row.notes || "")}"${readonly}></label>
    </div>`).join("");
}

export function renderRoleArchiveFields(role, archive = {}, { readOnly = false } = {}) {
  const readonly = readOnly ? " readonly" : "";
  const arc = archive.arc || {};
  const arcFields = ARC_STAGES.map((stage) => `
    <label class="cockpit-field compact"><span>弧光 · ${stage}</span>
      <textarea data-arc-field="${stage}" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(arc[stage] || "")}</textarea></label>`).join("");
  return `<div class="role-archive-panel" data-role-archive="${escapeHtml(role.id)}">
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <strong>角色档案 · ${escapeHtml(role.name)}</strong>
      ${readOnly ? '<span class="cloud-pill">只读</span>' : `<button type="button" class="primary-btn compact" data-action="save-role-archive" data-role-id="${escapeHtml(role.id)}">保存档案</button>`}
    </div>
    <div class="role-archive-grid">
      <label class="cockpit-field compact"><span>玩家可见身份</span><textarea data-archive-field="publicIdentity" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.publicIdentity || "")}</textarea></label>
      <label class="cockpit-field compact"><span>真实身份</span><textarea data-archive-field="hiddenIdentity" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.hiddenIdentity || "")}</textarea></label>
      <label class="cockpit-field compact"><span>外在目标</span><textarea data-archive-field="externalGoal" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.externalGoal || "")}</textarea></label>
      <label class="cockpit-field compact"><span>内在需求</span><textarea data-archive-field="internalNeed" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.internalNeed || "")}</textarea></label>
      <label class="cockpit-field compact"><span>最大秘密</span><textarea data-archive-field="secret" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.secret || "")}</textarea></label>
      <label class="cockpit-field compact"><span>行动线</span><textarea data-archive-field="actionLine" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.actionLine || "")}</textarea></label>
      <label class="cockpit-field compact"><span>内在冲突</span><textarea data-archive-field="innerConflict" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.innerConflict || "")}</textarea></label>
      <label class="cockpit-field compact"><span>说话风格提示</span><textarea data-archive-field="voiceHints" data-role-id="${escapeHtml(role.id)}" rows="2"${readonly}>${escapeHtml(archive.voiceHints || "")}</textarea></label>
    </div>
    <details class="segment-refs-summary" open>
      <summary>外形 / 状态映射（按幕或按日）</summary>
      <p class="muted-note">真实身份写在上方「真实身份」。这里只记录每个阶段玩家看到的外形，例如变身环、易容、分日形态。</p>
      <div class="appearance-state-list" data-appearance-list>${appearanceRowsHtml(archive, { readOnly })}</div>
      ${readOnly ? "" : `<div class="row" style="margin-top:8px"><button type="button" class="secondary-btn compact" data-action="add-appearance-state" data-role-id="${escapeHtml(role.id)}">添加阶段</button></div>`}
    </details>
    <details class="segment-refs-summary" open><summary>人物弧光（四段）</summary>${arcFields}</details>
  </div>`;
}

export function archiveMapFromList(archives = []) {
  return Object.fromEntries((archives || []).map((a) => [a.roleSlotId, a]));
}

export function readAppearanceStatesFromRoot(root) {
  return [...(root?.querySelectorAll("[data-appearance-index]") || [])].map((row) => ({
    phaseLabel: row.querySelector('[data-appearance-field="phaseLabel"]')?.value?.trim() || "",
    appearance: row.querySelector('[data-appearance-field="appearance"]')?.value?.trim() || "",
    notes: row.querySelector('[data-appearance-field="notes"]')?.value?.trim() || ""
  })).filter((row) => row.phaseLabel || row.appearance || row.notes);
}
