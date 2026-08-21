/** Move screen-reader and keyboard context only when the SPA route changes. */
export function createNavigationFocusManager({
  documentRef = globalThis.document,
  mainSelector = "main",
  headingSelector = "h1, h2",
} = {}) {
  let previousRoute = null;

  function afterRender(route) {
    const nextRoute = String(route || "");
    if (previousRoute == null) {
      previousRoute = nextRoute;
      return false;
    }
    if (!nextRoute || nextRoute === previousRoute) return false;
    previousRoute = nextRoute;
    if (documentRef?.querySelector?.('[role="dialog"][aria-modal="true"]')) return false;
    const main = documentRef?.querySelector?.(mainSelector);
    const target = main?.querySelector?.(headingSelector) || main;
    if (!target?.focus) return false;
    if (!target.hasAttribute?.("tabindex")) target.setAttribute?.("tabindex", "-1");
    target.focus({ preventScroll: false });
    return true;
  }

  return { afterRender };
}
