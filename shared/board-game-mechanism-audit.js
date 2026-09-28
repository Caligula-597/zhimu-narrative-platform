import { BOARD_GAME_ENGINE_CAPABILITIES, boardGameCapability } from "./board-game-engine.js";
import { BOARD_GAME_MECHANISM_MODULES, composeBoardGameMechanisms } from "./board-game-mechanism-composer.js";
import { BOARD_GAME_MECHANISM_MATRIX, boardGameMechanismCoverage } from "./board-game-mechanism-matrix.js";
import { COMMERCIAL_MECHANISM_BENCHMARKS } from "./commercial-mechanism-benchmarks.js";
import { COMMERCIAL_MECHANISM_DECOMPOSITIONS } from "./commercial-mechanism-decompositions.js";
import { universalKitStatus } from "./board-game-universal-kits.js";

const countBy = (items, key) => items.reduce((result, item) => {
  const value = typeof key === "function" ? key(item) : item[key];
  result[value] = (result[value] || 0) + 1;
  return result;
}, {});

const clone = (value) => structuredClone(value);

export const BOARD_GAME_REPLICATION_LEVELS = Object.freeze([
  "mechanism_supported",
  "mechanism_partial",
  "decomposition_only",
  "exact_commercial_replication"
]);

export function createBoardGameMechanismAudit() {
  const coverage = boardGameMechanismCoverage();
  const capabilityStatus = countBy(BOARD_GAME_ENGINE_CAPABILITIES, "status");
  const matrixStatus = countBy(coverage, "status");
  const moduleStatus = countBy(BOARD_GAME_MECHANISM_MODULES, (module) => module.runtimeStatus || "supported");
  const decompositions = COMMERCIAL_MECHANISM_DECOMPOSITIONS.map((item) => {
    const composition = composeBoardGameMechanisms(item.requiredModules);
    const missingCapabilities = item.missingModules.map((id) => ({ id, status: "not_registered", label: id }));
    return {
      id: item.id,
      sourceGame: item.sourceGame,
      level: item.implementationStatus === "decomposition_only" ? "decomposition_only" : "mechanism_partial",
      compositionReady: composition.ready,
      compositionImplementationStatus: composition.implementationStatus,
      requiredModuleCount: item.requiredModules.length,
      missingModuleCount: item.missingModules.length,
      missingCapabilities,
      blockers: item.knownGaps,
      responseContractReady: item.requiredModules.includes("effects.response_standard")
    };
  });
  const benchmarkAudit = COMMERCIAL_MECHANISM_BENCHMARKS.map((item) => ({
    id: item.id,
    sourceGame: item.sourceGame,
    level: "mechanism_partial",
    hasOriginalContent: true,
    hasAiRunner: true,
    note: "已有原创数据和 AI 基准局，但不是商业作品内容的逐项复刻。"
  }));
  return {
    generatedAt: new Date().toISOString(),
    mechanismInventory: {
      matrixCount: BOARD_GAME_MECHANISM_MATRIX.length,
      coverage,
      status: matrixStatus,
      capabilityStatus,
      moduleStatus
    },
    universalKits: universalKitStatus(),
    commercialStudies: {
      decompositionCount: decompositions.length,
      decompositions,
      runnableBenchmarkCount: benchmarkAudit.length,
      benchmarks: benchmarkAudit
    },
    replicationConclusion: {
      exactCommercialReplication: false,
      coreMechanismReimplementation: "conditional",
      originalContentOnlineGame: "yes_for_supported_and_adapter_backed_partial_mechanisms",
      responseLayer: "standardized",
      reasons: [
        "现有六个商业机制基准局是原创数据的机制抽象，不是商业作品的完整内容复刻。",
        "新增六款研究记录已经完成机制拆解，牌区、交易、市场和基础战斗原语已接入；仍缺少逐款商业规则所需的领域特化语义。",
        "效果响应层已经统一，但领域专用效果仍必须在同一响应链上注册、编译和测试。",
        "要称为完美复刻，还需要逐项锁定卡牌、组件、费用、阶段、隐藏信息、终局和平局规则，并完成 AI 与人工对局验收。"
      ],
      nextGates: [
        "拓扑与网格语义：溢出、图形完成计分；六角/方格合法位置、连通组件与组件多数已接入通用套件",
        "持续与节奏语义：复杂嵌套桌面链、收获维护、时代清理和资产迁移；基础行动/轮末触发已接入",
        "派系与终局语义：派系专属阶段、资源账本、隐藏目标、倍率和平局裁决；通用派系钩子已接入",
        "多人并发语义：市场并发购买、报价过期和跨阶段反应优先级；并发竞价与多层响应已接入通用套件",
        "逐款原创基准局：每款至少 3 局 AI 全局、响应审计、私密边界和公平性报告"
      ]
    }
  };
}

export function assertBoardGameMechanismAudit(audit = createBoardGameMechanismAudit()) {
  if (!audit.replicationConclusion.responseLayer || audit.replicationConclusion.exactCommercialReplication) {
    throw new Error("桌游复刻审计结论不符合当前内容边界。");
  }
  for (const item of audit.commercialStudies.decompositions) {
    if (!item.compositionReady || !item.responseContractReady) throw new Error(`机制拆解「${item.id}」没有通过标准响应组合检查。`);
  }
  return clone(audit);
}
