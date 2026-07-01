/** Startup guard for shell dependencies. */
import { getContent, getModalBackdrop } from "../dom.js";

const requiredAppGlobals = [
  "zhimuFormat",
  "zhimuUserMessages"
];

function hasPath(path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), window) != null;
}

function missingGlobals(paths = requiredAppGlobals) {
  return paths.filter((path) => !hasPath(path));
}

function renderMissingGlobals(missing, target = getContent()) {
  const details = missing.map((name) => `Missing ${name}`);
  const fallback = `<section class="unified-state unified-state-error">
    <h3>页面初始化失败</h3>
    <p>关键模块未加载完整，请刷新页面或检查脚本发布顺序。</p>
    <ul class="unified-state-details">${details.map((item) => `<li>${item}</li>`).join("")}</ul>
  </section>`;
  const html = window.zhimuStatus?.renderState?.({
    tone: "error",
    title: "页面初始化失败",
    message: "关键模块未加载完整，请刷新页面或检查脚本发布顺序。",
    details
  }) || fallback;
  if (target) {
    target.innerHTML = html;
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
