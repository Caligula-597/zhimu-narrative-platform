import { throwErr } from "./api-errors.js";
import {
  loadRuntimeContentProvider,
  projectPlayerRuntimeContent,
} from "./runtime-content-provider.js";
import { loadRuntimeStateFacts } from "./repositories/runtime-current-state-repository.js";
import { projectRoomMechanismState } from "./repositories/room-mechanism-runtime-repository.js";
import { projectPlayerMechanismRuntime } from "../../shared/mechanism-runtime.js";

function action(key, label, priority, target, reason) {
  return { key, label, priority, target, reason };
}

function blocker(key, label, severity, target) {
  return { key, label, severity, target };
}

function playerState({ provider, facts, knowledge, mechanism }) {
  const suggestions = [];
  const blockers = [];
  const frozenContent =
    !knowledge && provider.isFrozen
      ? projectPlayerRuntimeContent(provider, {
          roleSlotId: facts.roleSlotId,
          progress: facts.player_progress ?? [],
          unlockedSectionIds: facts.unlocked_section_ids ?? [],
        })
      : null;
  const summary = knowledge?.summary ?? {
    completedSections: provider.isFrozen
      ? frozenContent.sections.filter((section) => section.completed).length
      : Number(facts.live_completed_sections) || 0,
  };
  const sections =
    knowledge?.sections ??
    frozenContent?.sections ??
    (facts.live_next_section_title
      ? [{ title: facts.live_next_section_title, completed: false }]
      : []);
  const nextSection = sections.find((section) => !section.completed);

  if (mechanism?.stale) {
    blockers.push(
      blocker(
        "mechanism_stale",
        "主持人正在同步新的剧情机制版本",
        "warning",
        "home",
      ),
    );
  } else if (mechanism?.status === "running" && mechanism.currentRound) {
    suggestions.push(
      action(
        "follow_mechanism_round",
        mechanism.currentRound.playerAction ||
          `参与第 ${mechanism.currentRound.sequence} 轮剧情`,
        1,
        "home",
        mechanism.currentRound.goal ||
          "主持人推进后，本轮结果会自动同步到玩家端",
      ),
    );
  }

  if (provider.room.status === "paused") {
    blockers.push(
      blocker("room_paused", "房间已暂停，等待主持人恢复", "warning", "home"),
    );
  } else if (facts.active_game) {
    suggestions.push(
      action(
        "continue_game",
        "继续当前小游戏",
        1,
        "home",
        "房间内有正在进行的互动机关",
      ),
    );
  } else if (Number(facts.player_open_votes) > 0) {
    suggestions.push(
      action(
        "submit_vote",
        "完成当前投票",
        1,
        "social",
        "你还有尚未提交的公开投票",
      ),
    );
  } else if (nextSection) {
    suggestions.push(
      action(
        "read_section",
        `继续阅读《${nextSection.title}》`,
        1,
        "sections",
        "这是当前已开放且未完成的分幕",
      ),
    );
  } else if (Number(summary.investigations) === 0) {
    suggestions.push(
      action(
        "explore_scene",
        "查看可探索场景",
        2,
        "explore",
        "阅读完成后可继续收集调查结果",
      ),
    );
  } else {
    suggestions.push(
      action(
        "discuss",
        "整理线索并参与讨论",
        3,
        "voice",
        "当前没有必须立即完成的系统动作",
      ),
    );
  }
  if (Number(facts.pending_host_events) > 0) {
    blockers.push(
      blocker("host_confirmation", "有剧情节点等待主持人确认", "info", "home"),
    );
  }

  return {
    phase:
      provider.room.status === "completed"
        ? {
            key: "completed",
            label: "本场已结束",
            detail: "可查看复盘与个人记录",
          }
        : provider.room.status === "paused"
          ? { key: "paused", label: "房间暂停", detail: "当前进度已保留" }
          : facts.active_game
            ? {
                key: "interaction",
                label: "互动进行中",
                detail: facts.active_game.title || "小游戏进行中",
              }
            : {
                key: "playing",
                label: "剧情进行中",
                detail: nextSection?.title || "自由调查与讨论",
              },
    suggestions,
    blockers,
  };
}

function sameMechanismBinding(state, provider) {
  if (!state) return true;
  return (
    state.contentBindingMode === provider.contentBinding.mode &&
    String(state.contentReleaseId ?? "") ===
      String(provider.contentBinding.release?.id ?? "") &&
    state.sourceContentRevision === Number(provider.sourceRevision)
  );
}

function mechanismState(provider, facts) {
  const packageValue = provider.snapshot?.mechanismPackage ?? null;
  if (!packageValue) return null;
  const persisted = projectRoomMechanismState(facts.mechanism_state);
  return projectPlayerMechanismRuntime(
    persisted?.runtime ?? null,
    packageValue,
    {
      revision: persisted?.revision ?? 0,
      stale: persisted ? !sameMechanismBinding(persisted, provider) : false,
      updatedAt: persisted?.updatedAt ?? null,
      roundStartedAt: persisted?.roundStartedAt ?? null,
      ownSubmissions: facts.mechanism_submissions ?? [],
    },
  );
}

function hostState({ provider, facts, stuckCount = 0 }) {
  const suggestions = [];
  const blockers = [];
  const joined = Number(facts.joined_players) || 0;
  const total = Number(facts.total_roles) || 0;
  const pending = Number(facts.pending_host_events) || 0;

  if (pending)
    suggestions.push(
      action(
        "review_events",
        `处理 ${pending} 条待确认事件`,
        1,
        "host-events",
        "待确认事件会阻塞自动推进",
      ),
    );
  if (stuckCount)
    suggestions.push(
      action(
        "help_stuck_players",
        `处理 ${stuckCount} 名疑似卡关玩家`,
        1,
        "players",
        "玩家进度长时间没有变化",
      ),
    );
  if (joined < total)
    suggestions.push(
      action(
        "invite_players",
        `邀请剩余 ${Math.max(total - joined, 0)} 名玩家`,
        2,
        "invite",
        "还有角色席位未进入房间",
      ),
    );
  if (!suggestions.length)
    suggestions.push(
      action(
        "create_checkpoint",
        "创建当前进度存档",
        3,
        "checkpoint",
        "关键推进后保存恢复点",
      ),
    );
  if (provider.room.status === "paused")
    blockers.push(
      blocker("room_paused", "房间处于暂停状态", "warning", "room"),
    );

  return {
    phase:
      provider.room.status === "completed"
        ? {
            key: "completed",
            label: "本场已结束",
            detail: "可生成复盘与运行报告",
          }
        : facts.active_game
          ? {
              key: "interaction",
              label: "小游戏进行中",
              detail: facts.active_game.title || "等待玩家提交",
            }
          : pending
            ? {
                key: "host_confirmation",
                label: "等待主持确认",
                detail: `${pending} 条事件待处理`,
              }
            : joined < total
              ? {
                  key: "lobby",
                  label: "等待玩家入场",
                  detail: `${joined}/${total} 个角色已进入`,
                }
              : {
                  key: "running",
                  label: "房间运行中",
                  detail: "玩家已就绪，可继续推进",
                },
    suggestions,
    blockers,
  };
}

function creatorState({ provider, facts }) {
  const suggestions = [];
  const blockers = [];
  const binding = provider.contentBinding;
  const joined = Number(facts.joined_players) || 0;

  if (!binding.isFrozen) {
    suggestions.push(
      action(
        "publish_release",
        "发布并绑定稳定版本",
        1,
        "releases",
        "实时草稿修改会影响测试房内容",
      ),
    );
    blockers.push(
      blocker(
        "live_draft_room",
        "当前房间仍跟随实时草稿",
        "warning",
        "releases",
      ),
    );
  } else if (binding.hasNewerDraft) {
    suggestions.push(
      action(
        "review_newer_draft",
        "检查草稿与运行版本差异",
        2,
        "releases",
        "当前房间继续使用旧发布版本",
      ),
    );
  }
  if (joined || Number(facts.pending_host_events)) {
    suggestions.push(
      action(
        "open_host",
        "进入主持端查看实时运行",
        1,
        "host",
        "该房间已有运行活动",
      ),
    );
  } else {
    suggestions.push(
      action(
        "invite_testers",
        "邀请测试玩家进入房间",
        2,
        "invite",
        "当前还没有玩家入场",
      ),
    );
  }

  return {
    phase:
      provider.room.status === "completed"
        ? {
            key: "completed",
            label: "测试已完成",
            detail: "可查看复盘与影响范围",
          }
        : joined
          ? {
              key: "playtest",
              label: "测试运行中",
              detail: `${joined} 名玩家已进入`,
            }
          : {
              key: "setup",
              label: "等待开场",
              detail: "房间已创建，尚无玩家活动",
            },
    suggestions,
    blockers,
  };
}

export async function buildRuntimeCurrentState({
  roomId,
  audience,
  provider: providedProvider = null,
  roleSlotId = null,
  knowledge = null,
  stuckCount = 0,
  now = Date.now(),
  runQuery,
}) {
  const queryOptions = runQuery ? { runQuery } : {};
  const provider =
    providedProvider ??
    (await loadRuntimeContentProvider(roomId, {
      ...queryOptions,
      includeLiveSnapshot: true,
    }));
  if (!provider) throwErr("ROOM_NOT_FOUND");
  const facts = await loadRuntimeStateFacts({ roomId, roleSlotId }, runQuery);
  facts.roleSlotId = roleSlotId;
  if (provider.isFrozen)
    facts.total_roles = provider.collection("roles").length;
  const mechanism = mechanismState(provider, facts);
  const audienceState =
    audience === "player"
      ? playerState({ provider, facts, knowledge, mechanism })
      : audience === "host"
        ? hostState({ provider, facts, stuckCount })
        : creatorState({ provider, facts });

  return {
    audience,
    roomId,
    worldId: provider.worldId,
    phase: audienceState.phase,
    suggestedActions: audienceState.suggestions,
    blockers: audienceState.blockers,
    mechanism,
    syncState: {
      status: "synced",
      runtimeSource: provider.runtimeSource,
      isFrozen: provider.isFrozen,
      serverCursor: Number(facts.server_cursor) || 0,
      generatedAt: new Date(
        typeof now === "function" ? now() : now,
      ).toISOString(),
    },
    metrics: {
      joinedPlayers: Number(facts.joined_players) || 0,
      totalRoles: Number(facts.total_roles) || 0,
      pendingHostEvents: Number(facts.pending_host_events) || 0,
      pendingPrivateActions: Number(facts.pending_private_actions) || 0,
      openVotes: Number(facts.open_votes) || 0,
      activeGame: Boolean(facts.active_game),
      ...(knowledge?.summary ?? {}),
    },
  };
}
