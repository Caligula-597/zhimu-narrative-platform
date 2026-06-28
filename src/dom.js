/**
 * DOM references — migrated to real ES Modules.
 * Exports element refs for new code; window.zhimuDom bridge kept for un-migrated views.
 * Deferred render/go/handle bridges kept until app.js migrates (it loads last).
 */
const content = document.querySelector("#content");
const toast = document.querySelector("#toast");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modal = document.querySelector("#modal");

export { content, toast, modalBackdrop, modal };

/** Deferred render — app.js registers zhimuRuntime.render after view modules load. */
window.zhimuRender = function () {
  const fn = window.zhimuRuntime?.render;
  if (typeof fn === "function") fn();
};
/** Route at call time — split modules load before app.js defines zhimuRuntime.go. */
window.zhimuGo = function (view) {
  const fn = window.zhimuRuntime?.go;
  if (typeof fn === "function") fn(view);
};
window.zhimuLoadCloudData = function (...args) {
  const fn = window.zhimuRuntime?.loadCloudData;
  return fn ? fn(...args) : Promise.resolve();
};
window.zhimuHandle = function (action, el) {
  const fn = window.zhimuRuntime?.handle;
  if (typeof fn === "function") return fn(action, el);
};
window.zhimuClearRuntimeState = function () {
  const fn = window.zhimuRuntime?.clearRuntimeState;
  if (typeof fn === "function") fn();
};

/** Bridge: un-migrated views still read window.zhimuDom. */
window.zhimuDom = { content, toast, modalBackdrop, modal };
