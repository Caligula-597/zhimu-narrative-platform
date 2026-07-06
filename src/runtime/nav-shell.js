/** Sidebar advanced nav expand/collapse + world switcher labels. */
import * as zhimuApi from "../api/index.js";
import { uiStore, userStore, studioStore, worldStore } from "../state/index.js";
(function (window) {
  const ADVANCED_VIEWS = ["writer", "studio", "clues", "rules", "miniGames", "archive"];

  function worldSwitcherFailureLabel(apiError) {
    const err = apiError || "";
    if (/Authentication|401|登录|Email or password/i.test(err)) return "登录已失效";
    if (/permission|403|权限/i.test(err)) return "无权访问该剧本";
    if (/fetch|超时|Failed|network|Network|ECONNREFUSED/i.test(err)) return "无法连接后端";
    return "剧本加载失败";
  }

  function syncWorldSwitcher() {
    const { apiError } = userStore.get();
    const { cloudStudio, cloudLoading } = studioStore.get();
    const { cloudWorlds } = worldStore.get();
    const icon = document.querySelector(".world-switcher .world-icon");
    const strong = document.querySelector(".world-switcher strong");
    const small = document.querySelector(".world-switcher small");
    if (!icon || !strong || !small) return;
    const studioWorld = cloudStudio?.world;
    const listedWorld = (cloudWorlds || []).find((world) => world.id === zhimuApi.context.worldId);
    const worldName = studioWorld?.name || listedWorld?.name;
    const bootstrapping = cloudLoading;

    if (bootstrapping) {
      icon.textContent = "…";
      strong.textContent = "正在连接云端…";
      small.textContent = worldName ? `读取「${worldName}」` : "读取剧本工作区";
      return;
    }
    if (!worldName) {
      icon.textContent = "云";
      const emptyAccount = apiError && /还没有可访问的剧本/.test(apiError);
      strong.textContent = emptyAccount
        ? "尚无剧本"
        : zhimuApi.context.worldId
          ? worldSwitcherFailureLabel(apiError)
          : "未选择剧本";
      small.textContent = emptyAccount
        ? "点击「＋ 创建新世界」开始"
        : apiError && !/params\/|must NOT/i.test(apiError)
          ? apiError
          : zhimuApi.context.worldId
            ? "点击切换剧本"
            : "点击选择或创建剧本";
      return;
    }
    icon.textContent = worldName.slice(0, 1);
    strong.textContent = worldName;
    const chapterCount = cloudStudio?.chapters?.length;
    small.textContent = typeof chapterCount === "number"
      ? `剧本杀创作 · ${chapterCount} 个公共章节`
      : "剧本杀创作 · 正在同步章节";
  }

  function syncNavAdvanced(view = uiStore.get().view) {
    const panel = document.getElementById("nav-advanced");
    const toggle = document.querySelector("[data-action=toggle-nav-advanced]");
    if (!panel || !toggle) return;
    const expanded = localStorage.getItem("zhimuNavAdvanced") === "1" || ADVANCED_VIEWS.includes(view);
    panel.hidden = !expanded;
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.textContent = expanded ? "⋯ 收起创作工具" : "⋯ 更多创作工具";
  }

  window.zhimuNavShell = { syncNavAdvanced, syncWorldSwitcher, ADVANCED_VIEWS };
})(window);
export {};
