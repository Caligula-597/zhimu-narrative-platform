/** Global world search — unified API surface, single modal entry from topbar. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
(function (window) {
  const { modal, modalBackdrop } = window.zhimuDom;
  const escapeHtml = window.zhimuFormat?.escapeHtml || ((v = "") => String(v));
  const closeModal = window.zhimuModal?.closeModal || (() => {});
  const go = window.zhimuGo;
  const Status = () => window.zhimuStatus || {};

  const TYPE_LABELS = {
    role: "角色",
    section: "分幕",
    scene: "场景",
    clue: "线索",
    investigation_point: "调查点",
    rule: "规则",
    item: "物品"
  };

  function highlightText(text, query) {
    const clean = String(text || "");
    if (!query) return escapeHtml(clean);
    const lower = clean.toLowerCase();
    const q = String(query).toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return escapeHtml(clean);
    return `${escapeHtml(clean.slice(0, idx))}<mark class="search-mark">${escapeHtml(clean.slice(idx, idx + query.length))}</mark>${escapeHtml(clean.slice(idx + query.length))}`;
  }

  let searchTimer = null;

  function openGlobalSearch() {
    if (!zhimuApi.context.worldId) {
      showToast("请先选择或创建一个剧本世界");
      return;
    }
    modal.className = "modal global-search-modal";
    modal.innerHTML = `<h2>搜索当前世界</h2><p class="wizard-intro">检索角色、分幕、场景、线索、调查点、规则与物品。结果来自 PostgreSQL 全文索引与模糊匹配。</p><div class="search-box global-search-input"><span>⌕</span><input id="global-search-input" class="field" placeholder="输入关键词，例如：角色名、场景、线索标题…" autofocus></div><div id="global-search-results">${Status().empty?.("输入关键词开始搜索", "输入至少 1 个字符开始搜索。", { compact: true }) || `<div class="empty-state">输入至少 1 个字符开始搜索。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
    modalBackdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;

    const input = modal.querySelector("#global-search-input");
    const resultsEl = modal.querySelector("#global-search-results");

    const runSearch = async () => {
      const q = input.value.trim();
      if (!q) {
        resultsEl.innerHTML = Status().empty?.("输入关键词开始搜索", "输入至少 1 个字符开始搜索。", { compact: true }) || `<div class="empty-state">输入至少 1 个字符开始搜索。</div>`;
        return;
      }
      resultsEl.innerHTML = Status().loading?.("正在搜索", "正在检索当前世界内容…", { compact: true }) || `<div class="empty-state">正在搜索…</div>`;
      try {
        const payload = await zhimuApi.searchWorld(q, { limit: 40 });
        const labels = payload.typeLabels || TYPE_LABELS;
        if (!payload.results?.length) {
          resultsEl.innerHTML = Status().empty?.("没有匹配结果", `没有匹配「${q}」的内容。试试更短的关键词或到各页面浏览列表。`, { compact: true }) || `<div class="empty-state">没有匹配「${escapeHtml(q)}」的内容。试试更短的关键词或到各页面浏览列表。</div>`;
          return;
        }
        const queryTerm = payload.query || q;
        resultsEl.innerHTML = `<p class="muted-note" style="margin-bottom:10px">共 ${payload.total} 条结果</p><div class="global-search-list">${payload.results
          .map(
            (row) => `<button type="button" class="global-search-row" data-search-go="${escapeHtml(row.view)}" data-search-type="${escapeHtml(row.type)}" data-search-id="${escapeHtml(row.id)}" data-search-title="${escapeHtml(row.title)}" data-search-query="${escapeHtml(queryTerm)}"><span class="cloud-pill">${escapeHtml(labels[row.type] || row.type)}</span><strong>${highlightText(row.title, queryTerm)}</strong><p>${highlightText(row.snippet || "无摘要", queryTerm)}</p></button>`
          )
          .join("")}</div>`;
        resultsEl.querySelectorAll("[data-search-go]").forEach((btn) => {
          btn.onclick = () => {
            const targetView = btn.dataset.searchGo;
            window.zhimuState.searchFocus = {
              view: targetView,
              type: btn.dataset.searchType,
              id: btn.dataset.searchId,
              query: btn.dataset.searchQuery,
              nodeType: btn.dataset.searchType === "investigation_point" ? "investigation_point" : btn.dataset.searchType
            };
            closeModal();
            go(targetView);
            showToast(`已跳转到「${btn.dataset.searchTitle}」`);
          };
        });
      } catch (error) {
        resultsEl.innerHTML = Status().error?.("搜索失败", error, { compact: true, fallback: "搜索暂时不可用，请稍后重试。" }) || `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      }
    };

    input.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 320);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        clearTimeout(searchTimer);
        runSearch();
      }
    });
  }

  window.zhimuGlobalSearch = { openGlobalSearch };
})(window);
export {};
