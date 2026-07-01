/**
 * DOM references — migrated to real ES Modules.
 * Exports element refs for app modules; no legacy DOM window bridge is exposed.
 */
const content = document.querySelector("#content");
const toast = document.querySelector("#toast");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modal = document.querySelector("#modal");
const byId = (id, fallback) => document.querySelector(id) || fallback || null;

export function getContent() { return byId("#content", content); }
export function getToast() { return byId("#toast", toast); }
export function getModalBackdrop() { return byId("#modal-backdrop", modalBackdrop); }
export function getModal() { return byId("#modal", modal); }

export { content, toast, modalBackdrop, modal };
