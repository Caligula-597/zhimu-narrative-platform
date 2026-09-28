import { boardGameCapability } from "./board-game-engine.js";

export const BOARD_GAME_MECHANISM_AXES = Object.freeze([
  { id: "timing", label: "决策时机", question: "玩家什么时候做决定？" },
  { id: "information", label: "信息结构", question: "玩家能看到什么、隐藏什么？" },
  { id: "interaction", label: "玩家关系", question: "玩家如何帮助、竞争、阻断或合作？" },
  { id: "resource", label: "资源流", question: "资源如何产生、转化、支付和枯竭？" },
  { id: "uncertainty", label: "不确定性", question: "随机、风险和未知如何改变决策？" },
  { id: "asymmetry", label: "角色差异", question: "不同席位从哪里获得差异和恢复力？" },
  { id: "space", label: "空间结构", question: "地图、路线、区域和位置是否改变价值？" },
  { id: "resolution", label: "结算逻辑", question: "冲突、竞价、集合和计分怎样落地？" },
  { id: "pacing", label: "节奏与终局", question: "回合、限时、阶段和终局如何收束？" },
  { id: "ai", label: "AI 与线上", question: "AI 能观察什么，如何在限时内作出同步决策？" }
]);

export const BOARD_GAME_MECHANISM_MATRIX = Object.freeze([
  { id: "sequential-turn", axis: "timing", name: "顺序行动", examples: "最后灯塔、议会表决", capabilityId: "phase.sequential", status: "supported", next: "补充额外行动和跨阶段反应优先级" },
  { id: "simultaneous-choice", axis: "timing", name: "同时提交后统一结算", examples: "暮环城、天穹城", capabilityId: "phase.reveal", status: "supported", next: "补充选择冲突与重新提交" },
  { id: "hand-draft", axis: "timing", name: "私有手牌轮抽", examples: "暮环城", capabilityId: "action.draft", status: "supported", next: "补充弃牌、建造与链式动作" },
  { id: "public-market-draft", axis: "timing", name: "公共市场轮抽", examples: "天穹城", capabilityId: "action.draft", status: "supported", next: "补充稀缺卡冲突与补牌策略" },
  { id: "worker-placement", axis: "timing", name: "工人放置与行动位竞争", examples: "边境工坊建设", capabilityId: "action.place", status: "supported", next: "补充占位恢复、行动位收益和多人争位" },
  { id: "action-selection-cooldown", axis: "timing", name: "循环行动与重复惩罚", examples: "派系循环控制", capabilityId: "phase.sequential", status: "partial", next: "补充复杂跳跃支付；行动冷却和基础轨道已接入" },
  { id: "private-hand", axis: "information", name: "个人隐藏手牌", examples: "暮环城、线上轮抽模板", capabilityId: "info.private", status: "supported", next: "补充多人独立设备验收" },
  { id: "hidden-objective", axis: "information", name: "隐藏目标与秘密契约", examples: "秘密远征网络", capabilityId: "info.private", status: "supported", next: "补充目标可行性评分和复杂目标组合" },
  { id: "public-tableau", axis: "information", name: "公开桌面与公开牌区", examples: "星港商路、天穹城", capabilityId: "info.public", status: "supported", next: "补充观战视角和回放差异" },
  { id: "public-blocking", axis: "interaction", name: "公开阻断", examples: "星港商路、路线竞速模板", capabilityId: "action.claim_route", status: "supported", next: "补充邻桌威胁评估" },
  { id: "auction", axis: "interaction", name: "竞价与资源争夺（通用套件）", examples: "遗迹拍卖、Power Grid、Modern Art", capabilityId: "action.bid", status: "supported", next: "最高/最低/第二价格并发结算已接入；继续补充连续拍卖的逐件资产配置" },
  { id: "vote", axis: "interaction", name: "多数表决", examples: "雾议会", capabilityId: "action.vote", status: "supported", next: "补充票权、否决和动态门槛" },
  { id: "cooperation", axis: "interaction", name: "合作与共同目标", examples: "共同防线危机", capabilityId: "action.vote", status: "partial", next: "补充团队私密信息和共同失败条件；公共投入池已接入" },
  { id: "reaction-window", axis: "interaction", name: "对手动作触发反应（通用套件）", examples: "合作危机、Root、卡牌反制", capabilityId: "timing.response_window", status: "supported", next: "最多三层嵌套、超时和外层恢复已接入；继续补充跨阶段响应优先级" },
  { id: "shared-crisis-contribution", axis: "interaction", name: "公共危机池投入", examples: "合作防线、疫情危机类桌游", capabilityId: "action.contribute", status: "supported", next: "补充团队私密信息和共同失败条件" },
  { id: "production", axis: "resource", name: "资源生产", examples: "暮环城能源、天穹城模块", capabilityId: "action.gain", status: "supported", next: "补充产能轨道和维护成本" },
  { id: "conversion", axis: "resource", name: "资源转化与支付", examples: "最后灯塔、城市引擎", capabilityId: "action.pay", status: "supported", next: "补充折扣、替代支付和邻居购买" },
  { id: "deck-cycle", axis: "resource", name: "个人牌库循环与购买", examples: "牌库城市引擎", capabilityId: "action.draw", status: "partial", next: "个人牌库、个人弃牌和洗回已接入；继续补充牌库污染、瘦身和持续牌面触发" },
  { id: "seeded-random", axis: "uncertainty", name: "可复现随机", examples: "风暴峰线", capabilityId: "random.seeded", status: "supported", next: "补充回放检验和随机公平报告" },
  { id: "push-your-luck", axis: "uncertainty", name: "风险推进与停手", examples: "风暴峰线", capabilityId: "action.roll", status: "supported", next: "补充风险牌、保底和反转" },
  { id: "asymmetric-seat", axis: "asymmetry", name: "非对称起始席位", examples: "暮环城议会", capabilityId: "info.private", status: "supported", next: "补充角色能力和能力触发时机" },
  { id: "recovery-route", axis: "asymmetry", name: "落后恢复路线", examples: "原创角色模板", capabilityId: "action.mechanism", status: "partial", next: "补充追赶、补偿与反滚雪球审计" },
  { id: "route-network", axis: "space", name: "路线网络与公共边", examples: "星港商路", capabilityId: "map.area_graph", status: "supported", next: "补充连通性、封锁和网络终局分" },
  { id: "area-control", axis: "space", name: "区域控制", examples: "待加入区域控制原型", capabilityId: "action.control", status: "supported", next: "补充多数控制、争夺和溢出" },
  { id: "destination-network", axis: "space", name: "秘密目的地与连通奖励", examples: "秘密远征网络", capabilityId: "map.area_graph", status: "partial", next: "补充路线长度、阻断、未完成惩罚和网络公平性" },
  { id: "tile-topology", axis: "space", name: "地块拓扑、旋转与连通组件（通用套件）", examples: "Carcassonne、Azul、Cascadia", capabilityId: "map.topology_placement", status: "supported", next: "方格/六角坐标邻接、旋转、边缘匹配、连通多数和标签计分已接入；继续补充溢出与具体结构完成条件" },
  { id: "majority-control", axis: "space", name: "区域多数与控制奖励", examples: "派系循环控制", capabilityId: "action.control", status: "partial", next: "补充平局、控制翻转和落后恢复" },
  { id: "grid-placement", axis: "space", name: "六角格/方格放置（通用套件）", examples: "Carcassonne、Azul、Cascadia", capabilityId: "map.hex", status: "supported", next: "运行时合法坐标、邻接与六边旋转已接入；继续补充编辑器网格渲染和图形完成条件" },
  { id: "card-effects", axis: "resolution", name: "卡牌效果与条件计算", examples: "暮环城、季节工坊", capabilityId: "action.play", status: "supported", next: "持续效果、触发器、触发日志和反制窗口已接入；继续补充复杂嵌套链" },
  { id: "standard-response-chain", axis: "resolution", name: "标准效果响应链", examples: "所有复杂卡牌和条件机制", capabilityId: "effects.response_standard", status: "supported", next: "补充领域专用牌区、战斗和市场原语" },
  { id: "card-zones", axis: "resolution", name: "牌区移动、弃牌与洗牌", examples: "Dominion、Wingspan 等牌库型作品", capabilityId: "card.zones", status: "supported", next: "补充持续效果、牌区触发和领域特定清理" },
  { id: "tableau-engine", axis: "resolution", name: "桌面引擎与连锁触发", examples: "牌库城市引擎", capabilityId: "action.play", status: "partial", next: "行动触发、轮末持续效果和可解释触发日志已接入；继续补充复杂嵌套链与卡牌专属队列" },
  { id: "set-collection", axis: "resolution", name: "集合、符号和路线计分", examples: "暮环城成长轨道", capabilityId: "action.score", status: "supported", next: "补充平方收益、集合溢价和终局计分" },
  { id: "timer-deadline", axis: "pacing", name: "阶段限时与超时托管", examples: "所有线上试玩", capabilityId: "phase.reveal", status: "supported", next: "补充补时、断线恢复和观战同步" },
  { id: "age-structure", axis: "pacing", name: "时代/章节递进", examples: "暮环城三时代", capabilityId: "phase.reveal", status: "supported", next: "补充阶段牌池和时代末结算" },
  { id: "harvest-maintenance", axis: "pacing", name: "收获、增长与维护压力", examples: "边境工坊建设", capabilityId: "phase.reveal", status: "partial", next: "补充增长和强制降级；维护支付与缺口惩罚已接入" },
  { id: "multi-era-cleanup", axis: "pacing", name: "多时代清理与阶段转换", examples: "Brass: Birmingham、7 Wonders", capabilityId: "pacing.multi_era_cleanup", status: "partial", next: "补充复杂旧效果清空和时代计分；旧牌/市场清理已接入" },
  { id: "dice-production", axis: "uncertainty", name: "骰子生产与概率供给", examples: "Catan、Stone Age", capabilityId: "random.dice_production", status: "partial", next: "补充骰面概率、资源发放、灾害和回放" },
  { id: "market-price-curve", axis: "resource", name: "供需市场价格曲线", examples: "Brass: Birmingham", capabilityId: "resource.market_curve", status: "supported", next: "补充多人并发购买和时代市场清理" },
  { id: "trade-window", axis: "interaction", name: "公开交易窗口与双方确认", examples: "Catan", capabilityId: "interaction.trade_window", status: "supported", next: "补充多人同时报价和交易过期策略" },
  { id: "combat-resolution", axis: "interaction", name: "战斗、损失与控制翻转", examples: "Root、Scythe", capabilityId: "action.combat", status: "supported", next: "补充随机战斗牌、多人战斗和完整回放" },
  { id: "faction-rule-plugin", axis: "asymmetry", name: "派系规则插件与独有胜利条件（通用套件）", examples: "Root、Scythe、Eclipse", capabilityId: "role.faction_plugin", status: "supported", next: "起始状态、行动锁、回合/终局钩子已接入；专属阶段、资源账本、弱点和复杂胜利条件通过配置扩展" },
  { id: "endgame-audit", axis: "pacing", name: "多条件终局与终局倍率审计", examples: "7 Wonders、Root、秘密目标路线", capabilityId: "score.endgame_audit", status: "partial", next: "补充终局倍率、复杂平局顺序；隐藏目标和区域多数已接入" },
  { id: "public-ai", axis: "ai", name: "公共信息 AI", examples: "星港商路、天穹城", capabilityId: "info.public", status: "supported", next: "补充威胁评估、路线预测和解释" },
  { id: "private-ai", axis: "ai", name: "隐藏手牌 AI", examples: "暮环城", capabilityId: "info.private", status: "supported", next: "补充概率推断但禁止偷看" },
  { id: "timeout-ai", axis: "ai", name: "超时 AI 代行", examples: "同步桌游运行时", capabilityId: "phase.reveal", status: "supported", next: "补充风格档位和决策日志" }
]);

export function boardGameMechanismCoverage() {
  return BOARD_GAME_MECHANISM_MATRIX.map((item) => {
    const capability = boardGameCapability(item.capabilityId);
    const status = capability.status === "supported" && item.status !== "partial" ? "supported" : item.status;
    return { ...item, status, capabilityLabel: capability.label };
  });
}

