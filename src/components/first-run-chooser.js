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
              <p class="section-kicker">织幕</p>
              <h2>${compact ? "这个项目还是空白——你今天想做什么？" : "你今天想做什么？"}</h2>
              <p>${compact
      ? "按主线层级推进，或导入已有剧本继续修改和运行。正文会保留原稿。"
                : "织幕的剧本杀主线只有两条：按新主线层级逐层创作，或把已有剧本无损导入后继续改。"}</p>
              ${contextLine}
            </div>
          </div>
        </div>
        <button type="button" class="text-btn" data-action="dismiss-first-run">我先自己逛逛</button>
      </div>
      <div class="creator-journey-paths first-run-grid">
        <article class="creator-journey-card first-run-card first-run-card-plan first-run-card-primary">
          <div class="first-run-card-head"><p class="eyebrow">主线创作</p><span>按层级推进</span></div>
          <h3>从地点与场合开始</h3>
          <p>按新主线生成层级逐层完成：地点场合、场景地点、公开故事、完整故事与后期对抗。</p>
          <ul><li>每一层先保存，再锁定进入下一层</li><li>上游没有确认的内容不会进入下游</li></ul>
          <button type="button" class="primary-btn" data-action="creator-journey-plan">开始创作 →</button>
        </article>
        ${isMurderMystery ? `<article class="creator-journey-card first-run-card first-run-card-upload">
          <div class="first-run-card-head"><p class="eyebrow">导入已有</p><span>保留原稿</span></div>
          <h3>导入已有剧本</h3>
          <p>上传主持手册、角色本与线索后入库。正文永远显示你的原稿；AI 摘要与结构只作辅助层。</p>
          <ul><li>主持手册 + 多角色 Word / 压缩包</li><li>线索文字与图片按文件名配对</li></ul>
          <button type="button" class="secondary-btn" data-action="creator-journey-upload">导入剧本 →</button>
        </article>` : ""}
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
      if (isMurderMystery) {
        go("writer");
        setTimeout(() => callView("writer", "openMainlineHierarchy"), 0);
      } else {
        go("creatorCockpit");
      }
      return;
    }
    if (isMurderMystery) wizardStore.set({ postCreateJourney: "mainline" });
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
