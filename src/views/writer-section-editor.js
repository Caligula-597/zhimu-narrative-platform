import { escapeHtml } from "../utils/format.js";

function optionRows(options, selectedId) {
  const selected = selectedId == null ? "" : String(selectedId);
  return options.map((option) => {
    const id = String(option.id ?? "");
    const label = option.name || option.title || "";
    return `<option value="${escapeHtml(id)}"${id === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function sectionOutlineHtml(sections, activeSectionId, roleId) {
  const rows = sections.map((item) => {
    const active = item.id === activeSectionId;
    const summary = String(item.body || "").replace(/\s+/g, " ").trim().slice(0, 34) || "尚未填写正文";
    return `<button type="button" class="writer-focus-outline-item${active ? " active" : ""}" data-action="writer-editor-switch" data-role="${escapeHtml(roleId)}" data-section="${escapeHtml(item.id)}"${active ? ' aria-current="page"' : ""}>
      <strong>${escapeHtml(`${item.sequence}. ${item.title}`)}</strong>
      <span>${escapeHtml(summary)}</span>
    </button>`;
  }).join("");
  return rows || '<p class="writer-focus-outline-empty">这个角色还没有私人分幕。</p>';
}

export function writerSectionEditorHtml({ data, role, section, draft, saveState }) {
  const sections = data.sections
    .filter((item) => item.role_slot_id === role.id)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const chapters = [{ id: "", name: "暂不绑定公共章节" }, ...data.chapters];
  const statuses = [
    { id: "draft", name: "草稿 · 仅创作者可见" },
    { id: "testing", name: "测试中 · 测试房可见" },
    { id: "published", name: "已发布 · 正式房可见" }
  ];
  const modeLabel = section ? `第 ${section.sequence} 幕` : "新增分幕";
  const activeSectionId = section?.id || "";
  const worldName = data.world?.name || "当前剧本";

  return `<section class="writer-focus-shell" data-writer-section-editor data-role="${escapeHtml(role.id)}" data-section="${escapeHtml(activeSectionId)}">
    <header class="writer-focus-header">
      <button type="button" class="writer-focus-back" data-action="writer-editor-close">返回角色工作台</button>
      <nav class="writer-focus-breadcrumb" aria-label="编辑位置">
        <span>${escapeHtml(worldName)}</span><span>角色私人剧本</span><span>${escapeHtml(role.name)}</span><strong>${escapeHtml(modeLabel)}</strong>
      </nav>
      <div class="writer-focus-header-actions">
        <span class="writer-focus-count" data-word-count>${String(draft.body || "").length} 字</span>
        <span class="writer-focus-save-state" data-editor-state>${escapeHtml(saveState)}</span>
        <button type="button" class="secondary-btn" data-action="creator-preview" data-role="${escapeHtml(role.id)}">玩家视角预览</button>
        <button type="button" class="primary-btn" data-action="writer-editor-save">${section ? "保存并返回" : "写入云端"}</button>
      </div>
    </header>

    <div class="writer-focus-workspace">
      <aside class="writer-focus-outline" aria-label="${escapeHtml(role.name)}分幕目录">
        <div class="writer-focus-outline-head">
          <div><span>当前角色</span><strong>${escapeHtml(role.name)}</strong></div>
          <button type="button" class="text-btn" data-action="creator-add-section" data-role="${escapeHtml(role.id)}">新增分幕</button>
        </div>
        <div class="writer-focus-outline-list">${sectionOutlineHtml(sections, activeSectionId, role.id)}</div>
        <p class="writer-focus-outline-note">切换已保存分幕前，当前修改会先自动写入云端。</p>
      </aside>

      <main class="writer-focus-main">
        <div class="writer-focus-paper">
          <div class="writer-focus-paper-toolbar">
            <label class="writer-focus-title-label" for="writer-focus-title">正在编辑 · ${escapeHtml(modeLabel)}</label>
            <div class="writer-focus-formatting" aria-label="Markdown 快捷格式">
              <button type="button" data-action="writer-editor-format" data-format="bold" aria-label="加粗"><b>B</b></button>
              <button type="button" data-action="writer-editor-format" data-format="italic" aria-label="斜体"><i>I</i></button>
              <button type="button" data-action="writer-editor-format" data-format="heading" aria-label="二级标题">H2</button>
              <button type="button" data-action="writer-editor-format" data-format="list" aria-label="无序列表">列表</button>
            </div>
          </div>
          <input class="writer-focus-title" id="writer-focus-title" data-studio-field="title" value="${escapeHtml(draft.title)}" placeholder="分幕标题" autocomplete="off">
          <textarea class="writer-focus-body" data-studio-field="body" aria-label="分幕正文" placeholder="在此撰写角色私人正文，支持 Markdown…" spellcheck="true">${escapeHtml(draft.body)}</textarea>
        </div>

        <div class="writer-focus-dock" aria-label="分幕设置与工具">
          <section class="writer-focus-tool">
            <h3>公共章节绑定</h3>
            <p>绑定后仍由发布状态和主持节奏决定玩家可见性。</p>
            <label for="writer-focus-chapter">公共章节</label>
            <select class="field" id="writer-focus-chapter" data-studio-field="chapterId">${optionRows(chapters, draft.chapterId)}</select>
          </section>
          <section class="writer-focus-tool">
            <h3>稿件状态</h3>
            <p>草稿不会进入玩家房间，测试中仅供测试房查看。</p>
            <label for="writer-focus-status">发布状态</label>
            <select class="field" id="writer-focus-status" data-studio-field="publicationStatus">${optionRows(statuses, draft.publicationStatus)}</select>
          </section>
          <section class="writer-focus-tool writer-focus-find">
            <h3>查找与替换</h3>
            <p>只处理当前分幕正文，不影响其他角色或章节。</p>
            <div class="writer-focus-find-fields">
              <input class="field" data-editor-search aria-label="搜索正文" placeholder="查找内容">
              <input class="field" data-editor-replace aria-label="替换正文" placeholder="替换为">
              <button type="button" class="secondary-btn" data-action="writer-editor-replace">全部替换</button>
            </div>
          </section>
          <section class="writer-focus-tool writer-focus-version">
            <h3>版本与保存</h3>
            <p>${section ? `云端分幕 · ${escapeHtml(section.id)}` : "保存后才会建立云端分幕与版本记录。"}</p>
            <div class="writer-focus-version-actions">
              ${section ? '<button type="button" class="danger-btn" data-action="writer-editor-delete">删除这一幕</button>' : '<button type="button" class="danger-btn" data-action="writer-editor-discard">放弃未提交草稿</button><span class="writer-focus-draft-note">返回工作台不会丢稿；需要切换角色时可在这里明确放弃。</span>'}
            </div>
          </section>
        </div>
      </main>
    </div>
  </section>`;
}
