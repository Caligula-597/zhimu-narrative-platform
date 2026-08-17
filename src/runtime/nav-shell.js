/** Sidebar advanced nav expand/collapse + world switcher labels. */
import * as zhimuApi from "../api/index.js";
import { uiStore, userStore, studioStore, worldStore } from "../state/index.js";
import { narrativeModeDefinition, narrativeProfileFromSettings } from "../../shared/narrative-profile.js";
import { productSupportsView, productToolCapabilities, productToolLabel } from "../../shared/product-capabilities.js";
(function (window) {
  const ADVANCED_VIEWS = ["writer", "truth", "studio", "tabletopMap", "clues", "rules", "miniGames", "archive"];
  let syncedProductMode = "";

  function currentWorld() {
    const { cloudStudio } = studioStore.get();
    const { cloudWorlds, cloudWorkspacePreview } = worldStore.get();
    const activeWorldId = zhimuApi.context.worldId;
    const studioWorld = cloudStudio?.world?.id === activeWorldId ? cloudStudio.world : null;
    const previewWorld = cloudWorkspacePreview?.world?.id === activeWorldId ? cloudWorkspacePreview.world : null;
    return studioWorld || previewWorld || (Array.isArray(cloudWorlds) ? cloudWorlds : [])
      .find((world) => world.id === activeWorldId) || null;
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
    if (/permission|403|权限/i.test(err)) return "无权访问该项目";
    if (/fetch|超时|Failed|network|Network|ECONNREFUSED/i.test(err)) return "无法连接后端";
    return "项目加载失败";
  }

  function syncProductShell() {
    const world = currentWorld();
    const profile = world ? narrativeProfileFromSettings(world.settings || {}) : null;
    const boardGameMode = profile?.creationType === "board_game";
    const productMode = boardGameMode ? "board-game" : "narrative";
    if (syncedProductMode === productMode) return;
    syncedProductMode = productMode;
    document.body.dataset.productMode = productMode;
    document.querySelectorAll("[data-narrative-shell]").forEach((node) => { node.hidden = boardGameMode; });
    document.querySelectorAll("[data-board-shell]").forEach((node) => { node.hidden = !boardGameMode; });

    const brandSubtitle = document.querySelector(".brand-subtitle");
    if (brandSubtitle) brandSubtitle.textContent = boardGameMode ? "BOARD GAME CREATOR" : "NARRATIVE ENGINE";
    const mainNav = document.querySelector(".main-nav");
    if (mainNav) mainNav.setAttribute("aria-label", boardGameMode ? "桌游创作导航" : "叙事创作导航");
    const sidebarActions = document.querySelector(".sidebar-actions");
    if (sidebarActions) sidebarActions.setAttribute("aria-label", boardGameMode ? "桌游项目操作" : "创作项目操作");

    const createButton = document.querySelector("#create-world-btn");
    const createText = createButton?.querySelector(".sidebar-action-text");
    const createLabel = boardGameMode ? "新建桌游" : "创建项目";
    if (createText) createText.textContent = createLabel;
    if (createButton) {
      createButton.setAttribute("aria-label", createLabel);
      createButton.title = createLabel;
    }
    const catalogButton = document.querySelector("#catalog-world-btn");
    if (catalogButton) catalogButton.hidden = boardGameMode;

    const searchButton = document.querySelector("#search-btn");
    const notifyButton = document.querySelector("#notify-btn");
    const topbarDivider = document.querySelector(".topbar-actions .divider");
    const previewButton = document.querySelector("#preview-btn");
    const runButton = document.querySelector("#run-btn");
    [searchButton, notifyButton, topbarDivider, previewButton].forEach((node) => {
      if (node) node.hidden = boardGameMode;
    });
    if (runButton) {
      runButton.textContent = boardGameMode ? "▶ 运行可玩 Demo" : "▶ 打开主持端";
      runButton.setAttribute("aria-label", boardGameMode ? "运行桌游可玩 Demo" : "打开主持端");
    }

    const settingsButton = document.querySelector('[data-view="settings"]');
    if (settingsButton) settingsButton.hidden = boardGameMode;
    const managementLabel = document.querySelector(".sidebar-bottom-label");
    if (managementLabel) managementLabel.textContent = boardGameMode ? "平台" : "管理";
    const authDescription = document.querySelector("[data-session-desc]");
    if (authDescription) authDescription.textContent = boardGameMode
      ? "登录后可保存桌游项目、素材和可执行 Demo。"
      : "登录后可保存剧本、邀请协作并记录运行数据。";
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
      small.textContent = worldName ? `读取「${worldName}」` : "读取项目工作区";
      return;
    }
    if (!worldName) {
      icon.textContent = "云";
      const emptyAccount = apiError && /还没有可访问的(剧本|项目)/.test(apiError);
      strong.textContent = emptyAccount
        ? "尚无项目"
        : zhimuApi.context.worldId
          ? worldSwitcherFailureLabel(apiError)
          : "未选择项目";
      small.textContent = emptyAccount
        ? "点击「＋ 创建项目」开始"
        : apiError && !/params\/|must NOT/i.test(apiError)
          ? apiError
          : zhimuApi.context.worldId
            ? "点击切换项目"
            : "点击选择或创建项目";
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
        : `${definition.label}创作 · 空白项目`;
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
    if (profile.creationType === "board_game") {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("contains-active");
      return;
    }
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

  window.zhimuNavShell = { syncNavAdvanced, syncProductShell, syncWorldSwitcher, ADVANCED_VIEWS };
})(window);
export {};
