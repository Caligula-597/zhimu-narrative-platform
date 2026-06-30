/** Centralized access to the remaining runtime shell adapter. */
export function getRuntime() {
  return window.zhimuRuntime || {};
}

export function callRuntime(method, ...args) {
  const fn = getRuntime()?.[method];
  if (typeof fn !== "function") return undefined;
  return fn(...args);
}

export function go(view) {
  return callRuntime("go", view);
}

export function render() {
  return callRuntime("render");
}

export function loadCloudData(...args) {
  return callRuntime("loadCloudData", ...args);
}
