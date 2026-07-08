/** Segment ops helpers for creator cockpit inline editor. */
import { normalizeSegmentOperations } from "shared/segment-contract.js";
import { escapeHtml } from "../utils/format.js";

function listFromLines(value = "") {
  return String(value).split("\n").map((line) => line.trim()).filter(Boolean);
}

export function clueGrantsToText(grants = []) {
  return (grants || [])
    .map((grant) => [grant.clueId || grant.clue_id || "", grant.when || grant.timing || "", grant.roleKey || grant.role_key || ""].filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n");
}

export function clueGrantsFromText(value = "") {
  return listFromLines(value).map((line) => {
    const [clueId = "", when = "", roleKey = ""] = line.split("|").map((part) => part.trim());
    return { clueId, when, roleKey };
  }).filter((grant) => grant.clueId);
}

export function renderCockpitSegmentEditor(segment, studio) {
  if (!segment) {
    return `<div class="empty-state">选择左侧 Segment 段落，在此编辑主持 runbook。</div>`;
  }
  const ops = normalizeSegmentOperations(segment.operations || {});
  const refs = segment.refs || [];
  const refRows = refs.length
    ? refs.slice(0, 8).map((r) => `<li><code>${escapeHtml(r.refType || "ref")}</code> ${escapeHtml(r.refId?.slice(0, 8) || "")}${r.metadata?.when ? ` · ${escapeHtml(r.metadata.when)}` : ""}</li>`).join("")
    : `<li class="muted-note">暂无关联。完整 refs 编辑请开 Segment 工作台。</li>`;
  return `<section class="cockpit-segment-editor" data-cockpit-segment-editor="${escapeHtml(segment.id)}">
    <div class="panel-heading compact"><div><p>${escapeHtml(segment.segmentKey)}</p><h3>${escapeHtml(segment.title)}</h3></div>
      <div class="row">${linkButton({ view: "structure", label: "完整工作台" }, "text-btn compact")}<button type="button" class="primary-btn compact" data-action="cockpit-save-segment" data-segment-id="${escapeHtml(segment.id)}">保存 runbook</button></div></div>
    <details class="segment-refs-summary" open><summary>关联资源 · ${refs.length}</summary><ul>${refRows}</ul></details>
    <label class="cockpit-field"><span>主持流程 flow</span><textarea data-cockpit-seg="flow" rows="5">${escapeHtml(ops.flow || "")}</textarea></label>
    <label class="cockpit-field"><span>主持真相 hostTruth</span><textarea data-cockpit-seg="hostTruth" rows="4">${escapeHtml(ops.hostTruth || "")}</textarea></label>
    <label class="cockpit-field"><span>应发线索 clueGrants</span><textarea data-cockpit-seg="clueGrants" rows="4" placeholder="clueId | 发放时机 | roleKey">${escapeHtml(clueGrantsToText(ops.clueGrants))}</textarea></label>
    <p class="muted-note">保存后主持端「应发线索」会更新。</p>
  </section>`;
}

function linkButton(link, className = "secondary-btn compact") {
  if (!link?.view) return "";
  return `<button type="button" class="${className}" data-go="${escapeHtml(link.view)}">${escapeHtml(link.label || "打开")}</button>`;
}
