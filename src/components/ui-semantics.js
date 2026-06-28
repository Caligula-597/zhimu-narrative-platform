/** Shared UI semantics: status copy, chips, toast/error wrappers, and surface tokens. */
import { showToast } from "./toast.js";
(function (window) {
  const escapeHtml = window.zhimuFormat?.escapeHtml || ((value = "") => String(value));

  const SURFACES = {
    creator: { label: "创作者端", className: "surface-creator", accent: "var(--green)" },
    host: { label: "主持端", className: "surface-host", accent: "var(--gold)" },
    player: { label: "玩家端", className: "surface-player", accent: "#587f79" }
  };

  const STATUS = {
    room: {
      active: { label: "运行中", tone: "published" },
      ready: { label: "已建立", tone: "testing" },
      empty: { label: "未建立", tone: "draft" },
      polling: { label: "轮询中", tone: "testing" },
      connected: { label: "实时连接", tone: "published" }
    },
    player: {
      joined: { label: "已加入", tone: "published" },
      waiting: { label: "等待中", tone: "testing" },
      stuck: { label: "疑似卡关", tone: "testing" },
      offline: { label: "未加入", tone: "draft" },
      complete: { label: "已完成", tone: "published" }
    },
    clue: {
      public: { label: "公开", tone: "published" },
      private: { label: "私密", tone: "draft" },
      shared: { label: "已分享", tone: "testing" },
      unread: { label: "未读", tone: "draft" },
      read: { label: "已读", tone: "testing" },
      key: { label: "关键线索", tone: "published" },
      incomplete: { label: "待补全", tone: "draft" }
    }
  };

  function surface(name = "creator") {
    return SURFACES[name] || SURFACES.creator;
  }

  function status(kind, key, fallback = {}) {
    return STATUS[kind]?.[key] || { label: fallback.label || key || "未知", tone: fallback.tone || "draft" };
  }

  function chip(kind, key, fallback) {
    const item = status(kind, key, fallback);
    return `<span class="status-chip ${escapeHtml(item.tone)}">${escapeHtml(item.label)}</span>`;
  }

  function showError(error, fallback = "操作失败，请稍后重试") {
    const message = window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback;
    showToast(message);
    return message;
  }

  function showSuccess(message) {
    showToast(message);
    return message;
  }

  async function apiCall(fn, {
    success = "",
    error = "操作失败，请稍后重试",
    finally: onFinally
  } = {}) {
    try {
      const result = await fn();
      if (success) showSuccess(typeof success === "function" ? success(result) : success);
      return result;
    } catch (err) {
      showError(err, typeof error === "function" ? error(err) : error);
      throw err;
    } finally {
      onFinally?.();
    }
  }

  window.zhimuUiSemantics = { SURFACES, STATUS, surface, status, chip, showError, showSuccess, apiCall };
})(window);
export {};
