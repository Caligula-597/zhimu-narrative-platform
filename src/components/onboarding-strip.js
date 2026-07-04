/** First-run path (B0-02): 创建剧本 → 开房 → 邀请玩家 → 读完一幕 → 复盘 */
import * as zhimuApi from "../api/index.js";
import { studioStore, roomStore, worldStore } from "../state/index.js";
import { activeRuntimeRoom } from "../runtime/workspace-store.js";
(function (window) {
  const DISMISS_KEY = "zhimuOnboardingDismissed";

  function isDismissed() {
    return localStorage.getItem(DISMISS_KEY) === "1";
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
  }

  function hasWorld() {
    const studio = studioStore.get().cloudStudio;
    return Boolean(zhimuApi?.context?.worldId && studio?.world);
  }

  function hasRoom() {
    return Boolean(activeRuntimeRoom());
  }

  function hasProgress() {
    const host = roomStore.get().cloudHost || [];
    return host.some((item) => (item.completed_sections || 0) > 0);
  }

  function hasRecapArtifacts() {
    const { cloudRecaps, cloudCheckpoints } = roomStore.get();
    return Boolean(cloudRecaps?.length || cloudCheckpoints?.length);
  }

  function stepState(stepId) {
    const visitedInvite = sessionStorage.getItem("zhimuOnboardingInvite") === "1";
    const visitedPlayer = sessionStorage.getItem("zhimuOnboardingPlayer") === "1";
    const visitedRecap = sessionStorage.getItem("zhimuOnboardingRecap") === "1";

    switch (stepId) {
      case "world":
        return hasWorld() ? "done" : "active";
      case "room":
        if (!hasWorld()) return "pending";
        return hasRoom() ? "done" : "active";
      case "invite":
        if (!hasRoom()) return "pending";
        return visitedInvite || visitedPlayer || hasProgress() ? "done" : "active";
      case "read":
        if (!hasRoom()) return "pending";
        return hasProgress() ? "done" : visitedPlayer || visitedInvite ? "active" : "pending";
      case "recap":
        if (!hasProgress()) return "pending";
        return hasRecapArtifacts() || visitedRecap ? "done" : "active";
      default:
        return "pending";
    }
  }

  function stepRow(stepId, index, title, text, action, actionLabel, view) {
    const status = stepState(stepId);
    const icon = status === "done" ? "✓" : String(index);
    let actionBtn = "";
    if (action) {
      actionBtn = `<button type="button" class="text-btn" data-action="${action}">${actionLabel} →</button>`;
    } else if (view) {
      actionBtn = `<button type="button" class="text-btn" data-go="${view}">${actionLabel} →</button>`;
    }
    return `<li class="onboarding-step ${status}"><span class="onboarding-step-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p>${actionBtn}</div></li>`;
  }

  function shouldShow() {
    if (isDismissed()) return false;
    if (window.zhimuSessionMode?.getSessionMode?.() === "authenticated") {
      const worlds = worldStore.get().cloudWorlds || [];
      if (worlds.length > 1) return false;
    }
    return stepState("recap") !== "done";
  }

  function renderOnboardingStrip() {
    if (!shouldShow()) return "";
    return `<section class="card onboarding-strip" data-onboarding-strip>
      <div class="section-head">
        <div>
          <p class="section-kicker">首场路径 · 约 10 分钟</p>
          <h3>创建剧本 → 开房 → 邀请玩家 → 复盘</h3>
          <p>按顺序跑通一次完整链路；完成后可在复盘页查看存档与 recap。</p>
        </div>
        <button type="button" class="text-btn" data-action="dismiss-onboarding">不再显示</button>
      </div>
      <ol class="onboarding-steps">
        ${stepRow("world", 1, "① 创建剧本", "侧栏「＋ 创建新世界」走向导，或在「我的剧本」切换已有世界。", "open-wizard", "创建剧本")}
        ${stepRow("room", 2, "② 开测试房", "运行房列表新建房间，选中后总览会出现邀请码。", "world-rooms", "管理运行房")}
        ${stepRow("invite", 3, "③ 邀请玩家", "复制邀请码或玩家链接发到群；也可自己打开玩家端试读。", "onboarding-copy-invite", "复制邀请")}
        ${stepRow("read", 4, "④ 读完一幕", "玩家在 play 端选角色、读私人分幕并点「确认读完」。", "onboarding-go-player", "打开玩家端")}
        ${stepRow("recap", 5, "⑤ 存档复盘", "主持端或总控台创建 checkpoint；复盘页查看 recap。", null, "打开复盘", "archive")}
      </ol>
    </section>`;
  }

  function markPlayerVisit() {
    sessionStorage.setItem("zhimuOnboardingPlayer", "1");
  }

  function markInviteSent() {
    sessionStorage.setItem("zhimuOnboardingInvite", "1");
  }

  function markRecapVisit() {
    sessionStorage.setItem("zhimuOnboardingRecap", "1");
  }

  window.zhimuOnboarding = {
    renderOnboardingStrip,
    shouldShow,
    dismiss,
    markPlayerVisit,
    markInviteSent,
    markRecapVisit,
    stepState
  };
})(window);
export {};
