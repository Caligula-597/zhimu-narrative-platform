/** View-level code splitting. Product modules own deliberately disjoint manifests. */
import { PRODUCT_VIEW_MODULES } from "../products/product-registry.js";
import { SHARED_INFRASTRUCTURE_VIEW_MODULES } from "../products/shared-infrastructure/view-manifest.js";

(function (window) {
  const loaded = new Set();
  const loading = new Map();

  const modulesByView = {
    ...PRODUCT_VIEW_MODULES,
    ...SHARED_INFRASTRUCTURE_VIEW_MODULES
  };

  async function loadModuleList(view, modules) {
    await Promise.all(modules.map((loadModule) => loadModule()));
    loaded.add(view);
  }

  function ensureViewModules(view) {
    if (loaded.has(view)) return Promise.resolve();
    const modules = modulesByView[view] || [];
    if (!modules.length) {
      loaded.add(view);
      return Promise.resolve();
    }
    if (!loading.has(view)) {
      loading.set(view, loadModuleList(view, modules).finally(() => loading.delete(view)));
    }
    return loading.get(view);
  }

  function isViewReady(view) {
    return loaded.has(view);
  }

  window.zhimuViewLoader = { ensureViewModules, isViewReady };
})(window);
export {};
