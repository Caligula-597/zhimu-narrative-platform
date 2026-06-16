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

  function formatClueDeleteRefs(refs) {
    const parts = [];
    if (refs.edgeCount) parts.push(`${refs.edgeCount} 条剧情连线`);
    if (refs.clueGrantCount) parts.push(`${refs.clueGrantCount} 个调查点会停止发放此线索`);
    if (refs.ruleReferenceCount) parts.push(`${refs.ruleReferenceCount} 条规则仍引用此线索`);
    return parts.length ? `<p>检测到 ${parts.join("、")}。删除后运行房可能受影响。</p>` : "";
  }

  function toggleCluesSelection(clueId, checked) {
    const set = new Set(state.cluesBulkSelection || []);
    if (checked) set.add(clueId);
    else set.delete(clueId);
    state.cluesBulkSelection = [...set];
    render();
  }

  function syncCluesSelectAll(checked, visibleIds) {
    state.cluesBulkSelection = checked ? [...visibleIds] : [];
    render();
  }

  async function confirmDeleteClue(clueId) {
    const data = state.cloudStudio;
    const clue = data?.clues?.find((item) => item.id === clueId);
    if (!clue) return showToast("线索不存在或已删除");
    try {
      const refs = await zhimuApi.getStudioNodeReferences("clue", clueId);
      studioModal(
        "确认删除线索",
        `${formatClueDeleteRefs(refs)}<p>删除后无法恢复；已入房玩家若曾获得此线索，相关记录也会一并清除。</p><div class="rule-block"><strong>${escapeHtml(clue.name)}</strong></div>`,
        "确认删除",
        async () => {
          try {
            await zhimuApi.deleteStudioNode("clue", clueId);
            state.cluesBulkSelection = (state.cluesBulkSelection || []).filter((id) => id !== clueId);
            if (state.cluesSelectedId === clueId) state.cluesSelectedId = null;
            closeModal();
            await loadCloudData();
            showToast("线索已删除");
          } catch (error) {
            showToast(error.message);
          }
        }
      );
    } catch (error) {
      showToast(error.message);
    }
  }

  async function batchDeleteClues() {
    const ids = state.cluesBulkSelection || [];
    if (!ids.length) return showToast("请先勾选要删除的线索");
    const data = state.cloudStudio;
    const names = ids.map((id) => data?.clues?.find((item) => item.id === id)?.name || "未命名线索");
    studioModal(
      `确认删除 ${ids.length} 条线索`,
      `<p>以下线索将被永久删除，且无法恢复：</p><ul class="clues-delete-list">${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul><p>关联的剧情连线会一并移除；调查点将不再发放这些线索。</p>`,
      "确认删除",
      async () => {
        try {
          for (const clueId of ids) {
            await zhimuApi.deleteStudioNode("clue", clueId);
          }
          state.cluesBulkSelection = [];
          if (state.cluesSelectedId && ids.includes(state.cluesSelectedId)) state.cluesSelectedId = null;
          closeModal();
          await loadCloudData();
          showToast(`已删除 ${ids.length} 条线索`);
        } catch (error) {
          showToast(error.message);
        }
      }
    );
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
    const bulkSelected = new Set(state.cluesBulkSelection || []);
    const visibleIds = list.map((clue) => clue.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => bulkSelected.has(id));
    const bulkToolbar = list.length
      ? `<div class="row clues-bulk-toolbar"><label class="check-label"><input type="checkbox" data-action="clues-select-all" ${allVisibleSelected ? "checked" : ""}><span>全选当前列表 (${list.length})</span></label><button class="danger-btn" data-action="clues-batch-delete" ${bulkSelected.size ? "" : "disabled"}>删除所选 (${bulkSelected.size || 0})</button></div>`
      : "";
    return `${catalogExperienceBanner(data.world)}<section class="clues-page"><div class="section-head"><div><p class="section-kicker">CLUE LIBRARY</p><h2>线索管理</h2><p>共 ${data.clues.length} 条线索 · 勾选后可批量删除测试线索</p></div><div class="row"><button class="secondary-btn" data-go="studio">打开编排图谱</button><button class="primary-btn" data-action="clues-add">＋ 新建线索</button></div></div>
    <div class="search-box clues-search"><span>⌕</span><input id="clues-search-input" class="field" placeholder="搜索线索名称或正文…" value="${escapeHtml(q)}"></div>
    ${bulkToolbar}
    ${list.length ? `<div class="clues-table">${list
      .map((clue) => {
        const points = cluePointCount(clue.id, data);
        const selected = selectedId === clue.id ? " clues-row-selected search-highlight" : "";
        const checked = bulkSelected.has(clue.id) ? " checked" : "";
        return `<article class="clues-row${selected}" data-clue-row="${clue.id}"><label class="clues-row-select check-label"><input type="checkbox" data-action="clues-toggle-select" data-clue="${clue.id}"${checked}></label><div class="clues-row-main"><div class="clues-row-head"><strong>${highlightQuery(clue.name, q)}</strong><span class="status-chip ${clue.visibility === "public" ? "published" : "draft"}">${VISIBILITY_LABELS[clue.visibility] || clue.visibility || "私密"}</span>${points ? `<span class="cloud-pill">${points} 个调查点</span>` : ""}</div><p>${highlightQuery((clue.public_text || "").slice(0, 160), q)}${(clue.public_text || "").length > 160 ? "…" : ""}</p></div><div class="row clues-row-actions"><button class="text-btn" data-action="clues-edit" data-clue="${clue.id}">编辑</button><button class="text-btn" data-action="clues-open-studio" data-clue="${clue.id}">在图谱中定位</button><button class="text-btn danger-text" data-action="clues-delete" data-clue="${clue.id}">删除</button></div></article>`;
      })
      .join("")}</div>` : (q ? `<div class="empty-state">没有匹配「${escapeHtml(q)}」的线索。</div>` : `<div class="empty-state enriched-empty"><p><strong>尚未创建线索</strong></p><p>线索是玩家调查与规则推进的核心。空列表不代表功能未完成——可在编排图谱批量创建，或在此快速新建。</p><ul class="empty-hints"><li>编排台：筛选「线索」节点 → 拖拽创建并连线到场景/调查点</li><li>调查点完成可自动发放线索；规则页可配置「拥有线索 → 开放场景」</li></ul><div class="row"><button class="primary-btn" data-action="clues-add">＋ 新建线索</button><button class="secondary-btn" data-go="studio">打开编排图谱</button><button class="text-btn" data-action="open-creator-guide">阅读线索说明</button></div></div>`)}
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
        ], clue?.visibility || "role") +
        studioSelect("线索类型", "clueType", [
          { id: "text", name: "文字" },
          { id: "image", name: "图片" },
          { id: "file", name: "文件" },
          { id: "audio", name: "音频" }
        ], meta.clueType || "text") +
        studioSelect("关联资产", "assetId", assets, meta.assetId || "") +
        studioSelect("重要程度", "importance", [
          { id: "normal", name: "普通" },
          { id: "key", name: "关键" },
          { id: "red_herring", name: "烟雾弹" }
        ], meta.importance || "normal"),
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
  viewExports.confirmDeleteClue = confirmDeleteClue;
  viewExports.batchDeleteClues = batchDeleteClues;
  viewExports.toggleCluesSelection = toggleCluesSelection;
  viewExports.syncCluesSelectAll = syncCluesSelectAll;
})(window);
export {};
