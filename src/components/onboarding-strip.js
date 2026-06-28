/** First-run 3-minute path: create world → play portal → host console sees progress. */
(function (window) {
  const DISMISS_KEY = "zhimuOnboardingDismissed";

  function isDismissed() {
    return localStorage.getItem(DISMISS_KEY) === "1";
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
  }

  function stepState(stepId) {
    const state = window.zhimuState;
    const studio = state.cloudStudio;
    const hasWorld = Boolean(window.zhimuApi?.context?.worldId && studio?.world);
    const hasRoom = Boolean(window.zhimuWorkspace?.activeRuntimeRoom?.());
    const host = state.cloudHost || [];
    const hasProgress = host.some((item) => (item.completed_sections || 0) > 0);
    const visitedPlayer = sessionStorage.getItem("zhimuOnboardingPlayer") === "1";
    const visitedDirector = sessionStorage.getItem("zhimuOnboardingDirector") === "1";

    switch (stepId) {
      case "world":
        return hasWorld ? "done" : "active";
      case "player":
        if (!hasWorld) return "pending";
        return visitedPlayer || hasProgress ? "done" : hasRoom ? "active" : "active";
      case "read":
        if (!hasWorld) return "pending";
        return hasProgress ? "done" : visitedPlayer ? "active" : "pending";
      case "director":
        if (!hasProgress) return "pending";
        return visitedDirector ? "done" : "active";
      default:
        return "pending";
    }
  }

  function stepRow(stepId, index, title, text, action, actionLabel) {
    const status = stepState(stepId);
    const icon = status === "done" ? "✓" : String(index);
    return `<li class="onboarding-step ${status}"><span class="onboarding-step-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p>${action ? `<button type="button" class="text-btn" data-action="${action}">${actionLabel} →</button>` : ""}</div></li>`;
  }

  function shouldShow() {
    if (isDismissed()) return false;
    if (window.zhimuSessionMode?.getSessionMode?.() === "authenticated") {
      const worlds = window.zhimuState?.cloudWorlds || [];
      if (worlds.length > 1) return false;
    }
    return stepState("director") !== "done";
  }

  function renderOnboardingStrip() {
    if (!shouldShow()) return "";
    return `<section class="card onboarding-strip" data-onboarding-strip><div class="section-head"><div><p class="section-kicker">首次体验 · 约 3 分钟</p><h3>跑通一条完整链路</h3><p>创作者端创建剧本 → 独立玩家端试读 → 独立主持端看到推进。</p></div><button type="button" class="text-btn" data-action="dismiss-onboarding">不再显示</button></div><ol class="onboarding-steps">${stepRow("world", 1, "创建或选择剧本", "侧栏「＋ 创建新世界」走完向导，或在「我的剧本」中切换已有剧本。", "open-wizard", "创建剧本")}${stepRow("player", 2, "打开独立玩家端", "通过顶部「打开玩家端」或下方按钮，使用邀请码选角色并开始阅读。", "onboarding-go-player", "打开玩家端")}${stepRow("read", 3, "读完一幕私人剧情", "在玩家端打开章节并点「确认读完」；系统会记录进度。", "onboarding-go-player", "继续阅读")}${stepRow("director", 4, "主持端查看推进", "打开独立主持端，在玩家表中看到阅读进度与最近操作。", "onboarding-go-director", "打开主持端")}</ol></section>`;
  }

  function markPlayerVisit() {
    sessionStorage.setItem("zhimuOnboardingPlayer", "1");
  }

  function markDirectorVisit() {
    sessionStorage.setItem("zhimuOnboardingDirector", "1");
  }

  window.zhimuOnboarding = {
    renderOnboardingStrip,
    shouldShow,
    dismiss,
    markPlayerVisit,
    markDirectorVisit,
    stepState
  };
})(window);
export {};
