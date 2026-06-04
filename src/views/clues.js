/* Clue management — list, search, edit without opening the full studio canvas. */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const T = window.zhimuToast || {};
  const M = window.zhimuModal || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const catalogExperienceBanner = U.catalogExperienceBanner || (() => "");
  const studioField = M.studioField || (() => "");
  const studioSelect = M.studioSelect || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioModal = M.studioModal || (() => {});
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const go = window.zhimuGo;
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.clues = window.zhimuViews.clues || {};

  const VISIBILITY_LABELS = { role: "私密", public: "房间公开", host: "主持可见" };

  function cluePointCount(clueId, data) {
    return (data.investigationPoints || []).filter((point) => point.clue_id === clueId).length;
  }

  function highlightQuery(text, query) {
    const clean = String(text || "");
    if (!query) return escapeHtml(clean);
    const idx = clean.toLowerCase().indexOf(String(query).toLowerCase());
    if (idx < 0) return escapeHtml(clean);
    return `${escapeHtml(clean.slice(0, idx))}<mark class="search-mark">${escapeHtml(clean.slice(idx, idx + query.length))}</mark>${escapeHtml(clean.slice(idx + query.length))}`;
  }

  function clues() {
    const data = state.cloudStudio;
    if (!data) {
      return U.creatorWorkspaceEmpty?.({
        title: "线索管理",
        kicker: "CLUE LIBRARY",
        intro: "集中浏览与编辑当前世界的全部线索，无需打开剧情编排画布。",
        guideTitle: "线索库会提供什么",
        guideItems: [
          { label: "列表", title: "全量线索一览", text: "按名称搜索、查看可见性与关联调查点。", bullets: ["快速 PATCH 正文与主持提示", "一键跳转到编排图谱"] }
        ]
      }) || `<section class="card"><h3>尚未选择剧本</h3><p><button class="primary-btn" data-action="open-catalog">浏览公开剧本库</button></p></section>`;
    }
    const q = state.cluesSearchQuery || "";
    const selectedId = state.cluesSelectedId;
    let list = data.clues || [];
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter(
        (clue) =>
          clue.name.toLowerCase().includes(lower) ||
          String(clue.public_text || "").toLowerCase().includes(lower) ||
          String(clue.host_text || "").toLowerCase().includes(lower)
      );
    }
    return `${catalogExperienceBanner(data.world)}<section class="clues-page"><div class="section-head"><div><p class="section-kicker">CLUE LIBRARY</p><h2>线索管理</h2><p>共 ${data.clues.length} 条线索 · 在此维护名称、正文与默认可见性</p></div><div class="row"><button class="secondary-btn" data-go="studio">打开编排图谱</button><button class="primary-btn" data-action="clues-add">＋ 新建线索</button></div></div>
    <div class="search-box clues-search"><span>⌕</span><input id="clues-search-input" class="field" placeholder="搜索线索名称或正文…" value="${escapeHtml(q)}"></div>
    ${list.length ? `<div class="clues-table">${list
      .map((clue) => {
        const points = cluePointCount(clue.id, data);
        const selected = selectedId === clue.id ? " clues-row-selected search-highlight" : "";
        return `<article class="clues-row${selected}" data-clue-row="${clue.id}"><div class="clues-row-main"><div class="clues-row-head"><strong>${highlightQuery(clue.name, q)}</strong><span class="status-chip ${clue.visibility === "public" ? "published" : "draft"}">${VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密"}</span>${points ? `<span class="cloud-pill">${points} 个调查点</span>` : ""}</div><p>${highlightQuery((clue.public_text || "").slice(0, 160), q)}${(clue.public_text || "").length > 160 ? "…" : ""}</p></div><div class="row clues-row-actions"><button class="text-btn" data-action="clues-edit" data-clue="${clue.id}">编辑</button><button class="text-btn" data-action="clues-open-studio" data-clue="${clue.id}">在图谱中定位</button></div></article>`;
      })
      .join("")}</div>` : `<div class="empty-state">${q ? `没有匹配「${escapeHtml(q)}」的线索。` : "尚未创建线索。点击「新建线索」或在剧情编排中添加。"}</div>`}
    </section>`;
  }

  function bindCluesSearch() {
    const input = document.getElementById("clues-search-input");
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "1";
    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.cluesSearchQuery = input.value.trim();
        render();
        bindCluesSearch();
      }, 280);
    });
  }

  function openClueInStudio(clueId) {
    state.searchFocus = { view: "studio", type: "clue", id: clueId, nodeType: "clue" };
    go("studio");
  }

  function openCluesEditor(clueId = "") {
    const data = state.cloudStudio;
    if (!data) return showToast("请先选择剧本世界");
    const clue = clueId ? data.clues.find((item) => item.id === clueId) : null;
    const assets = [{ id: "", name: "不关联附件" }, ...(state.cloudAssets || []).map((asset) => ({ id: asset.id, name: asset.original_filename }))];
    const meta = clue?.metadata || {};
    studioModal(
      clue ? `编辑线索 · ${clue.name}` : "新建线索",
      studioField("线索名称", "name", "input", clue?.name || "") +
        studioField("获得后可见内容", "publicText", "textarea", clue?.public_text || "") +
        studioField("主持解释", "hostText", "textarea", clue?.host_text || "") +
        studioSelect("默认可见性", "visibility", [
          { id: "role", name: "私密 · 仅获得角色可见" },
          { id: "public", name: "房间公开" },
          { id: "host", name: "主持可见" }
        ]) +
        studioSelect("线索类型", "clueType", [
          { id: "text", name: "文字" },
          { id: "image", name: "图片" },
          { id: "file", name: "文件" },
          { id: "audio", name: "音频" }
        ]) +
        studioSelect("关联资产", "assetId", assets, meta.assetId || "") +
        studioSelect("重要程度", "importance", [
          { id: "normal", name: "普通" },
          { id: "key", name: "关键" },
          { id: "red_herring", name: "烟雾弹" }
        ]),
      clue ? "保存修改" : "写入云端",
      async () => {
        try {
          const values = studioValues();
          if (clue) {
            await zhimuApi.updateClue(clue.id, {
              name: values.name,
              publicText: values.publicText,
              hostText: values.hostText,
              visibility: values.visibility || "role",
              metadata: {
                clueType: values.clueType || "text",
                assetId: values.assetId || null,
                importance: values.importance || "normal"
              }
            });
          } else {
            await zhimuApi.createClue({
              name: values.name,
              publicText: values.publicText,
              hostText: values.hostText,
              visibility: values.visibility || "role",
              metadata: {
                clueType: values.clueType || "text",
                assetId: values.assetId || null,
                importance: values.importance || "normal"
              }
            });
          }
          closeModal();
          await loadCloudData();
          showToast(clue ? "线索已更新" : "线索已创建");
        } catch (error) {
          showToast(error.message);
        }
      }
    );
    if (clue) {
      modal.querySelector('[data-studio-field="visibility"]').value = clue.visibility || "role";
      modal.querySelector('[data-studio-field="clueType"]').value = meta.clueType || "text";
      modal.querySelector('[data-studio-field="importance"]').value = meta.importance || "normal";
    }
  }

  viewExports.clues = clues;
  viewExports.bindCluesSearch = bindCluesSearch;
  viewExports.openClueInStudio = openClueInStudio;
  viewExports.openCluesEditor = openCluesEditor;
})(window);
export {};
