const GUEST_ALLOWED_VIEWS = new Set(["creatorCockpit"]);

const DYNAMIC_MODULE_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i
];

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
