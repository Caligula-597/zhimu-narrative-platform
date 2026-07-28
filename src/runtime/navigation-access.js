const GUEST_ALLOWED_VIEWS = new Set(["creatorCockpit"]);

const DYNAMIC_MODULE_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i
];
const DYNAMIC_MODULE_RELOAD_KEY = "zhimuDynamicModuleReload";
const DYNAMIC_MODULE_RELOAD_WINDOW_MS = 10 * 60 * 1000;

export function navigationAccess(view, {
  authenticated = false,
  authStatus = ""
} = {}) {
  if (GUEST_ALLOWED_VIEWS.has(view)) return "allowed";
  if (authenticated) return "allowed";
  if (authStatus === "checking") return "checking";
  return "authentication-required";
}

export function isDynamicModuleLoadError(error) {
  const message = String(error?.message || error || "");
  return DYNAMIC_MODULE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function viewModuleErrorMessage(error) {
  if (isDynamicModuleLoadError(error)) {
    return "页面刚刚完成更新，当前标签页仍在使用旧版静态资源。请刷新页面后重新打开该功能。";
  }
  return error;
}

export function claimDynamicModuleReload(error, {
  storage = globalThis.sessionStorage,
  now = Date.now()
} = {}) {
  if (!isDynamicModuleLoadError(error) || !storage?.getItem || !storage?.setItem) return false;
  const signature = String(error?.message || error || "dynamic-module-load-error");
  try {
    const previous = JSON.parse(storage.getItem(DYNAMIC_MODULE_RELOAD_KEY) || "null");
    if (
      previous?.signature === signature
      && Number.isFinite(previous?.at)
      && now - previous.at < DYNAMIC_MODULE_RELOAD_WINDOW_MS
    ) {
      return false;
    }
    storage.setItem(DYNAMIC_MODULE_RELOAD_KEY, JSON.stringify({ signature, at: now }));
    return true;
  } catch {
    return false;
  }
}
