/** First login / empty workspace: conversational creator journey chooser. */
import * as zhimuApi from "../api/index.js";
import { worldStore, wizardStore } from "../state/index.js";
import { narrativeProfileFromSettings } from "../../shared/narrative-profile.js";
import { callRuntime, go } from "../runtime/runtime-facade.js";
import { callView } from "../runtime/view-registry.js";
import { accountScopedStorageKey, currentStorageUserId } from "../runtime/storage-scope.js";

(function (window) {
  const DISMISS_KEY = "zhimuFirstRunDismissed";

  function dismissKey() {
    return accountScopedStorageKey(DISMISS_KEY, { userId: currentStorageUserId() });
  }

  function isDismissed() {
    return localStorage.getItem(dismissKey()) === "1";
  }

  function dismiss() {
    localStorage.setItem(dismissKey(), "1");
  }

  function isWorldSparse(studio) {
    if (!studio?.world) return false;
    const roles = studio.roles?.length || 0;
    const sections = studio.sections?.length || 0;
    const chapters = studio.chapters?.length || 0;
    const importBody = studio.world?.settings?.importSource?.body;
    return roles === 0 && sections === 0 && chapters === 0 && !importBody;
  }

  function shouldShow() {
    if (!window.zhimuSessionAuth?.isAuthenticated?.()) return false;
    if (isDismissed()) return false;
    const worlds = worldStore.get().cloudWorlds || [];
    return worlds.length === 0;
  }

  function shouldShowCockpit() {
    if (!window.zhimuSessionAuth?.isAuthenticated?.()) return false;
    if (isDismissed()) return false;
    const worlds = worldStore.get().cloudWorlds || [];
    if (worlds.length === 0) return false;
    const studio = worldStore.get().cloudWorkspacePreview;
    return isWorldSparse(studio);
  }

  function journeyHtml({ compact = false } = {}) {
    const studio = worldStore.get().cloudWorkspacePreview;
    const worldName = studio?.world?.name;
    const profile = studio?.world ? narrativeProfileFromSettings(studio.world.settings) : null;
    const isMurderMystery = !profile || profile.creationType === "murder_mystery";
    const compactClass = compact ? " creator-journey-compact" : "";
    const contextLine = compact && worldName
      ? `<p class="journey-context">当前剧本「${escapeAttr(worldName)}」还是空白——接下来怎么走？</p>`
      : "";

    return `<section class="card creator-journey first-run-chooser${compactClass}" data-first-run-chooser data-creator-journey>
      <div class="section-head creator-journey-head">
        <div class="creator-journey-dialogue">
          <div class="journey-bubble journey-bubble-host">
            <span class="journey-avatar" aria-hidden="true">织</span>
            <div class="journey-bubble-body">
              <p class="section-kicker">欢迎 · 创作台</p>
              <h2>${compact ? "接着把这个世界填满吧" : "你是第一次来织幕吗？"}</h2>
              <p>${compact
                ? "可以从已有稿件上传，也可以先聊聊你想要什么样的世界。"
                : "不管有没有完整稿件，都可以从这里开始。有稿就上传拆稿；没稿咱们一起从世界规划做起。"}</p>
              ${contextLine}
            </div>
          </div>
        </div>
        <button type="button" class="text-btn" data-action="dismiss-first-run">我先自己逛逛</button>
      </div>
      <div class="creator-journey-paths first-run-grid">
        ${isMurderMystery ? `<article class="creator-journey-card first-run-card first-run-card-upload">
          <div class="first-run-card-head"><p class="eyebrow">已有稿件</p><span>约 5 分钟</span></div>
          <h3>已经有让大家见识的剧本了</h3>
          <p>主持手册、角色本、线索文字和线索图都准备好了？上传后自动拆稿入库，原文稿也会保留。</p>
          <ul><li>主持手册 + 多角色 Word / 压缩包</li><li>线索 docx 与 jpg/png 按文件名配对</li></ul>
          <button type="button" class="primary-btn" data-action="creator-journey-upload">上传开本包 →</button>
        </article>` : ""}
        <article class="creator-journey-card first-run-card first-run-card-plan${isMurderMystery ? "" : " first-run-card-primary"}">
          <div class="first-run-card-head"><p class="eyebrow">${isMurderMystery ? "从零开始" : "推荐"}</p><span>一起写</span></div>
          <h3>那咱们一起做一个剧本吧</h3>
          <p>先定世界规划：你想要什么样的时代、氛围和核心谜题？写清楚之后，再补角色、章节和机制。</p>
          <ul><li>灵感卡与世界简介</li><li>之后可用世界引擎与要点补齐</li></ul>
          <button type="button" class="${isMurderMystery ? "secondary-btn" : "primary-btn"}" data-action="creator-journey-plan">先做世界规划 →</button>
        </article>
        ${!compact && !isMurderMystery ? `<article class="creator-journey-card first-run-card">
          <div class="first-run-card-head"><p class="eyebrow">快捷</p><span>空白项目</span></div>
          <h3>先建一个空项目</h3>
          <p>选择跑团或桌游类型，命名后进入专属工作区，再按自己的顺序开发。</p>
          <button type="button" class="secondary-btn" data-action="open-wizard">创建空白世界 →</button>
        </article>` : ""}
      </div>
    </section>`;
  }

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function renderFirstRunChooser() {
    if (!shouldShow()) return "";
    return journeyHtml({ compact: false });
  }

  function renderCockpitBanner() {
    if (!shouldShowCockpit()) return "";
    return journeyHtml({ compact: true });
  }

  function hasActiveWorld() {
    const worldId = zhimuApi.context.worldId;
    const worlds = worldStore.get().cloudWorlds || [];
    return Boolean(worldId && worlds.some((world) => world.id === worldId));
  }

  function startUpload() {
    dismiss();
    if (hasActiveWorld()) {
      void callView("writer", "openOpeningPackage");
      return;
    }
    wizardStore.set({ postCreateJourney: "upload" });
    callRuntime("openWizard", "murder_mystery");
  }

  function startPlan() {
    dismiss();
    if (hasActiveWorld()) {
      go("creatorCockpit");
      return;
    }
    callRuntime("openWizard");
  }

  window.zhimuFirstRun = { renderFirstRunChooser, shouldShow, dismiss };
  window.zhimuCreatorJourney = {
    renderCockpitBanner,
    shouldShowCockpit,
    startUpload,
    startPlan,
    dismiss
  };
})(window);

export {};
