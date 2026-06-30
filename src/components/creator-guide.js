/** Fetch and show in-app markdown guides for creators. */
import { modal, modalBackdrop } from "../dom.js";
(function (window) {
  const escapeHtml = window.zhimuFormat?.escapeHtml || ((v = "") => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

  function renderMarkdown(text) {
    const lines = String(text || "").split("\n");
    const html = [];
    let inList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        continue;
      }
      if (trimmed.startsWith("# ")) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push(`<h2>${escapeHtml(trimmed.slice(2))}</h2>`);
        continue;
      }
      if (trimmed.startsWith("## ")) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push(`<h3>${escapeHtml(trimmed.slice(3))}</h3>`);
        continue;
      }
      if (trimmed.startsWith("### ")) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push(`<h4>${escapeHtml(trimmed.slice(4))}</h4>`);
        continue;
      }
      if (trimmed.startsWith("- ")) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
        continue;
      }
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      if (trimmed.startsWith("|")) {
        html.push(`<p class="guide-table-line">${escapeHtml(trimmed)}</p>`);
        continue;
      }
      html.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
    if (inList) html.push("</ul>");
    return html.join("");
  }

  function looksLikeHtml(text) {
    const head = String(text || "").trimStart().slice(0, 64).toLowerCase();
    return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<head");
  }

  async function fetchGuide(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error("指引文档暂时无法加载，请确认前端服务已启动。");
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") || looksLikeHtml(text)) {
      throw new Error("指引文档未正确部署（返回了网页而非 Markdown）。请重新构建前端：npm run build");
    }
    return text;
  }

  async function openCreatorGuide() {
    const backdrop = modalBackdrop;
    const closeModal = window.zhimuModal?.closeModal;
    if (!modal || !backdrop) return;
    modal.className = "modal creator-guide-modal";
    modal.innerHTML = `<h2>创作指引</h2><div class="empty-state">正在加载…</div><div class="modal-actions"><button class="text-btn" data-open-first-session>如何跑第一场</button><button class="secondary-btn" data-close>关闭</button><button class="text-btn" data-open-error-guide>查看错误排查手册</button></div>`;
    backdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-open-first-session]").onclick = () => {
      closeModal();
      openFirstSessionGuide();
    };
    modal.querySelector("[data-open-error-guide]").onclick = () => {
      closeModal();
      openErrorGuide();
    };
    try {
      const text = await fetchGuide("/docs/CREATOR_GUIDE.md");
      const body = modal.querySelector(".empty-state");
      body.className = "creator-guide-body";
      body.innerHTML = renderMarkdown(text);
    } catch (error) {
      modal.querySelector(".empty-state").textContent = error.message;
    }
  }

  async function openErrorGuide() {
    const backdrop = modalBackdrop;
    const closeModal = window.zhimuModal?.closeModal;
    if (!modal || !backdrop) return;
    modal.className = "modal creator-guide-modal";
    modal.innerHTML = `<h2>错误提示与排查</h2><div class="empty-state">正在加载…</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="text-btn" data-open-creator-guide>返回创作指引</button></div>`;
    backdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-open-creator-guide]").onclick = () => {
      closeModal();
      openCreatorGuide();
    };
    try {
      const text = await fetchGuide("/docs/USER_ERROR_GUIDE.md");
      const body = modal.querySelector(".empty-state");
      body.className = "creator-guide-body";
      body.innerHTML = renderMarkdown(text);
    } catch (error) {
      modal.querySelector(".empty-state").textContent = error.message;
    }
  }

  async function openLegalDoc(docPath, title = "法律文档") {
    const backdrop = modalBackdrop;
    const closeModal = window.zhimuModal?.closeModal;
    if (!modal || !backdrop) return;
    modal.className = "modal creator-guide-modal legal-doc-modal";
    modal.innerHTML = `<h2>${escapeHtml(title)}</h2><div class="empty-state">正在加载…</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
    backdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    try {
      const text = await fetchGuide(`/docs/${String(docPath || "").replace(/^\//, "")}`);
      const body = modal.querySelector(".empty-state");
      body.className = "creator-guide-body";
      body.innerHTML = renderMarkdown(text);
    } catch (error) {
      modal.querySelector(".empty-state").textContent = error.message;
    }
  }

  async function openFirstSessionGuide() {
    const backdrop = modalBackdrop;
    const closeModal = window.zhimuModal?.closeModal;
    if (!modal || !backdrop) return;
    modal.className = "modal creator-guide-modal";
    modal.innerHTML = `<h2>如何跑第一场</h2><div class="empty-state">正在加载…</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="text-btn" data-open-creator-guide>详细创作指引</button></div>`;
    backdrop.classList.add("show");
    modal.querySelector("[data-close]").onclick = closeModal;
    modal.querySelector("[data-open-creator-guide]").onclick = () => {
      closeModal();
      openCreatorGuide();
    };
    try {
      const text = await fetchGuide("/docs/FIRST_SESSION_GUIDE_ZH.md");
      const body = modal.querySelector(".empty-state");
      body.className = "creator-guide-body";
      body.innerHTML = renderMarkdown(text);
    } catch (error) {
      modal.querySelector(".empty-state").textContent = error.message;
    }
  }

  window.zhimuGuide = { openCreatorGuide, openErrorGuide, openFirstSessionGuide, openLegalDoc, renderMarkdown, fetchGuide };
})(window);
export {};
