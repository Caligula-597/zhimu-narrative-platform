/**
 * Creator dashboard aggregation — risks, production status, next actions, optional room runtime.
 * Stable card model for overview.js (B1-01).
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import {
  buildWorldSnapshot,
  ROOMS_VISIBLE_TO_ACTOR_SQL,
  storageUsage
} from "./routes/world-helpers.js";
import { fetchHostPlayers } from "./routes/host-helpers.js";
import { loadWorldPublishReadiness } from "./world-readiness-service.js";

function actionRef(action, button) {
  return { type: "action", action, ...(button ? { button } : {}) };
}

function viewRef(view, button) {
  return { type: "view", view, ...(button ? { button } : {}) };
}

function riskCard({ level, title, detail, ref, button }) {
  return { level, title, detail, ...(ref ? { ref } : {}), ...(button ? { button } : {}) };
}

function nextActionCard({ title, detail, ref, button, priority = 50 }) {
  return { title, detail, ref, button: button || "打开", priority };
}

function productionCard({ label, value, detail, done, ref, button }) {
  return { label, value, detail, done, ref, button: button || "处理" };
}

function buildProductionItems(counts, enabledRules, miniGameTemplates) {
  const {
    roles: roleCount = 0,
    sections: sectionCount = 0,
    chapters: chapterCount = 0,
    scenes: sceneCount = 0,
    clues: clueCount = 0,
    investigationPoints: pointCount = 0,
    rooms: roomCount = 0
  } = counts;

  return [
    productionCard({
      label: "基础内容",
      value: `${roleCount} 角色 / ${sectionCount} 分幕`,
      detail:
        roleCount && sectionCount
          ? "角色与私人分幕已经可进入玩家端预览。"
          : "先补齐角色席位和私人分幕。",
      done: roleCount > 0 && sectionCount > 0,
      ref: viewRef("writer", "创作"),
      button: "创作"
    }),
    productionCard({
      label: "剧情结构",
      value: `${chapterCount} 章 / ${sceneCount} 场景`,
      detail:
        chapterCount && sceneCount
          ? "公共章节和场景结构已成型。"
          : "需要补章节、场景和主线推进关系。",
      done: chapterCount > 0 && sceneCount > 0,
      ref: viewRef("studio", "编排"),
      button: "编排"
    }),
    productionCard({
      label: "调查内容",
      value: `${clueCount} 线索 / ${pointCount} 调查点`,
      detail:
        clueCount && pointCount
          ? "线索和调查点可以支撑玩家行动。"
          : "线索管理只做审稿与证据链，不再承担完整编排台。",
      done: clueCount > 0 && pointCount > 0,
      ref: viewRef("clues", "检查"),
      button: "检查"
    }),
    productionCard({
      label: "自动化规则",
      value: `${enabledRules} 条启用`,
      detail: enabledRules
        ? "规则可在运行房触发，后续补 debug trace。"
        : "建议至少配置发线索、开放场景或主持确认规则。",
      done: enabledRules > 0,
      ref: viewRef("rules", "配置"),
      button: "配置"
    }),
    productionCard({
      label: "运行房",
      value: roomCount ? `${roomCount} 个` : "未建立",
      detail: roomCount
        ? "可以进入主持端跑房和测试。"
        : "建立运行房后才能验证主持端、玩家端和规则触发。",
      done: roomCount > 0,
      ref: actionRef("world-rooms", roomCount ? "管理" : "建立"),
      button: roomCount ? "管理" : "建立"
    }),
    productionCard({
      label: "小游戏测试",
      value: `${miniGameTemplates} 模板`,
      detail: miniGameTemplates
        ? "创作者已保存数字锁模板，可在当前房间测试启动。"
        : "测试功能：先沉淀数字锁模板，再扩更多玩法。",
      done: miniGameTemplates > 0,
      ref: viewRef("miniGames", "设计"),
      button: "设计"
    })
  ];
}

function buildQuotaRisks(storage) {
  if (!storage?.max_bytes) return [];
  const quotaPct = storage.used_bytes / storage.max_bytes;
  if (quotaPct <= 0.8) return [];
  const pctLabel = Math.round(quotaPct * 100);
  const usedMb = Math.round(storage.used_bytes / 1024 / 1024);
  const maxMb = Math.round(storage.max_bytes / 1024 / 1024);
  return [
    riskCard({
      level: quotaPct > 0.95 ? "error" : "warning",
      title: "云存储空间不足",
      detail: `已用 ${pctLabel}%（约 ${usedMb} MB / ${maxMb} MB）。请清理附件或申请扩容。`,
      ref: actionRef("go-account", "管理资产"),
      button: "管理资产"
    })
  ];
}

function buildRuntimeRisks(runtime) {
  if (!runtime?.roomId) return [];
  const risks = [];
  if (runtime.pendingEvents > 5) {
    risks.push(
      riskCard({
        level: "warning",
        title: "待确认事件积压",
        detail: `${runtime.pendingEvents} 条事件等待主持端处理，可能影响玩家体验。`,
        ref: actionRef("open-host-console", "打开主持端"),
        button: "打开主持端"
      })
    );
  }
  if (runtime.stuckCount > 0) {
    risks.push(
      riskCard({
        level: "warning",
        title: `${runtime.stuckCount} 名玩家疑似卡关`,
        detail: "玩家长时间未推进剧情，建议主持端主动干预或发放线索。",
        ref: actionRef("open-host-console", "打开主持端"),
        button: "打开主持端"
      })
    );
  }
  if (!runtime.checkpointCount) {
    risks.push(
      riskCard({
        level: "warning",
        title: "运行房尚未存档",
        detail: "当前运行进度没有存档点，意外中断后无法恢复。",
        ref: actionRef("create-checkpoint", "创建存档"),
        button: "创建存档"
      })
    );
  }
  return risks;
}

function buildNextActions({
  checkErrors,
  checkWarnings,
  counts,
  enabledRules,
  miniGameTemplates,
  runtime,
  riskErrorCount
}) {
  const roleCount = counts.roles ?? 0;
  const sectionCount = counts.sections ?? 0;
  const chapterCount = counts.chapters ?? 0;
  const sceneCount = counts.scenes ?? 0;
  const clueCount = counts.clues ?? 0;
  const pointCount = counts.investigationPoints ?? 0;
  const roomCount = counts.rooms ?? 0;
  const pendingEvents = runtime?.pendingEvents ?? 0;
  const stuckCount = runtime?.stuckCount ?? 0;
  const hasActiveRoom = Boolean(runtime?.roomId);
  const hasCheckpoints = (runtime?.checkpointCount ?? 0) > 0;

  const items = [
    riskErrorCount
      ? nextActionCard({
          title: "处理发布阻塞项",
          detail: `${riskErrorCount} 项阻塞问题阻止剧本进入内测，请先在风险面板处理。`,
          ref: actionRef("creator-check", "运行发布检查"),
          button: "运行发布检查",
          priority: 10
        })
      : null,
    stuckCount > 0
      ? nextActionCard({
          title: "干预卡关玩家",
          detail: `${stuckCount} 名玩家长时间未推进剧情，建议主动发放线索或引导。`,
          ref: actionRef("open-host-console", "打开主持端"),
          button: "打开主持端",
          priority: 20
        })
      : null,
    hasActiveRoom && !hasCheckpoints
      ? nextActionCard({
          title: "为当前运行房创建存档",
          detail: "运行进度没有存档点，意外中断后无法恢复。",
          ref: actionRef("create-checkpoint", "创建存档"),
          button: "创建存档",
          priority: 25
        })
      : null,
    !roleCount || !sectionCount
      ? nextActionCard({
          title: "补齐角色与私人分幕",
          detail: "玩家端体验从角色席位和私人正文开始。",
          ref: viewRef("writer", "打开创作台"),
          button: "打开创作台",
          priority: 30
        })
      : null,
    !chapterCount || !sceneCount
      ? nextActionCard({
          title: "整理章节和场景结构",
          detail: "让主持端和玩家端知道剧情推进到哪里。",
          ref: viewRef("studio", "打开编排"),
          button: "打开编排",
          priority: 35
        })
      : null,
    !clueCount || !pointCount
      ? nextActionCard({
          title: "补线索和调查点",
          detail: "线索管理负责审稿、关联、触发条件和证据链检查。",
          ref: viewRef("clues", "打开线索"),
          button: "打开线索",
          priority: 40
        })
      : null,
    !enabledRules
      ? nextActionCard({
          title: "配置至少一条自动化规则",
          detail: "用已有后端把发线索、开场景、主持确认跑起来。",
          ref: viewRef("rules", "打开规则"),
          button: "打开规则",
          priority: 45
        })
      : null,
    !miniGameTemplates
      ? nextActionCard({
          title: "创建小游戏测试模板",
          detail: "先做数字锁模板，标注测试功能，给主持端启动。",
          ref: viewRef("miniGames", "打开小游戏"),
          button: "打开小游戏",
          priority: 50
        })
      : null,
    !roomCount
      ? nextActionCard({
          title: "建立运行房做端到端测试",
          detail: "运行房会串起主持端、玩家端、日志、复盘和规则触发。",
          ref: actionRef("world-rooms", "管理房间"),
          button: "管理房间",
          priority: 55
        })
      : null,
    pendingEvents
      ? nextActionCard({
          title: "处理主持待确认事件",
          detail: `${pendingEvents} 条事件正在等待主持端确认。`,
          ref: actionRef("open-host-console", "打开主持端"),
          button: "打开主持端",
          priority: 60
        })
      : null,
    roomCount && !pendingEvents && !riskErrorCount
      ? nextActionCard({
          title: "进入运行控制台检查现场",
          detail: "确认玩家状态、房间状态和事件日志是否正常。",
          ref: actionRef("open-host-console", "打开主持端"),
          button: "打开主持端",
          priority: 70
        })
      : null
  ]
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5)
    .map(({ priority: _priority, ...rest }) => rest);

  return items;
}

async function loadRoomRuntimeSignals(worldId, roomId, actorId) {
  const room = await query(
    `SELECT r.id, r.name, r.invite_code
     FROM rooms r
     WHERE r.id = $1 AND r.world_id = $3 AND ${ROOMS_VISIBLE_TO_ACTOR_SQL}`,
    [roomId, actorId, worldId]
  );
  if (!room.rowCount) {
    throwErr("ROOM_NOT_FOUND");
  }

  const [events, players, checkpoints, recaps] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count
       FROM pending_host_events
       WHERE room_id = $1 AND status IN ('pending', 'delayed')`,
      [roomId]
    ),
    fetchHostPlayers(query, roomId),
    query(`SELECT COUNT(*)::int AS count FROM checkpoints WHERE room_id = $1`, [roomId]),
    query(`SELECT COUNT(*)::int AS count FROM room_recaps WHERE room_id = $1`, [roomId])
  ]);

  const stuckCount = players.filter((player) => player.maybe_stuck).length;
  const progress = players.reduce(
    (acc, item) => {
      acc.completed += item.completed_sections || 0;
      acc.total += item.total_sections || 0;
      return acc;
    },
    { completed: 0, total: 0 }
  );
  const progressPercent = progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return {
    roomId,
    roomName: room.rows[0].name,
    inviteCode: room.rows[0].invite_code,
    pendingEvents: events.rows[0]?.count ?? 0,
    stuckCount,
    checkpointCount: checkpoints.rows[0]?.count ?? 0,
    recapCount: recaps.rows[0]?.count ?? 0,
    progressPercent,
    progressLabel: progress.total
      ? `${progress.completed} / ${progress.total} 段私人剧情已完成`
      : "暂无玩家进度",
    activePlayers: players.filter(
      (item) => (item.completed_sections || 0) > 0 || item.current_scene_id
    ).length
  };
}

export async function buildCreatorDashboard({ worldId, actorId, roomId = null }) {
  const [readiness, snapshot, storage] = await Promise.all([
    loadWorldPublishReadiness(worldId),
    buildWorldSnapshot(worldId),
    storageUsage(actorId)
  ]);

  const enabledRules = snapshot.rules.filter((rule) => rule.enabled).length;
  const miniGameTemplates = Array.isArray(snapshot.world?.settings?.miniGameTemplates)
    ? snapshot.world.settings.miniGameTemplates.length
    : 0;
  const counts = {
    ...readiness.summary.counts,
    enabledRules,
    miniGameTemplates
  };

  let runtime = null;
  if (roomId) {
    runtime = await loadRoomRuntimeSignals(worldId, roomId, actorId);
  }

  const checkErrors = readiness.checks.filter((item) => item.level === "error");
  const checkWarnings = readiness.checks.filter((item) => item.level === "warning");
  const checkRisks = [...checkErrors, ...checkWarnings].map((check) =>
    riskCard({
      level: check.level,
      title: check.title,
      detail: check.detail,
      ...(check.target ? { ref: { type: "target", target: check.target } } : {})
    })
  );

  const risks = [...checkRisks, ...buildRuntimeRisks(runtime), ...buildQuotaRisks(storage)];
  const riskErrorCount = risks.filter((item) => item.level === "error").length;
  const riskWarningCount = risks.filter((item) => item.level === "warning").length;

  const production = buildProductionItems(counts, enabledRules, miniGameTemplates);
  const productionDone = production.filter((item) => item.done).length;
  const productionPercent = Math.round((productionDone / production.length) * 100);

  const { readyForPlaytest, readyForCatalog } = readiness.summary;
  const readinessLabel = readyForCatalog
    ? "可申请公开库"
    : readyForPlaytest
      ? "可内测测试"
      : "尚未就绪";
  const readinessTone = readyForCatalog ? "published" : readyForPlaytest ? "testing" : "draft";

  const nextActions = buildNextActions({
    checkErrors,
    checkWarnings,
    counts,
    enabledRules,
    miniGameTemplates,
    runtime,
    riskErrorCount
  });

  return {
    worldId,
    checks: readiness.checks.map(({ level, title, detail, id, target }) => ({
      id,
      level,
      title,
      detail,
      ...(target ? { target } : {})
    })),
    summary: readiness.summary,
    counts,
    storage: {
      usedBytes: storage.used_bytes,
      maxBytes: storage.max_bytes,
      usedWorlds: storage.used_worlds,
      maxWorlds: storage.max_worlds,
      planCode: storage.plan_code,
      quotaPercent: storage.max_bytes
        ? Math.round((storage.used_bytes / storage.max_bytes) * 100)
        : null
    },
    readiness: {
      label: readinessLabel,
      tone: readinessTone,
      readyForPlaytest,
      readyForCatalog,
      productionPercent,
      productionDone,
      productionTotal: production.length
    },
    production,
    risks,
    riskSummary: {
      errorCount: riskErrorCount,
      warningCount: riskWarningCount,
      hasRisks: risks.length > 0
    },
    nextActions,
    runtime
  };
}
