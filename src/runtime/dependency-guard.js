/** Startup guard for shell dependencies. */
import { getContent, getModalBackdrop } from "../dom.js";
import { renderState } from "../components/status-ui.js";
import { setHtml } from "../../shared/safe-dom.js";

const requiredAppGlobals = [];

function hasPath(path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), window) != null;
}

function missingGlobals(paths = requiredAppGlobals) {
  return paths.filter((path) => !hasPath(path));
}

function renderMissingGlobals(missing, target = getContent()) {
  const details = missing.map((name) => `Missing ${name}`);
  const html = renderState({
    tone: "error",
    title: "页面初始化失败",
    message: "关键模块未加载完整，请刷新页面或检查脚本发布顺序。",
    details
  });
  if (target) {
    setHtml(target, html);
  } else {
    window.console?.error?.("Zhimu startup dependencies missing:", missing);
  }
  return html;
}

function assertAppReady() {
  const missing = missingGlobals();
  if (!getContent()) missing.push("dom.content");
  if (!getModalBackdrop()) missing.push("dom.modalBackdrop");
  if (missing.length) renderMissingGlobals(missing);
  return missing;
}

window.zhimuDependencyGuard = { requiredAppGlobals, missingGlobals, renderMissingGlobals, assertAppReady };

export { requiredAppGlobals, missingGlobals, renderMissingGlobals, assertAppReady };
