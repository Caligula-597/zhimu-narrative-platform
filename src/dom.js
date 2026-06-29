/**
 * DOM references — migrated to real ES Modules.
 * Exports element refs for new code; window.zhimuDom bridge kept for un-migrated views.
 */
const content = document.querySelector("#content");
const toast = document.querySelector("#toast");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modal = document.querySelector("#modal");

export { content, toast, modalBackdrop, modal };

/** Bridge: un-migrated views still read window.zhimuDom. */
window.zhimuDom = { content, toast, modalBackdrop, modal };
