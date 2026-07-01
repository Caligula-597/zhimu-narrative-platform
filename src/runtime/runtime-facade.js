/** Centralized runtime shell registry. */
const runtimeRegistry = {};

export function registerRuntime(api = {}) {
  Object.assign(runtimeRegistry, api);
  return runtimeRegistry;
}

export function getRuntime() {
  return runtimeRegistry;
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
