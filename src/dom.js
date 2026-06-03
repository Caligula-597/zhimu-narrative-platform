(function (window) {
  window.zhimuDom = {
    content: document.querySelector("#content"),
    toast: document.querySelector("#toast"),
    modalBackdrop: document.querySelector("#modal-backdrop"),
    modal: document.querySelector("#modal")
  };
  /** Deferred render — app.js registers zhimuRuntime.render after view modules load. */
  window.zhimuRender = function () {
    const fn = window.zhimuRuntime?.render;
    if (typeof fn === "function") fn();
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
})(window);
