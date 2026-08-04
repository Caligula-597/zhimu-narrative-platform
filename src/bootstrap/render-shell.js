import { error as renderError, loading as renderLoading } from "../components/status-ui.js";
import {
  isDynamicModuleLoadError,
  viewModuleErrorMessage
} from "../runtime/navigation-access.js";
import { setHtml } from "../../shared/safe-dom.js";

export function createContentRenderer(content, bindDynamic) {
  let lastContentHtml = "";
  return function setContentHtml(nextHtml) {
    if (lastContentHtml === nextHtml) return false;
    setHtml(content, nextHtml);
    lastContentHtml = nextHtml;
    bindDynamic();
    return true;
  };
}

export function renderViewLoading(title) {
  return renderLoading(title, "正在加载该功能模块，请稍候。", { kicker: "MODULE" });
}

export function renderStudioLoading(title) {
  return renderLoading(title, "正在按需读取完整创作数据，请稍候。", { kicker: "WORKSPACE" });
}

export function renderPageUpdated(title) {
  return renderLoading(
    title,
    "检测到网站刚刚更新，正在自动刷新并载入最新资源。",
    { kicker: "PAGE UPDATED" }
  );
}

export function renderViewError(title, error) {
  const staleModule = isDynamicModuleLoadError(error);
  const actions = staleModule
    ? `<button class="primary-btn" data-action="reload-app">刷新并继续</button><button class="secondary-btn" data-go="creatorCockpit">返回创作驾驶舱</button>`
    : `<button class="primary-btn" data-action="retry-view-module">重新加载</button><button class="secondary-btn" data-action="open-error-guide">错误排查手册</button>`;
  return renderError(title, viewModuleErrorMessage(error), {
    kicker: staleModule ? "PAGE UPDATED" : "MODULE ERROR",
    actions,
    fallback: "功能模块加载失败，请稍后重试。"
  });
}
