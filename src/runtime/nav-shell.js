/** Sidebar advanced nav expand/collapse + world switcher labels. */
import * as zhimuApi from "../api/index.js";
import { uiStore, userStore, studioStore, worldStore } from "../state/index.js";
import { narrativeProfileFromWorld } from "../../shared/narrative-profile.js";
import { productAllowsShellView, productSupportsView, productToolLabel } from "../../shared/product-capabilities.js";
import { productModuleForWorld } from "../products/product-registry.js";
(function (window) {
  const ADVANCED_VIEWS = ["writer", "truth", "studio", "clues", "rules", "miniGames", "archive", "diagnostics"];

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
    const profile = world ? narrativeProfileFromWorld(world) : null;
    const hasWorld = Boolean(world?.id);
    const product = world ? productModuleForWorld(world) : null;
    const domain = product?.domain || null;
    const creationType = profile?.creationType || "";
    const productMode = domain?.shellMode || "";
    document.body.dataset.productMode = productMode;
    document.body.dataset.productKey = hasWorld ? domain.key : "";
    document.body.dataset.productActive = hasWorld ? "1" : "0";
    document.querySelectorAll("[data-product-shell]").forEach((node) => {
      node.hidden = !hasWorld || node.dataset.productShell !== domain?.key;
    });
    document.querySelectorAll(".main-nav [data-view], .sidebar-bottom [data-view]").forEach((node) => {
      node.hidden = hasWorld
        ? !productAllowsShellView(creationType, node.dataset.view)
        : !["account", "ops"].includes(node.dataset.view);
    });

    const brandSubtitle = document.querySelector(".brand-subtitle");
    if (brandSubtitle) brandSubtitle.textContent = hasWorld ? product.shell.brandSubtitle : "CREATOR PLATFORM";
    const mainNav = document.querySelector(".main-nav");
    if (mainNav) mainNav.setAttribute("aria-label", hasWorld ? `${domain.label}创作导航` : "项目创作导航");
    const sidebarActions = document.querySelector(".sidebar-actions");
    if (sidebarActions) sidebarActions.setAttribute("aria-label", hasWorld ? `${domain.label}项目操作` : "项目操作");

    const createButton = document.querySelector("#create-world-btn");
    const createText = createButton?.querySelector(".sidebar-action-text");
    const createLabel = hasWorld ? `新建${domain.label}` : "创建项目";
    if (createText) createText.textContent = createLabel;
    if (createButton) {
      createButton.setAttribute("aria-label", createLabel);
      createButton.title = createLabel;
    }
    const catalogButton = document.querySelector("#catalog-world-btn");
    if (catalogButton) catalogButton.hidden = !hasWorld || !product.library.catalogAvailable;

    const searchButton = document.querySelector("#search-btn");
    const notifyButton = document.querySelector("#notify-btn");
    const topbarDivider = document.querySelector(".topbar-actions .divider");
    const previewButton = document.querySelector("#preview-btn");
    const runButton = document.querySelector("#run-btn");
    [searchButton, notifyButton, topbarDivider, previewButton].forEach((node) => {
      if (node) node.hidden = !hasWorld || !product.shell.showCreatorRuntimeControls;
    });
    if (runButton) {
      const runLabel = hasWorld ? product.runtime.label : "";
      runButton.hidden = !runLabel;
      runButton.textContent = runLabel;
      runButton.setAttribute("aria-label", runLabel.replace(/^▶\s*/u, ""));
    }

    const settingsButton = document.querySelector('[data-view="settings"]');
    if (settingsButton) settingsButton.hidden = !hasWorld || !productAllowsShellView(creationType, "settings");
    const managementLabel = document.querySelector(".sidebar-bottom-label");
    if (managementLabel) managementLabel.textContent = hasWorld && productAllowsShellView(creationType, "settings") ? "管理" : "平台";
    const authDescription = document.querySelector("[data-session-desc]");
    if (authDescription) authDescription.textContent = hasWorld
      ? product.shell.authDescription
      : "登录后可创建并管理剧本杀、跑团或桌游项目。";
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
    const world = studioWorld || listedWorld;
    const product = productModuleForWorld(world);
    small.textContent = product.shell.summarizeWorld({
      world,
      workspace: cloudStudio || cloudWorkspacePreview
    });
  }

  function syncNavAdvanced(view = uiStore.get().view) {
    const panel = document.getElementById("nav-advanced");
    const toggle = document.querySelector("[data-action=toggle-nav-advanced]");
    if (!panel || !toggle) return;
    const label = toggle.querySelector("[data-nav-advanced-label]");
    const world = currentWorld();
    const reviewerMode = world?.membership_role === "reviewer";
    const product = productModuleForWorld(world);
    if (!world || !product.shell.advancedNavigation) {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("contains-active");
      return;
    }
    const profile = narrativeProfileFromWorld(world);
    const productScope = panel.querySelector("[data-nav-product-scope]");
    const sharedScope = panel.querySelector("[data-nav-shared-scope]");
    if (productScope) productScope.textContent = "创作高级工具";
    if (sharedScope) sharedScope.textContent = product.shell.advancedSharedScopeLabel || "试跑与运行";
    panel.querySelectorAll("[data-view]").forEach((button) => {
      const productHidden = !productSupportsView(profile.creationType, button.dataset.view);
      button.hidden = productHidden || (reviewerMode && button.dataset.view !== "writer");
      relabelNav(button.dataset.view, productToolLabel(profile.creationType, button.dataset.view, button.querySelector(".nav-text")?.textContent));
    });
    if (productScope) productScope.hidden = reviewerMode;
    if (sharedScope) sharedScope.hidden = reviewerMode;
    // Respect explicit collapse ("0"). Being on an advanced page must NOT force-reopen
    // after the user clicks 收起 — that caused UI stutter / snap-back.
    const stored = localStorage.getItem("zhimuNavAdvanced");
    const expanded =
      stored === "1" || (stored !== "0" && ADVANCED_VIEWS.includes(view));
    panel.hidden = !expanded;
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.setAttribute("aria-label", expanded ? "收起高级工具" : "展开高级工具");
    toggle.classList.toggle("contains-active", ADVANCED_VIEWS.includes(view));
    if (label) label.textContent = expanded ? "收起高级工具" : "高级工具";
    toggle.title = expanded ? "收起高级工具" : "展开高级工具";
  }

  window.zhimuNavShell = { syncNavAdvanced, syncProductShell, syncWorldSwitcher, ADVANCED_VIEWS };
})(window);
export {};
