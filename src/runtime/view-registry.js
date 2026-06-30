/** Lazy view registry: keeps view exports discoverable without forcing static imports. */
const registry = new Map();

export function registerView(namespace, exports) {
  registry.set(namespace, exports || {});
  return registry.get(namespace);
}

export function getView(namespace) {
  return registry.get(namespace) || {};
}

export function hasView(namespace) {
  return registry.has(namespace);
}

export function callView(namespace, method, ...args) {
  const fn = getView(namespace)?.[method];
  if (typeof fn !== "function") return undefined;
  return fn(...args);
}

export function viewRegistrySnapshot() {
  return Object.fromEntries(registry.entries());
}

window.zhimuViewRegistry = { registerView, getView, hasView, callView, viewRegistrySnapshot };
