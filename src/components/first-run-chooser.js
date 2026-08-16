/** First login: create an empty product world, import later, or try the player demo. */
import { worldStore } from "../state/index.js";
import { accountScopedStorageKey, currentStorageUserId } from "../runtime/storage-scope.js";
(function (window) {
  const DISMISS_KEY = "zhimuFirstRunDismissed";

  function dismissKey() {
    return accountScopedStorageKey(DISMISS_KEY, { userId: currentStorageUserId() });
  }

  function playOfficialUrl() {
    const fromConfig = window.zhimuConfig?.playSiteOrigin || window.zhimuInviteLinks?.playSiteOrigin?.();
    const base = (fromConfig || "https://play.getzhimu.com").replace(/\/$/, "");
    return `${base}/?experience=official`;
  }

  function isDismissed() {
    return localStorage.getItem(dismissKey()) === "1";
  }

  function dismiss() {
    localStorage.setItem(dismissKey(), "1");
  }

  function shouldShow() {
    if (!window.zhimuSessionAuth?.isAuthenticated?.()) return false;
    if (isDismissed()) return false;
    const worlds = worldStore.get().cloudWorlds || [];
    return worlds.length === 0;
  }

  function renderFirstRunChooser() {
    if (!shouldShow()) return "";
    const playUrl = playOfficialUrl();
    return `<section class="card first-run-chooser" data-first-run-chooser>
      <div class="section-head">
        <div>
          <p class="section-kicker">欢迎 · 账号已准备好</p>
          <h2>先创建一个属于你的世界</h2>
          <p><strong>选择类型 → 命名 → 进入工作区</strong>。角色、章节、规则和组件都等你创建后再逐步补充。</p>
        </div>
        <button type="button" class="text-btn" data-action="dismiss-first-run">稍后再说</button>
      </div>
      <div class="first-run-grid">
        <article class="first-run-card first-run-card-primary">
          <div class="first-run-card-head"><p class="eyebrow">推荐 · 约 30 秒</p><span>空白开始</span></div>
          <h3>创建空白世界</h3>
          <p>只选择剧本杀、跑团或桌游，并输入一个名称。系统不会替你添加角色、章节、规则或测试房。</p>
          <ul><li>创建时没有来回填表</li><li>之后按自己的顺序开发</li></ul>
          <button type="button" class="primary-btn" data-action="open-wizard">创建空白世界 →</button>
        </article>
        <article class="first-run-card">
          <p class="eyebrow">已有文稿</p>
          <h4>导入剧本</h4>
          <p>适合已经准备好 Markdown、TXT 或角色本的团队，再进入编排台补场景。</p>
          <button type="button" class="secondary-btn" data-go="writer">打开创作台 →</button>
        </article>
        <article class="first-run-card">
          <p class="eyebrow">先体验</p>
          <h4>玩家官方示例</h4>
          <p>先用玩家身份感受选角色、阅读分幕和探索，再决定如何创作。</p>
          <a class="secondary-btn" href="${playUrl.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer" data-action="open-play-official">打开玩家端 →</a>
        </article>
      </div>
    </section>`;
  }

  window.zhimuFirstRun = { renderFirstRunChooser, shouldShow, dismiss, playOfficialUrl };
})(window);
export {};
