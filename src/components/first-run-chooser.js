/** First login: three clear paths — wizard / import / official play demo. */
import { worldStore } from "../state/index.js";
(function (window) {
  const DISMISS_KEY = "zhimuFirstRunDismissed";

  function playOfficialUrl() {
    const fromConfig = window.zhimuConfig?.playSiteUrl || window.zhimuInviteLinks?.playOrigin?.();
    const base = (fromConfig || "https://play.getzhimu.com").replace(/\/$/, "");
    return `${base}/?experience=official`;
  }

  function isDismissed() {
    return localStorage.getItem(DISMISS_KEY) === "1";
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
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
          <p class="section-kicker">欢迎 · 从这里开始</p>
          <h3>选择你的第一条路径</h3>
          <p>跑通首场只需四步：<strong>创建剧本 → 开房 → 邀请玩家 → 复盘</strong>（约 10 分钟）。</p>
        </div>
        <button type="button" class="text-btn" data-action="dismiss-first-run">稍后再说</button>
      </div>
      <div class="first-run-grid">
        <article class="first-run-card">
          <p class="eyebrow">推荐</p>
          <h4>创建测试世界</h4>
          <p>向导一键生成角色、分幕、规则与测试房。</p>
          <button type="button" class="primary-btn" data-action="open-wizard">开始向导 →</button>
        </article>
        <article class="first-run-card">
          <p class="eyebrow">已有文稿</p>
          <h4>导入剧本</h4>
          <p>在创作台粘贴 Markdown 或上传文档，再进编排台补场景。</p>
          <button type="button" class="secondary-btn" data-go="writer">打开创作台 →</button>
        </article>
        <article class="first-run-card">
          <p class="eyebrow">先体验</p>
          <h4>玩家官方示例</h4>
          <p>在玩家端感受阅读与探索（需登录并验证邮箱）。</p>
          <a class="secondary-btn" href="${playUrl.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer" data-action="open-play-official">打开玩家端 →</a>
        </article>
      </div>
    </section>`;
  }

  window.zhimuFirstRun = { renderFirstRunChooser, shouldShow, dismiss, playOfficialUrl };
})(window);
export {};
