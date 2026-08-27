/**
 * Dual view: immutable import snapshot + links to split modules.
 */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";

const showError = (error, fallback = "加载失败") => showToast(normalizeError(error, fallback));

function moduleLinksHtml(studio) {
  const counts = {
    roles: (studio?.roles || []).length,
    sections: (studio?.sections || []).length,
    chapters: (studio?.chapters || []).length,
    scenes: (studio?.scenes || []).length,
    clues: (studio?.clues || []).length
  };
  const cards = [
    { view: "writer", label: "角色私人剧本", detail: `${counts.roles} 角色 · ${counts.sections} 分幕` },
    { view: "truth", label: "谜底与主持手册", detail: "全文 / 结局 / 关系" },
    { view: "clues", label: "线索管理", detail: `${counts.clues} 条线索` },
    { view: "studio", label: "剧情编排图谱", detail: `${counts.scenes} 场景 · ${counts.chapters} 章节` }
  ];
  return cards.map((card) =>
    `<button type="button" class="workspace-action-card" data-go="${escapeHtml(card.view)}"><strong>${escapeHtml(card.label)}</strong><span>${escapeHtml(card.detail)}</span></button>`
  ).join("");
}

function sourceMetaHtml(meta) {
  if (!meta) return `<p class="muted-note">尚无导入快照。请通过「上传开本包」或工具箱「文档解析」完成导入。</p>`;
  const facts = [
    meta.filename ? `文件 ${meta.filename}` : "",
    meta.importedAt ? `导入 ${new Date(meta.importedAt).toLocaleString()}` : "",
    meta.characterCount ? `${meta.characterCount} 字符` : ""
  ].filter(Boolean).join(" · ");
  return `<p class="muted-note">${escapeHtml(facts)}</p>
    <p class="muted-note">来源稿为导入时快照，修改拆稿模块不会自动覆盖此处正文。</p>`;
}

export function renderImportSourceHub() {
  const studio = studioStore.get().cloudStudio;
  const snapshot = studio?.world?.settings?.importSource;
  const body = String(snapshot?.body || "");
  const preview = body.slice(0, 24000);
  return `<section class="import-source-hub">
    <header class="writer-hero compact"><div>
      <p class="section-kicker">IMPORT · MODULES</p>
      <h2>来源稿与已拆模块</h2>
      <p>左侧保留完整导入快照；右侧跳转到各结构化模块继续编辑。</p>
    </div>
    <button type="button" class="secondary-btn" data-action="import-source-refresh">刷新</button></header>
    <div class="import-source-grid">
      <article class="card import-source-panel">
        <div class="section-head"><div><h3>来源稿（只读快照）</h3></div></div>
        ${sourceMetaHtml(snapshot)}
        <pre class="import-source-body">${escapeHtml(preview || "（空）")}${body.length > preview.length ? "\n…" : ""}</pre>
      </article>
      <article class="card import-modules-panel">
        <div class="section-head"><div><h3>已拆模块</h3><p>从各工作台继续校对、联动与发布。</p></div></div>
        <div class="workspace-action-grid">${moduleLinksHtml(studio)}</div>
        <div class="row" style="margin-top:12px">
          <button type="button" class="secondary-btn" data-action="writer-document-open">重新上传 / 追加导入</button>
        </div>
      </article>
    </div>
  </section>`;
}

export async function refreshImportSourceHub() {
  try {
    await loadCloudData();
    const payload = await zhimuApi.getImportSource();
    if (payload?.importSource) {
      const studio = studioStore.get().cloudStudio;
      if (studio?.world) {
        studio.world.settings = {
          ...(studio.world.settings || {}),
          importSource: payload.importSource
        };
        studioStore.set({ cloudStudio: studio });
      }
    }
    render();
  } catch (error) {
    showError(error);
  }
}

export function importSource() {
  return renderImportSourceHub();
}

registerView("importSource", { importSource, refreshImportSourceHub });
