import { asArray, escapeHtml } from "../../../shared/security.js";
import { currentScene, playerProgress, state } from "../state.js";
import { clueIsRead } from "../utils/clues.js";
import { renderVoiceCompact } from "./voice.js";
import { roomContentBindingPresentation } from "../../../shared/room-content-binding.js";
import {
  normalizeRuntimeCurrentState,
  primaryRuntimeAction,
} from "../../../shared/runtime-current-state.js";
import {
  mechanismInteractionCard,
  normalizeMechanismInteraction,
  normalizeMechanismOptionPresentation,
} from "../../../shared/mechanism-interactions.js";
import { renderPlayerStageMapBoundary } from "./game-tabletop-stage-loader.js";

export function renderGameResume() {
  return `
    <section class="game-resume card">
      <p class="eyebrow">恢复对局</p>
      <h2>正在进入房间…</h2>
      <p class="muted">读取你的角色、分幕与线索进度</p>
    </section>`;
}

function hostNudgeBanner() {
  const nudge = state.hostNudge;
  if (!nudge?.message) return "";
  return `
    <div class="banner host-nudge-banner">
      <div>
        <strong>主持人提醒</strong>
        <p>${escapeHtml(nudge.message)}</p>
      </div>
      <button class="btn quiet compact" type="button" data-action="dismiss-host-nudge">知道了</button>
    </div>`;
}

function hostConfirmBanner() {
  const hc = state.home?.hostConfirm;
  if (!hc?.pendingCount) return "";
  if (hc.waitingForYou) {
    const sample = hc.titles?.[0] ? `「${escapeHtml(hc.titles[0])}」` : "";
    return `
      <div class="banner host-wait-banner">
        <strong>等待主持人确认</strong>
        <p>${sample}${hc.pendingCount > 1 ? ` 等 ${hc.pendingCount} 条` : ""} — 确认后新分幕/场景会自动解锁。</p>
      </div>`;
  }
  return `
    <div class="banner host-wait-banner soft">
      <strong>主持人正在处理 ${hc.pendingCount} 条待确认事件</strong>
      <p>与你相关的推进会在确认后实时通知。</p>
    </div>`;
}

function roomContentBindingBanner() {
  const binding = roomContentBindingPresentation(
    state.home?.room?.contentBinding,
  );
  return `
    <div class="banner room-content-binding-banner ${binding.tone === "published" ? "soft" : "host-wait-banner"}">
      <strong>${escapeHtml(binding.label)}</strong>
      <p>${escapeHtml(binding.detail)}</p>
    </div>`;
}

function runtimeStateBanner() {
  if (!state.home?.currentState) return "";
  const current = normalizeRuntimeCurrentState(state.home?.currentState, {
    audience: "player",
    connected: state.roomEventsConnected,
  });
  const currentBeat = current.currentBeat;
  const currentBeatDetail = currentBeat?.player?.content || current.phase.detail;
  const currentBeatTasks = currentBeat?.player?.tasks || [];
  const currentBeatTips = currentBeat?.player?.tips || [];
  const progress = currentBeat ? Math.max(0, Math.min(100, Math.round(currentBeat.position / currentBeat.total * 100))) : 0;
  return `
    <article class="runtime-flow-card card ${current.syncState.status === "synced" ? "is-synced" : "is-reconnecting"}">
      <div class="runtime-flow-head">
        <div>
          <p class="eyebrow">主持流程同步</p>
          <h2>${escapeHtml(currentBeat ? currentBeat.title : current.phase.label)}</h2>
          <p>${escapeHtml(currentBeatDetail)}</p>
        </div>
        <span class="status-chip ${current.syncState.status === "synced" ? "published" : "testing"}">${current.syncState.status === "synced" ? "主持端已同步" : "正在恢复连接"}</span>
      </div>
      ${currentBeat ? `<div class="runtime-flow-progress"><div><span>第 ${currentBeat.position} / ${currentBeat.total} 段</span><b>${progress}%</b></div><i style="--progress:${progress}%"><b></b></i></div>` : ""}
      <div class="runtime-flow-guidance">
        ${currentBeatTasks.length ? `<section><span>现在要做</span><ul>${currentBeatTasks.map((task) => `<li>${escapeHtml(task)}</li>`).join("")}</ul></section>` : ""}
        ${currentBeatTips.length ? `<section><span>行动提示</span><div>${currentBeatTips.map((tip) => `<em>${escapeHtml(tip)}</em>`).join("")}</div></section>` : ""}
      </div>
      ${renderPlayerStageMapBoundary(current.presentation?.map, {
        clues: state.home?.clues || [],
        sharedClues: state.home?.sharedClues || [],
        discoverySessions: state.discoverySessions,
        roomId: state.roomId,
        roleSlotId: state.home?.role?.id,
      })}
      <footer><span>${escapeHtml(current.phase.label)}</span><span>${current.syncState.isFrozen ? "冻结版本" : "实时草稿"}</span><span>${current.syncState.status === "synced" ? "进度已同步" : "数据可能稍有延迟"}</span></footer>
    </article>`;
}

function renderMechanismDecision(decision) {
  const interaction = normalizeMechanismInteraction(decision.interaction);
  const card = mechanismInteractionCard(interaction.kind);
  const selectedOptionKey = decision.submission?.optionKey || "";
  const submittedAnswer = decision.submission?.answer || null;
  const privateSubmission = interaction.submissionMode !== "advisory_choice";
  const deadlineAt = decision.deadlineAt
    ? new Date(decision.deadlineAt).getTime()
    : Number.NaN;
  const expired = Number.isFinite(deadlineAt) && Date.now() >= deadlineAt;
  const deadlineLabel = Number.isFinite(deadlineAt)
    ? new Date(deadlineAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : `${Math.ceil(interaction.deadlineSeconds / 60)} 分钟`;
  const disabled = state.busy || expired;
  const options = asArray(decision.options);
  const optionDescription = (option, index) => {
    const presentation = normalizeMechanismOptionPresentation(
      option.presentation,
    );
    return `<span>${escapeHtml(presentation.eyebrow || `${card.shortLabel} ${String(index + 1).padStart(2, "0")}`)}</span>
      <strong>${escapeHtml(option.choiceText)}</strong>
      ${presentation.publicPreview ? `<p>${escapeHtml(presentation.publicPreview)}</p>` : ""}
      ${presentation.costLabel || presentation.riskLabel || presentation.sequenceLabel ? `<small>${[presentation.sequenceLabel, presentation.costLabel, presentation.riskLabel].filter(Boolean).map(escapeHtml).join(" · ")}</small>` : ""}`;
  };
  let inputHtml = "";
  if (interaction.inputMode === "ranking") {
    const savedOrder = Array.isArray(submittedAnswer?.optionKeys)
      ? submittedAnswer.optionKeys
      : [];
    const order = new Map(savedOrder.map((key, index) => [key, index]));
    const rankedOptions = [...options].sort(
      (left, right) =>
        (order.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.key) ?? Number.MAX_SAFE_INTEGER),
    );
    inputHtml = `<div class="mechanism-ranking" data-mechanism-answer-panel data-decision-key="${escapeHtml(decision.key)}">
      <ol class="mechanism-ranking-list" data-mechanism-ranking-list>${rankedOptions
        .map(
          (option, index) => `<li data-mechanism-ranking-option data-option-key="${escapeHtml(option.key)}">
            <b>${index + 1}</b><div>${optionDescription(option, index)}</div>
            <span class="mechanism-rank-controls"><button type="button" data-action="move-mechanism-ranking" data-direction="up" aria-label="上移 ${escapeHtml(option.choiceText)}" ${disabled || index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-mechanism-ranking" data-direction="down" aria-label="下移 ${escapeHtml(option.choiceText)}" ${disabled || index === rankedOptions.length - 1 ? "disabled" : ""}>↓</button></span>
          </li>`,
        )
        .join("")}</ol>
      <button type="button" class="btn primary compact" data-action="submit-mechanism-ranking" ${disabled ? "disabled" : ""}>${submittedAnswer?.type === "ranking" ? "更新我的秘密排序" : "提交我的秘密排序"}</button>
    </div>`;
  } else if (interaction.inputMode === "allocation") {
    const saved = new Map(
      asArray(submittedAnswer?.allocations).map((entry) => [
        entry.optionKey,
        Number(entry.amount) || 0,
      ]),
    );
    inputHtml = `<div class="mechanism-allocation" data-mechanism-answer-panel data-decision-key="${escapeHtml(decision.key)}" data-allocation-total="${interaction.allocationTotal}">
      <div class="mechanism-allocation-head"><strong>分配 ${interaction.allocationTotal} ${escapeHtml(interaction.allocationUnitLabel)}</strong><small>必须全部分配，允许某项为 0</small></div>
      <div class="mechanism-allocation-list">${options
        .map(
          (option, index) => `<label data-mechanism-allocation-option data-option-key="${escapeHtml(option.key)}"><div>${optionDescription(option, index)}</div><span><input type="number" inputmode="numeric" min="0" max="${interaction.allocationTotal}" step="1" value="${saved.get(option.key) ?? 0}" data-mechanism-allocation-amount ${disabled ? "disabled" : ""}><em>${escapeHtml(interaction.allocationUnitLabel)}</em></span></label>`,
        )
        .join("")}</div>
      <button type="button" class="btn primary compact" data-action="submit-mechanism-allocation" ${disabled ? "disabled" : ""}>${submittedAnswer?.type === "allocation" ? "更新我的秘密分配" : "提交我的秘密分配"}</button>
    </div>`;
  } else {
    inputHtml = `<div class="mechanism-option-list">${options
      .map((option, index) => {
        const presentation = normalizeMechanismOptionPresentation(
          option.presentation,
        );
        const selected = selectedOptionKey === option.key;
        const isDefault = interaction.defaultOptionKey === option.key;
        return `<button type="button" class="mechanism-option-card ${selected ? "is-selected" : ""}" data-action="submit-mechanism-choice" data-submission-mode="${escapeHtml(interaction.submissionMode)}" data-decision-key="${escapeHtml(decision.key)}" data-option-key="${escapeHtml(option.key)}" ${disabled ? "disabled" : ""}>
        ${optionDescription(option, index)}
        ${isDefault ? `<small class="mechanism-default-label">超时默认方案</small>` : ""}
        <em>${selected ? (interaction.submissionMode === "private_choice" ? "秘密承诺已提交" : privateSubmission ? "秘密答案已提交" : "已提交此倾向") : interaction.submissionMode === "private_choice" ? "秘密提交承诺" : privateSubmission ? "秘密提交" : "提交我的倾向"}</em>
      </button>`;
      })
      .join("")}</div>`;
  }
  return `<div class="mechanism-decision mechanism-kind-${escapeHtml(interaction.kind)}">
    <div class="mechanism-decision-head"><span class="mechanism-kind-label is-${escapeHtml(card.theme)}">${escapeHtml(interaction.label)}</span><div><strong>${escapeHtml(decision.question || "请讨论并形成选择")}</strong><p>${escapeHtml(interaction.playerInstruction)}</p></div></div>
    ${interaction.deadlineSeconds ? `<div class="mechanism-deadline ${expired ? "is-expired" : ""}"><span>${expired ? "本轮已到期" : "服务器截止时间"}</span><b>${escapeHtml(deadlineLabel)}</b><small>到期后停止提交，由主持人按作者预设方案结算</small></div>` : ""}
    ${inputHtml}
    <p class="mechanism-submission-help">${
      privateSubmission
        ? interaction.submissionMode === "private_choice"
          ? "你的承诺只对本人和主持人可见；其他玩家不会看到你的选择。"
          : "你的答案只对本人和主持人可见；其他玩家看不到内容、顺序或分配数值。"
        : "你的提交不会立即改写剧情；主持人会看到全桌倾向并确认最终结算。"
    }</p>
  </div>`;
}

export function renderMechanismProgress() {
  const mechanism = state.home?.currentState?.mechanism;
  if (!mechanism) return "";
  if (mechanism.stale) {
    return `
      <article class="mechanism-progress card is-waiting">
        <p class="eyebrow">实时剧情机制</p>
        <h3>等待主持人同步新版本</h3>
        <p class="muted">当前机制与房间内容版本不一致，旧状态不会继续影响本场运行。</p>
      </article>`;
  }
  if (!mechanism.initialized) {
    return `
      <article class="mechanism-progress card is-waiting">
        <p class="eyebrow">实时剧情机制</p>
        <h3>等待主持人开启</h3>
        <p class="muted">创作者设计的机制已随剧本进入房间，主持人开启后会自动显示当前轮次。</p>
      </article>`;
  }
  if (mechanism.status === "completed") {
    const epilogue = mechanism.ending?.roleEpilogue;
    return `
      <article class="mechanism-progress card is-complete">
        <p class="eyebrow">实时剧情机制 · 已完成</p>
        <h3>${escapeHtml(mechanism.ending?.title || "本场机制已结算")}</h3>
        ${mechanism.ending?.consequence ? `<p>${escapeHtml(mechanism.ending.consequence)}</p>` : ""}
        ${epilogue ? `<div class="mechanism-player-action"><span>你的个人尾声</span><strong>${escapeHtml(epilogue.title)}</strong><p>${escapeHtml(epilogue.consequence)}</p></div>` : ""}
        <p class="muted">主结局与个人余波均由前面各轮已经发生的行动结算。</p>
      </article>`;
  }

  const round = mechanism.currentRound;
  if (!round) return "";
  const decisions = asArray(mechanism.decisions);
  return `
    <article class="mechanism-progress card">
      <div class="mechanism-progress-head">
        <div>
          <p class="eyebrow">实时剧情机制 · 第 ${Number(round.sequence) || 1} / ${Number(mechanism.totalRounds) || "?"} 轮</p>
          <h3>${escapeHtml(round.title || "当前轮次")}</h3>
        </div>
        <span class="status-chip testing">主持端结算</span>
      </div>
      ${round.goal ? `<p class="mechanism-goal">${escapeHtml(round.goal)}</p>` : ""}
      ${round.playerAction ? `<div class="mechanism-player-action"><span>你们现在要做</span><strong>${escapeHtml(round.playerAction)}</strong></div>` : ""}
      ${decisions.map(renderMechanismDecision).join("")}
      <p class="muted small">选择由全桌讨论，主持人结算后会自动同步结果与下一轮。</p>
    </article>`;
}

function renderRoomMembers() {
  const members = state.home?.roomMembers || [];
  if (!members.length) return "";
  return `
    <article class="card members-card">
      <div class="section-head"><h3>房间成员</h3><p>${members.filter((m) => m.online).length} 人已选角色</p></div>
      <div class="member-list">
        ${members
          .map(
            (member) => `
          <div class="member-row ${member.online ? "is-online" : ""}">
            <span class="member-avatar">${escapeHtml(String(member.role_name?.[0] || "?"))}</span>
            <div>
              <strong>${escapeHtml(member.role_name)}</strong>
              <span>${member.display_name ? escapeHtml(member.display_name) : member.online ? "已加入" : "空席"}</span>
            </div>
          </div>`,
          )
          .join("")}
      </div>
    </article>`;
}

export function renderRoomMembersHtml() {
  return renderRoomMembers();
}

export function renderGameSidebar() {
  const role = state.home?.role;
  return `
        <article class="role-card-side card">
          <p class="eyebrow">你的角色</p>
          <h2>${escapeHtml(role?.name || "未选择")}</h2>
          <p>${escapeHtml(role?.private_profile || role?.public_profile || "暂无角色资料")}</p>
        </article>
        ${renderRoomMembers()}
        <div class="sidebar-actions">
          <button class="btn quiet full" type="button" data-action="leave-room">离开房间</button>
        </div>`;
}

function renderPlayableProgress() {
  const payload = state.playableRuntime;
  const view = payload?.view;
  if (!view || view.status === "NOT_STARTED") return "";
  const units = asArray(view.contentUnits);
  const clues = asArray(view.clues);
  const placements = asArray(view.placements);
  const readIds = new Set(asArray(view.readReceipts).map((r) => r.contentUnitId));
  const statusLabel =
    view.status === "FINISHED"
      ? "本局已结束"
      : escapeHtml(view.currentStageTitle || view.currentStageId || "当前幕");

  return `
    <article class="playable-progress card">
      <div class="playable-progress-head">
        <p class="eyebrow">剧本分幕 · ${escapeHtml(view.roleName || view.roleId || "")}</p>
        <h3>${statusLabel}</h3>
      </div>
      <section>
        <h4>本幕正文</h4>
        ${
          units.length
            ? units
                .map((u) => {
                  const read = readIds.has(u.id);
                  return `<div class="playable-unit"><strong>${escapeHtml(u.title || u.id)}</strong><p>${escapeHtml(u.content || "")}</p>
                    ${
                      read
                        ? `<small>已读</small>`
                        : `<button type="button" class="btn quiet compact" data-action="mark-playable-read" data-content-unit-id="${escapeHtml(u.id)}">确认已读</button>`
                    }</div>`;
                })
                .join("")
            : `<p class="muted">本幕暂无可见正文</p>`
        }
      </section>
      <section>
        <h4>已获得线索</h4>
        ${
          clues.length
            ? clues
                .map((row) => {
                  const title = row.title || row.clue?.title || row.clueId || row.clue?.id || "";
                  const body =
                    typeof row.content === "string"
                      ? row.content
                      : row.content?.content || "";
                  return `<div class="playable-clue"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>`;
                })
                .join("")
            : `<p class="muted">尚无线索</p>`
        }
      </section>
      <section>
        <h4>玩法</h4>
        ${
          placements.length
            ? placements
                .map((p) => {
                  const placementId = p.placementId || p.id;
                  const bidUi = p.canBid
                    ? `<div class="playable-bid-row"><input type="number" min="1" step="1" value="5" data-playable-bid-amount data-placement-id="${escapeHtml(placementId)}" /><button type="button" class="btn primary compact" data-action="playable-mechanism-bid" data-placement-id="${escapeHtml(placementId)}">出价</button></div>`
                    : !p.canBid && p.status !== "SETTLED" && p.status !== "RUNNING"
                      ? `<button type="button" class="btn quiet compact" disabled>暂不可运行</button>`
                      : p.outcomeSummary
                        ? `<small>${escapeHtml(p.outcomeSummary)}</small>`
                        : "";
                  return `<div class="playable-placement"><strong>${escapeHtml(p.title || placementId)}</strong><p>${escapeHtml(p.note || "")}</p>${bidUi}</div>`;
                })
                .join("")
            : `<p class="muted">本幕无玩法</p>`
        }
      </section>
    </article>`;
}

export function renderGameHome() {
  const home = state.home;
  const progress = playerProgress(home);
  const scene = currentScene(state.exploration);
  const role = home?.role;
  const next = progress.nextSection;

  return `
    <div class="home-dashboard">
      ${roomContentBindingBanner()}
      ${runtimeStateBanner()}
      ${renderPlayableProgress()}
      ${renderMechanismProgress()}
      ${renderVoiceCompact()}
      <article class="player-hero card live-flash">
        <div class="player-hero-copy">
          <p class="eyebrow">${escapeHtml(role?.name || "你的角色")} · 当前场景</p>
          <h2>${escapeHtml(scene.title)}</h2>
          <p>${escapeHtml(scene.text)}</p>
        </div>
        <div class="scene-art" aria-hidden="true">${escapeHtml(scene.art)}</div>
      </article>

      <div class="stat-grid">
        <article class="stat-card"><span>分幕进度</span><strong>${progress.sectionsCompleted} / ${progress.sectionsTotal}</strong></article>
        <article class="stat-card"><span>我的线索</span><strong>${progress.clueCount}</strong></article>
        <article class="stat-card"><span>共享线索</span><strong>${progress.sharedClueCount}</strong></article>
        <article class="stat-card"><span>背包物品</span><strong>${progress.inventoryCount}</strong></article>
      </div>

      ${renderPlayerActionsHub(home, next)}

      ${
        (state.exploration?.scenes?.length || 0) > 0
          ? `
        <button class="btn outline" type="button" data-action="switch-tab" data-tab="explore">前往探索场景（${state.exploration.scenes.length}）</button>`
          : ""
      }
    </div>`;
}

function renderPlayerActionsHub(home, nextSection) {
  const sections = home?.sections || [];
  const tasks = asArray(home?.tasks);
  const clues = home?.clues || [];
  const sharedClues = home?.sharedClues || [];
  const scenes = state.exploration?.scenes || [];
  const points = scenes.flatMap((s) =>
    (s.investigation_points || []).map((p) => ({ ...p, sceneName: s.name })),
  );
  const pending = home?.hostConfirm;
  const currentGame = state.currentGame;
  const votes = asArray(home?.activeVotes);

  const pendingTasks = tasks.filter((task) => task.status !== "completed");
  const openVotes = votes.filter(
    (vote) => vote.status === "open" && !vote.submitted_at,
  );
  const unreadSections = sections.filter((s) => !s.completed);
  const unreadClues = clues.filter((c) => !clueIsRead(c, { owned: true }));
  const unreadShared = sharedClues.filter(
    (c) => !clueIsRead(c, { owned: false }),
  );
  const unreadAllClues = [...unreadClues, ...unreadShared];
  const availablePoints = points.filter(
    (p) => !p.investigated && p.hasRequiredItem,
  );
  const blockedPoints = points.filter(
    (p) => !p.investigated && !p.hasRequiredItem && p.requiredItemName,
  );

  let primary;
  if (pendingTasks.length) {
    primary = {
      title: pendingTasks[0].body || "完成本幕任务",
      detail: pendingTasks[0].tips || "先处理未完成任务，再推进调查和讨论。",
      action: "switch-tab",
      data: 'data-tab="tasks"',
      button: "处理任务",
    };
  } else if (openVotes.length) {
    primary = {
      title: openVotes[0].title || "参与投票 / 指认",
      detail: openVotes[0].prompt || "主持人已开启投票，请先完成你的选择。",
      action: "switch-tab",
      data: 'data-tab="social"',
      button: "去投票",
    };
  } else if (pending?.waitingForYou) {
    primary = {
      title: "剧情推进等待主持确认",
      detail: "你已经触发关键节点。确认后新内容会自动刷新。",
      action: "switch-tab",
      data: 'data-tab="voice"',
      button: "进入讨论",
    };
  } else if (unreadAllClues.length) {
    primary = {
      title: `阅读线索：${unreadAllClues[0].name}`,
      detail: "标记已读后可补充解读、公开或私享给指定玩家。",
      action: "switch-tab",
      data: 'data-tab="clues"',
      button: "查看线索",
    };
  } else if (nextSection && !nextSection.completed) {
    primary = {
      title: nextSection.title || "阅读当前分幕",
      detail: `第 ${nextSection.sequence} 幕 · 尚未读完`,
      action: "goto-section",
      data: `data-section-id="${escapeHtml(nextSection.id)}"`,
      button: "继续阅读",
    };
  } else if (availablePoints.length) {
    primary = {
      title: `调查：${availablePoints[0].name}`,
      detail: `地点：${availablePoints[0].sceneName || "当前场景"}`,
      action: "switch-tab",
      data: 'data-tab="explore"',
      button: "去探索",
    };
  } else {
    primary = {
      title: "整理线索或进入语音讨论",
      detail: "当前没有必须完成的动作",
      action: "switch-tab",
      data: 'data-tab="voice"',
      button: "讨论",
    };
  }

  const serverAction = primaryRuntimeAction(home?.currentState);
  if (serverAction) {
    const targetTab = new Set([
      "home",
      "sections",
      "social",
      "explore",
      "voice",
      "clues",
      "tasks",
    ]).has(serverAction.target)
      ? serverAction.target
      : "home";
    primary = {
      title: serverAction.label,
      detail: serverAction.reason,
      action: "switch-tab",
      data: `data-tab="${escapeHtml(targetTab)}"`,
      button: "去处理",
    };
  }

  const readItems = [
    ...pendingTasks.slice(0, 2).map((t) => ({
      label: "未完成任务",
      title: t.body,
      action: "switch-tab",
      data: 'data-tab="tasks"',
    })),
    ...openVotes.slice(0, 2).map((v) => ({
      label: "待投票",
      title: v.title,
      action: "switch-tab",
      data: 'data-tab="social"',
    })),
    ...unreadSections.slice(0, 3).map((s) => ({
      label: "未读分幕",
      title: s.title || `第 ${s.sequence} 幕`,
      action: "goto-section",
      data: `data-section-id="${escapeHtml(s.id)}"`,
    })),
    ...unreadClues.slice(0, 2).map((c) => ({
      label: "未读线索",
      title: c.name,
      action: "switch-tab",
      data: 'data-tab="clues"',
    })),
    ...unreadShared.slice(0, 2).map((c) => ({
      label: "未读共享",
      title: c.name,
      action: "switch-tab",
      data: 'data-tab="clues"',
    })),
  ];
  const exploreItems = [
    ...availablePoints.slice(0, 3).map((p) => ({
      label: `可调查 · ${p.sceneName || ""}`,
      title: p.name,
      action: "switch-tab",
      data: 'data-tab="explore"',
    })),
    ...blockedPoints.slice(0, 2).map((p) => ({
      label: `需要 ${p.requiredItemName || "物品"}`,
      title: p.name,
      action: "switch-tab",
      data: 'data-tab="explore"',
    })),
  ];
  const waitItems = [];
  if (pending?.pendingCount && !pending.waitingForYou)
    waitItems.push({
      label: "确认后自动推送",
      title: `主持人处理 ${pending.pendingCount} 条待确认`,
    });
  if (currentGame && currentGame.status !== "success")
    waitItems.push({ label: "解密机关", title: "有待解决的数字锁机关" });
  if (!scenes.length)
    waitItems.push({ label: "完成阅读后解锁", title: "等待主持人开放场景" });
  if (
    !unreadSections.length &&
    !availablePoints.length &&
    !pending?.pendingCount
  )
    waitItems.push({ label: "可自由行动", title: "当前无紧急待办" });

  const renderItem = (item) =>
    item.action
      ? `<button class="action-list-item" type="button" data-action="${escapeHtml(item.action)}" ${item.data || ""}><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.title)}</b></button>`
      : `<div class="action-list-item is-static"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.title)}</b></div>`;

  return `
    <article class="next-action card">
      <div class="next-action-primary">
        <div>
          <p class="eyebrow">建议下一步</p>
          <h3>${escapeHtml(primary.title)}</h3>
          <p class="muted">${escapeHtml(primary.detail)}</p>
        </div>
        <button class="btn primary" type="button" data-action="${escapeHtml(primary.action)}" ${primary.data}>${escapeHtml(primary.button)} →</button>
      </div>
      <div class="next-action-lists">
        <div class="action-col">
          <p class="action-col-label">📖 读什么</p>
          ${readItems.length ? readItems.map(renderItem).join("") : '<p class="muted small">暂无未读内容</p>'}
        </div>
        <div class="action-col">
          <p class="action-col-label">🔍 查什么</p>
          ${exploreItems.length ? exploreItems.map(renderItem).join("") : '<p class="muted small">当前无可调查点</p>'}
        </div>
        <div class="action-col">
          <p class="action-col-label">⏳ 等什么</p>
          ${waitItems.length ? waitItems.map(renderItem).join("") : '<p class="muted small">暂无等待项</p>'}
        </div>
      </div>
    </article>`;
}

export function renderHostConfirmBannerHtml() {
  return hostNudgeBanner() + hostConfirmBanner();
}
