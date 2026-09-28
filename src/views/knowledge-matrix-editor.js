/**
 * Knowledge Matrix — role × act grid.
 *
 * A pure aggregation view (Library-wise): rows = roles, columns = acts (chapters).
 * Each cell answers, for that role and that act:
 *   - 知道 (knows): derived from the role's per-act sections (title + body),
 *   - 误认 (misbelieves): from the Misidentification register, matched by
 *     holder + act (live vs refuted), and
 *     "不知道" is the remainder not covered.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openKnowledgeMatrix()
 *   closeKnowledgeMatrix()
 *   knowledgeMatrixWorkspaceHtml(data, session)
 *   bindKnowledgeMatrix(data, session)
 */

import * as misApi from "../api/misidentification.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import {
  beginWriterToolSession,
  getWriterToolSession,
  clearWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";

const TOOL_TYPE = "knowledge-matrix";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

function roleName(role) {
  return role?.name || role?.label || role?.id?.slice(0, 8) || "未命名";
}
function chapterName(ch) {
  return ch?.name || ch?.title || ch?.id?.slice(0, 8);
}
function chapterOrder(ch, idx) {
  return ch?.order ?? ch?.sequence ?? idx;
}

export async function openKnowledgeMatrix() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能查看知识矩阵");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { misids: [], showSections: false },
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view = {
      misids: (await misApi.listMisidentifications(session.worldId)) || [],
      showSections: false
    };
  } catch (error) {
    session.error = normalizeError(error, "读取误认数据失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeKnowledgeMatrix() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function toggleKnowledgeMatrixSections() {
  const session = currentSession();
  if (!session) return;
  session.view.showSections = !session.view.showSections;
  render();
}

function buildMatrix(data, misids) {
  const roles = data?.roles || [];
  const chapters = data?.chapters || [];
  const sections = data?.sections || [];

  const sortedChapters = chapters
    .map((ch, idx) => ({ ch, order: chapterOrder(ch, idx) }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.ch);

  // sections[chapterId] = Array; each section has roleSlotId, title, body
  const sectionsByChapter = new Map();
  for (const section of sections) {
    const key = section.chapterId || section.chapter_id || "";
    if (!sectionsByChapter.has(key)) sectionsByChapter.set(key, []);
    sectionsByChapter.get(key).push(section);
  }

  // misids[actId] = Array
  const misidsByAct = new Map();
  for (const m of misids) {
    const key = m.actId || "";
    if (!misidsByAct.has(key)) misidsByAct.set(key, []);
    misidsByAct.get(key).push(m);
  }

  // roleId → roleLabel (bind misid via holderId or holderLabel)
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const cells = new Map(); // `${chapterId}|${roleId}` → view cell
  function cellFor(chapterId, roleId) {
    const key = `${chapterId}\u0000${roleId}`;
    if (!cells.has(key)) {
      cells.set(key, { knows: [], misids: [] });
    }
    return cells.get(key);
  }

  for (const chapter of sortedChapters) {
    for (const section of sectionsByChapter.get(chapter.id) || []) {
      const roleId = section.roleSlotId || section.role_slot_id || "";
      cellFor(chapter.id, roleId).knows.push(section);
    }
    for (const misid of misidsByAct.get(chapter.id) || []) {
      let holderId = misid.holderId;
      if (!holderId && !misid.holderLabel) continue;
      // try match by label too
      const byLabel = roles.find((r) =>
        r.name === misid.holderLabel || r.label === misid.holderLabel);
      holderId = holderId || byLabel?.id || "";
      if (!holderId) continue;
      cellFor(chapter.id, holderId).misids.push(misid);
    }
  }

  return { roles, sortedChapters, cells, roleById };
}

export function knowledgeMatrixWorkspaceHtml(data, session) {
  if (!session) return "";
  const misids = session.view?.misids || [];
  const { roles, sortedChapters, cells, roleById } = buildMatrix(data, misids);
  const showSections = session.view?.showSections;

  const colHeaders = sortedChapters.map((ch) =>
    `<th class="kmat-col-head">${escapeHtml(chapterName(ch))}</th>`
  ).join("");

  const emptyCol = (session.loading)
    ? `<td class="kmat-empty" colspan="${sortedChapters.length + 1}">加载中…</td>`
    : `<td class="kmat-empty" colspan="${Math.max(sortedChapters.length + 1, 1)}">
        ${sortedChapters.length ? "（该角色无任何分幕）" : "（尚无任何幕/章节）"}
       </td>`;

  const rows = roles.map((role) => {
    const tds = sortedChapters.map((chapter) => {
      const cell = cells.get(`${chapter.id}\u0000${role.id}`);
      if (!cell || (!cell.knows.length && !cell.misids.length)) {
        return `<td class="kmat-cell kmat-unknown"><span class="kmat-tag no">不知道</span></td>`;
      }
      const knowBadge = cell.knows.length
        ? `<span class="kmat-tag yes">知道 · ${cell.knows.length}</span>`
        : "";
      const misidBadge = cell.misids.length
        ? `<span class="kmat-tag misid">误认 · ${cell.misids.length}</span>`
        : "";
      let body = "";
      if (showSections && cell.knows.length) {
        body = `<ul class="kmat-section-list">${
          cell.knows.map((s) => `<li>${escapeHtml(s.title || "未命名分幕")}</li>`).join("")
        }</ul>`;
      }
      if (cell.misids.length) {
        body += `<ul class="kmat-misid-list">${
          cell.misids.map((m) =>
            `<li class="${m.isActive === false ? "refuted" : "live"}">
              ${escapeHtml(m.title || "")} ${m.content ? "· " + escapeHtml(m.content.slice(0, 40)) : ""}
            </li>`).join("")
        }</ul>`;
      }
      return `<td class="kmat-cell ${cell.misids.length ? "has-misid" : ""}">
        <div class="kmat-tags">${knowBadge}${misidBadge}</div>
        ${body || ""}
      </td>`;
    }).join("");
    return `<tr class="kmat-row">
      <th class="kmat-role-head">${escapeHtml(roleName(role))}</th>
      ${tds}
    </tr>`;
  }).join("");

  const totalKnown = [...cells.values()].reduce((n, c) => n + (c.knows.length ? 1 : 0), 0);
  const totalMisid = misids.length;

  return `
    <style>
      .kmat-shell{display:flex;flex-direction:column;gap:14px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .kmat-header h2{margin:0 0 4px;font-size:20px;}
      .kmat-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .kmat-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .kmat-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--muted,#6b7a74);}
      .kmat-legend .legend-tag{display:inline-flex;align-items:center;gap:5px;}
      .kmat-scroll{overflow:auto;max-height:calc(100vh - 240px);border:1px solid var(--line,#dfe7e3);border-radius:12px;}
      .kmat-table{border-collapse:collapse;min-width:100%;font-size:13px;}
      .kmat-table th,.kmat-table td{border:1px solid var(--line,#dfe7e3);padding:10px;vertical-align:top;}
      .kmat-col-head,.kmat-role-head{background:#f2f6f4;color:var(--ink,#22302c);font-weight:700;text-align:left;}
      .kmat-col-head{position:sticky;top:0;min-width:170px;}
      .kmat-role-head{position:sticky;left:0;min-width:120px;background:#eef3f0;}
      .kmat-cell{background:var(--card,#fff);}
      .kmat-cell.has-misid{background:#fff8f6;}
      .kmat-unknown{background:#fafafa;color:var(--muted,#9aa8a2);}
      .kmat-tags{display:flex;gap:6px;flex-wrap:wrap;}
      .kmat-tag{font-size:11px;padding:2px 8px;border-radius:999px;font-weight:700;}
      .kmat-tag.yes{background:#e3f1e8;color:#2f6b4f;}
      .kmat-tag.no{background:#eef1ef;color:#9aa8a2;}
      .kmat-tag.misid{background:#fce3e0;color:#b22d3a;}
      .kmat-section-list{margin:6px 0 0;padding-left:16px;color:var(--ink,#22302c);font-size:12px;}
      .kmat-misid-list{margin:6px 0 0;padding-left:16px;font-size:12px;}
      .kmat-misid-list li.live{color:#b22d3a;}
      .kmat-misid-list li.refuted{color:var(--muted,#6b7a74);text-decoration:line-through;}
      .kmat-empty{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:20px;}
    </style>
    <section class="kmat-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="kmat-header">
        <h2>知识矩阵</h2>
        <p class="kmat-lede">角色 × 幕的时间轴网格：每格聚合该角色在该幕「知道」的分幕，以及其「误认」的登记。</p>
        <div class="toolbar">
          <button type="button" class="btn outline" data-action="kmat-toggle-sections">
            ${showSections ? "隐藏分幕标题" : "展开分幕标题"}
          </button>
          <button type="button" class="btn quiet" data-action="kmat-close">关闭</button>
        </div>
      </div>

      <div class="kmat-legend">
        <span class="legend-tag"><span class="kmat-tag yes">知道</span> 该角色在此幕存在分幕</span>
        <span class="legend-tag"><span class="kmat-tag misid">误认</span> 该角色在此幕存在误认登记（${totalMisid} 条）</span>
        <span class="legend-tag"><span class="kmat-tag no">不知道</span> 无记录</span>
      </div>

      ${session.loading ? '<div class="kmat-empty">加载中…</div>' : `
      <div class="kmat-scroll">
        <table class="kmat-table">
          <thead><tr><th class="kmat-role-head">角色 / 幕</th>${colHeaders}</tr></thead>
          <tbody>${rows || `<tr>${emptyCol}</tr>`}</tbody>
        </table>
      </div>`}
      ${session.error ? `<div class="kmat-empty">${escapeHtml(session.error)}</div>` : ""}
    </section>
  `;
}

export function bindKnowledgeMatrix(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";
  root.querySelector("[data-action='kmat-close']")?.addEventListener("click", closeKnowledgeMatrix);
  root.querySelector("[data-action='kmat-toggle-sections']")?.addEventListener("click", toggleKnowledgeMatrixSections);
}