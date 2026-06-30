/**
 * DOM references — migrated to real ES Modules.
 * Exports element refs for app modules; window.zhimuDom bridge remains for startup guards and external diagnostics.
 */
const content = document.querySelector("#content");
const toast = document.querySelector("#toast");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modal = document.querySelector("#modal");
const previousDomBridge = window.zhimuDom || {};

const byId = (id, fallback) => document.querySelector(id) || fallback || null;

export function getContent() { return byId("#content", content); }
export function getToast() { return byId("#toast", toast || previousDomBridge.toast); }
export function getModalBackdrop() { return byId("#modal-backdrop", modalBackdrop); }
export function getModal() { return byId("#modal", modal); }

export { content, toast, modalBackdrop, modal };

/** Bridge: startup guard and diagnostic scripts still read window.zhimuDom. */
window.zhimuDom = {
  get content() { return getContent(); },
  get toast() { return getToast(); },
  get modalBackdrop() { return getModalBackdrop(); },
  get modal() { return getModal(); }
};
