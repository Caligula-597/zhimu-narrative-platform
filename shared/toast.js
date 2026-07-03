/**
 * Shared toast timer + state toast helper (play / host pattern).
 */

/**
 * @param {number} [defaultMs=2200]
 */
export function createToastTimer(defaultMs = 2200) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;

  return {
    clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    /** @param {() => void} fn @param {number} [ms] */
    schedule(fn, ms = defaultMs) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, ms);
    }
  };
}

/**
 * DOM toast controller for main app (#toast element).
 * @param {() => HTMLElement|null} getElement
 * @param {number} [defaultMs=2200]
 */
export function createDomToastController(getElement, defaultMs = 2200) {
  const timer = createToastTimer(defaultMs);

  /**
   * @param {string} text
   * @param {number} [duration]
   */
  function show(text, duration = defaultMs) {
    const el = getElement();
    if (!el) return;
    el.className = "toast";
    el.textContent = text;
    el.classList.add("show");
    timer.schedule(() => el.classList.remove("show"), duration);
  }

  /**
   * @param {string} text
   * @param {{ actionLabel?: string, onAction?: () => void, duration?: number }} [opts]
   */
  function showWithAction(text, { actionLabel, onAction, duration = 6000 } = {}) {
    const el = getElement();
    if (!el) return;
    el.className = "toast toast-with-action";
    el.replaceChildren();
    const msg = document.createElement("span");
    msg.className = "toast-message";
    msg.textContent = text;
    el.appendChild(msg);
    if (actionLabel && typeof onAction === "function") {
      const btn = document.createElement("button");
      btn.className = "toast-action";
      btn.type = "button";
      btn.textContent = actionLabel;
      btn.onclick = () => {
        timer.clear();
        el.classList.remove("show");
        try {
          onAction();
        } catch {
          /* ignore */
        }
      };
      el.appendChild(btn);
    }
    const dismiss = document.createElement("button");
    dismiss.className = "toast-dismiss";
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "关闭");
    dismiss.textContent = "×";
    dismiss.onclick = () => {
      timer.clear();
      el.classList.remove("show");
    };
    el.appendChild(dismiss);
    el.classList.add("show");
    timer.schedule(() => el.classList.remove("show"), duration);
  }

  return { show, showWithAction, clear: () => timer.clear() };
}

/**
 * @param {string} message
 * @param {number} [durationMs=3200]
 */
export function renderToastHostHtml(message, durationMs = 3200) {
  if (!message) return "";
  return `<div class="toast-host" aria-live="polite" aria-atomic="true"><div class="toast show" role="status">${escapeToastText(message)}</div></div>`;
}

function escapeToastText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
