/** Sidebar advanced nav expand/collapse + world switcher labels. */
import * as zhimuApi from "../api/index.js";
import { uiStore, userStore, studioStore, worldStore } from "../state/index.js";
import { narrativeModeDefinition, narrativeProfileFromSettings } from "../../shared/narrative-profile.js";
import { productSupportsView, productToolCapabilities, productToolLabel } from "../../shared/product-capabilities.js";
(function (window) {
  const ADVANCED_VIEWS = ["writer", "truth", "studio", "tabletopMap", "boardGame", "clues", "rules", "miniGames", "archive"];

  function currentWorld() {
    const { cloudStudio } = studioStore.get();
    const { cloudWorlds, cloudWorkspacePreview } = worldStore.get();
    return cloudStudio?.world || cloudWorkspacePreview?.world || (Array.isArray(cloudWorlds) ? cloudWorlds : [])
      .find((world) => world.id === zhimuApi.context.worldId) || null;
  }

  function relabelNav(view, label) {
    const button = document.querySelector(`[data-view="${view}"]`);
    if (!button) return;
    const text = button.querySelector(".nav-text");
    if (text) text.textContent = label;
    button.setAttribute("aria-label", label);
    button.title = label;
  }

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
    const { cloudWorlds, cloudWorkspacePreview } = worldStore.get();
    const icon = document.querySelector(".world-switcher .world-icon");
    const strong = document.querySelector(".world-switcher strong");
    const small = document.querySelector(".world-switcher small");
    if (!icon || !strong || !small) return;
    const studioWorld = cloudStudio?.world || cloudWorkspacePreview?.world;
    const listedWorld = (Array.isArray(cloudWorlds) ? cloudWorlds : [])
      .find((world) => world.id === zhimuApi.context.worldId);
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
    const profile = narrativeProfileFromSettings((studioWorld || listedWorld)?.settings || {});
    const definition = narrativeModeDefinition(profile.creationType);
    const chapterCount = (cloudStudio || cloudWorkspacePreview)?.chapters?.length;
    if (profile.creationType === "board_game") {
      const componentCount = (studioWorld || listedWorld)?.settings?.boardGameDesign?.components?.length;
      small.textContent = typeof componentCount === "number"
        ? `${definition.label}创作 · ${componentCount} 类组件`
        : `${definition.label}创作 · 空白组件工坊`;
    } else {
      small.textContent = typeof chapterCount === "number"
        ? `${definition.label}创作 · ${chapterCount} 个${definition.terminology.act}`
        : `${definition.label}创作 · 正在同步内容`;
    }
  }

  function syncNavAdvanced(view = uiStore.get().view) {
    const panel = document.getElementById("nav-advanced");
    const toggle = document.querySelector("[data-action=toggle-nav-advanced]");
    if (!panel || !toggle) return;
    const label = toggle.querySelector("[data-nav-advanced-label]");
    const world = currentWorld();
    const reviewerMode = world?.membership_role === "reviewer";
    const profile = narrativeProfileFromSettings(world?.settings || {});
    const capabilities = productToolCapabilities(profile.creationType);
    const productScope = panel.querySelector("[data-nav-product-scope]");
    const sharedScope = panel.querySelector("[data-nav-shared-scope]");
    if (productScope) productScope.textContent = `${capabilities.label}专属工具`;
    if (sharedScope) sharedScope.textContent = "共享底层 · 规则与运行";
    panel.querySelectorAll("[data-view]").forEach((button) => {
      const productHidden = !productSupportsView(profile.creationType, button.dataset.view);
      button.hidden = productHidden || (reviewerMode && button.dataset.view !== "writer");
      relabelNav(button.dataset.view, productToolLabel(profile.creationType, button.dataset.view, button.querySelector(".nav-text")?.textContent));
    });
    if (productScope) productScope.hidden = reviewerMode;
    if (sharedScope) sharedScope.hidden = reviewerMode || capabilities.shared.every((viewName) => {
      const button = panel.querySelector(`[data-view="${viewName}"]`);
      return !button || button.hidden;
    });
    // Respect explicit collapse ("0"). Being on an advanced page must NOT force-reopen
    // after the user clicks 收起 — that caused UI stutter / snap-back.
    const stored = localStorage.getItem("zhimuNavAdvanced");
    const expanded =
      stored === "1" || (stored !== "0" && ADVANCED_VIEWS.includes(view));
    panel.hidden = !expanded;
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.setAttribute("aria-label", expanded ? "收起精细编辑器" : "展开精细编辑器");
    toggle.classList.toggle("contains-active", ADVANCED_VIEWS.includes(view));
    if (label) label.textContent = expanded ? `收起${capabilities.label}工具` : `${capabilities.label}精细工具`;
    toggle.title = expanded ? `收起${capabilities.label}精细工具` : `展开${capabilities.label}精细工具`;
  }

  window.zhimuNavShell = { syncNavAdvanced, syncWorldSwitcher, ADVANCED_VIEWS };
})(window);
export {};
