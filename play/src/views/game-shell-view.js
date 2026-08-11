import { escapeHtml } from "../../../shared/security.js";
import { normalizeRuntimeCurrentState } from "../../../shared/runtime-current-state.js";
import { playerProgress, state } from "../state.js";
import { renderMiniGamePanel } from "../components/mini-games.js";
import { renderRecapTab } from "./recap.js";
import { renderVoiceTab } from "./voice.js";
import { renderGameHome, renderGameSidebar, renderHostConfirmBannerHtml } from "./game-home-views.js";
import { renderClues, renderExploration, renderInventory } from "./game-investigation-views.js";
import { renderSocialTab, renderSuspicionsTab, renderTasksTab } from "./game-play-views.js";
import { renderNotesTab, renderTimelineTab } from "./game-recap-views.js";
import { renderSections } from "./game-section-view.js";
import { gameTabPanelLabelId, primaryTabFor, tabGroupFor } from "./game-tab-model.js";
import { renderPlayerPaceClock } from "../runtime/player-pace-clock.js";

function sectionBlock(title, subtitle, body, action = "") {
  return `<section class="merged-tab-section card">
    <div class="section-head">
      <div><h3>${escapeHtml(title)}</h3>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div>
      ${action}
    </div>
    ${body}
  </section>`;
}

function renderStoryTab() {
  const role = state.home?.role;
  const roleCard = `<article class="role-story-card">
    <p class="eyebrow">你的角色</p>
    <h2>${escapeHtml(role?.name || "未选择")}</h2>
    <p>${escapeHtml(role?.private_profile || role?.public_profile || "暂无角色资料")}</p>
  </article>`;
  return `<div class="merged-tab-layout story-tab-layout">
    ${roleCard}
    ${renderSections()}
  </div>`;
}

function renderInvestigationTab() {
  return `<div class="merged-tab-layout investigation-tab-layout">
    ${sectionBlock("探索", "当前开放场景与可调查点", renderExploration())}
    ${sectionBlock("线索", "我的线索、公开线索与私享线索", renderClues())}
    ${sectionBlock("背包", "调查获得的道具与可用物品", renderInventory())}
  </div>`;
}

function renderPlayTab() {
  return `<div class="merged-tab-layout play-tab-layout">
    ${sectionBlock("任务与口供", "本幕目标、可选任务和提交给主持人的陈述", renderTasksTab())}
    ${sectionBlock("怀疑", "仅自己可见的角色怀疑度与理由", renderSuspicionsTab())}
    ${sectionBlock("投票 / 私密行动", "指认、投票、秘密交易和询问主持", renderSocialTab())}
  </div>`;
}

function renderRecapMergedTab() {
  return `<div class="merged-tab-layout recap-tab-layout">
    ${sectionBlock("复盘", "本局结论、揭示轨迹和满意度反馈", renderRecapTab())}
    ${sectionBlock("时间线", "你在本房间可见的最近事件", renderTimelineTab())}
    ${sectionBlock("笔记", "只对自己可见的推理记录", renderNotesTab())}
  </div>`;
}

function gameTabDefinitions() {
  const progress = playerProgress(state.home);
  const voiceLive = state.voiceLiveStatus === "connected" ? "live" : "";
  const pendingTasks = (state.home?.tasks || []).filter((t) => t.status !== "completed").length;
  const openVotes = (state.home?.activeVotes || []).filter((v) => v.status === "open" && !v.submitted_at).length;
  const notesCount = state.home?.notes?.length || 0;
  const primary = primaryTabFor(state.tab);
  const groupPulse = (id) => tabGroupFor(id).reduce((sum, child) => sum + (state.tabPulseCount?.[child] || 0), 0);
  const investigationCount = (state.exploration?.scenes?.length || 0) + progress.clueTotal + progress.inventoryCount;
  const playCount = pendingTasks + openVotes;
  return [
    { id: "home", target: "home", label: "现在", badge: voiceLive ? "●" : "", active: primary === "home", pulse: groupPulse("home") },
    { id: "story", target: "sections", label: "剧情", badge: progress.sectionsTotal ? `${progress.sectionsCompleted}/${progress.sectionsTotal}` : "", active: primary === "story", pulse: groupPulse("story") },
    { id: "investigation", target: "explore", label: "调查", badge: investigationCount || "", active: primary === "investigation", pulse: groupPulse("investigation") },
    { id: "play", target: "tasks", label: "博弈", badge: playCount || "", active: primary === "play", pulse: groupPulse("play") },
    { id: "recap", target: "recap", label: "复盘", badge: state.recapLatest ? "●" : notesCount || "", active: primary === "recap", pulse: groupPulse("recap") }
  ];
}

export function renderTabletopLiveAlert() {
  if (state.tab === "home" || !state.home?.currentState) return "";
  const current = normalizeRuntimeCurrentState(state.home.currentState, {
    audience: "player",
    connected: state.roomEventsConnected,
  });
  const map = current.presentation?.map;
  if (!map) return "";

  const ending = map.publishedEnding;
  const encounter = map.activeEncounter?.status === "active" ? map.activeEncounter : null;
  const check = map.activeCheck;
  let liveState = null;
  if (encounter) {
    liveState = {
      tone: "encounter",
      eyebrow: "主持人触发遭遇",
      title: `${encounter.locationName}遭遇进行中`,
      detail: `${encounter.npcs?.length || 0} 个场景角色已登场，请返回当前场景查看状态。`,
    };
  } else if (check) {
    liveState = {
      tone: "check",
      eyebrow: check.result ? "场景判定已公开" : "主持人发起判定",
      title: check.label,
      detail: check.result ? check.outcomeText : check.instruction,
    };
  } else if (ending) {
    liveState = {
      tone: "ending",
      eyebrow: "结局已公开",
      title: ending.name,
      detail: ending.summary,
    };
  }
  if (!liveState) return "";

  return `<section class="tabletop-live-alert is-${liveState.tone}" data-player-tabletop-global-alert role="status" aria-live="assertive">
    <div><span>${escapeHtml(liveState.eyebrow)}</span><strong>${escapeHtml(liveState.title)}</strong><p>${escapeHtml(liveState.detail)}</p></div>
    <button class="btn primary compact" type="button" data-action="switch-tab" data-tab="home">查看当前场景</button>
  </section>`;
}

function renderTabBadge(id, badge, pulseCount = 0) {
  const pulse = pulseCount > 0 && primaryTabFor(state.tab) !== id;
  const parts = [];
  if (badge) parts.push(`<span class="tab-badge">${badge}</span>`);
  if (pulse && pulseCount > 0) {
    parts.push(`<span class="tab-badge tab-badge-new">+${pulseCount > 9 ? "9+" : pulseCount}</span>`);
  } else if (pulse) {
    parts.push(`<span class="tab-pulse-dot" aria-label="有新内容"></span>`);
  }
  return parts.join("");
}

export function renderGameTabBar() {
  return gameTabDefinitions()
    .map(
      ({ id, target, label, badge, active, pulse }) => `
            <button type="button" role="tab" aria-selected="${active ? "true" : "false"}" id="play-tab-${id}" class="tab ${active ? "is-active" : ""}${pulse ? " tab-has-pulse" : ""}" data-action="switch-tab" data-tab="${target}" data-primary-tab="${id}">
              ${label}${renderTabBadge(id, badge, pulse)}
            </button>`
    )
    .join("");
}

export function renderGameTabBody() {
  if (state.tab === "home") return renderGameHome();
  if (state.tab === "voice") return renderVoiceTab();
  if (primaryTabFor(state.tab) === "story") return renderStoryTab();
  if (primaryTabFor(state.tab) === "investigation") return renderInvestigationTab();
  if (primaryTabFor(state.tab) === "play") return renderPlayTab();
  if (primaryTabFor(state.tab) === "recap") return renderRecapMergedTab();
  if (state.tab === "sections") return renderSections();
  if (state.tab === "tasks") return renderTasksTab();
  if (state.tab === "suspicions") return renderSuspicionsTab();
  if (state.tab === "social") return renderSocialTab();
  if (state.tab === "explore") return renderExploration();
  if (state.tab === "clues") return renderClues();
  if (state.tab === "timeline") return renderTimelineTab();
  if (state.tab === "notes") return renderNotesTab();
  if (state.tab === "recap") return renderRecapTab();
  return renderInventory();
}

export function renderGame() {
  return `
    <section class="game-shell ${state.gameSidebarCollapsed ? "sidebar-collapsed" : ""}">
      <button class="sidebar-toggle btn outline full" type="button" data-action="toggle-sidebar" aria-expanded="${state.gameSidebarCollapsed ? "false" : "true"}">
        ${state.gameSidebarCollapsed ? "展开角色与成员" : "收起侧栏"}
      </button>
      <div class="game-main">
        <nav class="tab-bar" data-game-tab-bar aria-label="玩家功能" role="tablist">
          ${renderGameTabBar()}
        </nav>
        <div data-game-host-banner>${renderHostConfirmBannerHtml()}</div>
        <div data-game-pace-clock>${renderPlayerPaceClock(state.paceClock)}</div>
        <div data-game-tabletop-alert>${renderTabletopLiveAlert()}</div>
        <div data-game-mini-game>${renderMiniGamePanel(state.currentGame)}</div>
        <div class="tab-body" data-game-tab-body role="tabpanel" aria-labelledby="${gameTabPanelLabelId(state.tab)}">${renderGameTabBody()}</div>
      </div>
      <aside class="game-sidebar" data-game-sidebar>
        ${renderGameSidebar()}
      </aside>
    </section>`;
}
