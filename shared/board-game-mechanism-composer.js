const clone = (value) => structuredClone(value);

export const BOARD_GAME_MECHANISM_MODULES = Object.freeze([
  { id: "timing.sequential", axis: "timing", label: "顺序行动", slot: "turn", provides: ["phase.sequential", "state.activeSeat"], requires: [], conflicts: [], description: "按席位顺序提交并结算。" },
  { id: "timing.reveal", axis: "timing", label: "同时提交后揭示", slot: "turn", provides: ["phase.reveal", "state.submissions"], requires: [], conflicts: [], description: "所有席位提交后统一公开和结算。" },
  { id: "draft.hand", axis: "timing", label: "私有手牌轮抽", slot: "draft", provides: ["cards.private_hand", "cards.pass"], requires: ["timing.reveal", "online.viewer_projection"], conflicts: [], description: "从个人手牌选牌，剩余手牌按方向传递。" },
  { id: "draft.market", axis: "timing", label: "公共市场轮抽", slot: "draft", provides: ["cards.public_market"], requires: ["timing.reveal"], conflicts: [], description: "从公共市场选牌并在统一结算后补牌。" },
  { id: "info.public", axis: "information", label: "公共桌面", slot: "visibility", provides: ["info.public"], requires: [], conflicts: [], description: "状态和已完成内容对全桌公开。" },
  { id: "info.private.hand", axis: "information", label: "个人隐藏信息", slot: "visibility", provides: ["info.private", "online.viewer_projection"], requires: ["online.command_server"], conflicts: [], description: "每个席位只读取自己的手牌或秘密目标。" },
  { id: "interaction.trade", axis: "interaction", label: "交易与资源购买", slot: "interaction", provides: ["interaction.trade"], requires: ["resource.currency"], conflicts: [], description: "玩家之间可以交换或购买资源。" },
  { id: "interaction.auction", axis: "interaction", label: "竞价", slot: "interaction", provides: ["interaction.auction", "auction.concurrent", "auction.second_price"], requires: ["resource.currency", "timing.reveal"], conflicts: [], runtimeStatus: "supported", universalKit: "sealed-auction", description: "并发收集公开或秘密报价，支持最高价、最低价、第二价格、轮转平局和同目标冲突校验。" },
  { id: "interaction.vote", axis: "interaction", label: "表决", slot: "interaction", provides: ["interaction.vote"], requires: ["timing.reveal"], conflicts: [], description: "统一收集票型并按多数或门槛结算。" },
  { id: "interaction.conflict", axis: "interaction", label: "冲突比较", slot: "interaction", provides: ["interaction.conflict"], requires: ["score.comparison"], conflicts: [], description: "比较相邻或指定对手的力量并结算差额。" },
  { id: "resource.production", axis: "resource", label: "资源生产", slot: "economy", provides: ["resource.production"], requires: [], conflicts: [], description: "通过卡牌、区域或角色产生可持续资源。" },
  { id: "resource.currency", axis: "resource", label: "货币与支付", slot: "economy", provides: ["resource.currency", "action.pay"], requires: [], conflicts: [], description: "用货币支付、购买、竞价或转换。" },
  { id: "card.play", axis: "resolution", label: "卡牌打出与效果", slot: "cards", provides: ["cards.play", "effects.trigger"], requires: [], conflicts: [], description: "把牌转成公开桌面、状态变化或持续能力。" },
  { id: "effects.response_standard", axis: "resolution", label: "标准效果响应链", slot: "cards", provides: ["effects.response_audit", "effects.atomic", "effects.timing_queue", "effects.conditions", "effects.chain"], requires: ["online.command_server"], conflicts: [], runtimeStatus: "supported", description: "统一处理目标、条件、优先级、时机、重复、连锁、可见性与原子写入边界；卡牌、行动、市场和地图效果都通过同一审计链。" },
  { id: "timing.response_window", axis: "timing", label: "玩家反应窗口", slot: "turn", provides: ["timing.response_window", "timing.nested_response", "online.deadline", "online.timeout_default"], requires: ["timing.sequential", "online.command_server", "online.viewer_projection"], conflicts: [], runtimeStatus: "supported", universalKit: "nested-response", description: "行动结算后按席位开放有限时反应，支持最多三层嵌套窗口、外层恢复、超时默认动作和同步审计。" },
  { id: "cards.zones", axis: "resolution", label: "统一牌区转移", slot: "cards", provides: ["cards.deck", "cards.discard", "cards.tableau", "cards.remove", "cards.reshuffle"], requires: ["card.play", "online.command_server"], conflicts: [], runtimeStatus: "supported", description: "统一管理牌库、手牌、弃牌、桌面和移除区，支持洗回弃牌堆与逐条转移审计。" },
  { id: "cards.chain", axis: "resolution", label: "卡牌链与免费建造", slot: "cards", provides: ["cards.chain"], requires: ["card.play", "pacing.age"], conflicts: [], description: "前置卡解锁后续卡的免费或折扣建造。" },
  { id: "score.comparison", axis: "resolution", label: "比较计分", slot: "scoring", provides: ["score.comparison"], requires: [], conflicts: [], description: "按多数、邻接、领先或差额计分。" },
  { id: "score.collection", axis: "resolution", label: "集合与终局计分", slot: "scoring", provides: ["score.collection"], requires: ["card.play"], conflicts: [], description: "符号、标签、路线或套组在终局转成分数。" },
  { id: "space.route", axis: "space", label: "路线网络", slot: "space", provides: ["map.route", "space.adjacency"], requires: ["info.public"], conflicts: [], description: "公共路线的占领、连通和阻断改变价值。" },
  { id: "space.area", axis: "space", label: "区域控制", slot: "space", provides: ["map.area", "space.majority"], requires: ["info.public", "score.comparison"], conflicts: [], description: "用单位或影响力争夺区域控制权。" },
  { id: "space.tile_topology", axis: "space", label: "地块拓扑放置", slot: "space", provides: ["map.tile", "space.adjacency", "space.connected_component", "space.hex_geometry", "space.square_geometry", "score.tile_majority"], requires: ["info.public", "online.command_server"], conflicts: [], runtimeStatus: "supported", universalKit: "grid-geometry", description: "将地块作为原子对象放入空位置，支持方格/六角坐标邻接、旋转、边缘匹配、连通组件和终局多数计分。" },
  { id: "uncertainty.seeded", axis: "uncertainty", label: "可复现随机", slot: "random", provides: ["random.seeded"], requires: [], conflicts: [], description: "服务器掌握可回放的随机序列。" },
  { id: "random.dice_production", axis: "uncertainty", label: "骰子生产", slot: "random", provides: ["random.dice", "resource.production_by_roll"], requires: ["uncertainty.seeded", "resource.production", "effects.response_standard"], conflicts: [], runtimeStatus: "supported", description: "记录骰面、总点数和按区间向自己或全体席位发放资源的规则。" },
  { id: "uncertainty.push", axis: "uncertainty", label: "风险推进与停手", slot: "random", provides: ["risk.push_stop"], requires: ["uncertainty.seeded", "score.comparison"], conflicts: [], description: "继续行动提高收益与风险，停手锁定当前收益。" },
  { id: "role.asymmetry", axis: "asymmetry", label: "非对称角色", slot: "role", provides: ["role.asymmetry", "state.player_scope"], requires: [], conflicts: [], description: "不同席位拥有不同起始倾向或能力。" },
  { id: "role.faction_plugin", axis: "asymmetry", label: "派系规则插件", slot: "role", provides: ["role.faction_rules", "role.private_accounting", "role.round_hook", "role.end_hook"], requires: ["role.asymmetry", "effects.response_standard"], conflicts: [], runtimeStatus: "supported", universalKit: "faction-plugin", description: "通用插件支持派系起始数值、旗标、行动锁、轮末钩子和终局钩子；专属阶段和复杂胜利条件通过配置扩展。" },
  { id: "pacing.age", axis: "pacing", label: "时代/章节递进", slot: "pacing", provides: ["pacing.age", "state.round"], requires: [], conflicts: [], description: "牌池、规则或目标随时代推进。" },
  { id: "pacing.multi_era_cleanup", axis: "pacing", label: "多时代清理", slot: "pacing", provides: ["pacing.cleanup", "pacing.asset_migration"], requires: ["pacing.age", "effects.response_standard"], runtimeStatus: "supported", conflicts: [], description: "在声明的回合间隔清理旧牌、公共市场和阶段资产，并写入时代审计。" },
  { id: "pacing.timer", axis: "pacing", label: "限时与超时托管", slot: "pacing", provides: ["pacing.timer", "online.timeout_ai"], requires: ["online.command_server"], conflicts: [], description: "每个同步窗口都有截止时间和默认行为。" },
  { id: "online.viewer_projection", axis: "ai", label: "按席位视图投影", slot: "online", provides: ["online.viewer_projection"], requires: ["online.command_server"], conflicts: [], description: "公共状态与席位私有状态分开投影。" },
  { id: "online.command_server", axis: "ai", label: "服务器权威命令", slot: "online", provides: ["online.command_server", "online.idempotency"], requires: [], conflicts: [], description: "所有改变状态的命令由服务器校验和去重。" },
  { id: "ai.public_policy", axis: "ai", label: "公共信息 AI", slot: "ai", provides: ["ai.public_policy"], requires: ["online.command_server"], conflicts: [], description: "AI 只能依据公共状态和自己的私有状态决策。" },
  { id: "interaction.trade_window", axis: "interaction", label: "交易确认窗口", slot: "interaction", provides: ["interaction.trade_window", "resource.atomic_transfer"], requires: ["resource.currency", "online.command_server", "effects.response_standard"], conflicts: [], runtimeStatus: "supported", description: "按双方确认原子转移资源，交易失败时不写入半个状态。" },
  { id: "resource.market_curve", axis: "resource", label: "供需市场曲线", slot: "economy", provides: ["market.inventory", "market.price_curve"], requires: ["resource.currency", "effects.response_standard"], conflicts: [], runtimeStatus: "supported", description: "库存、价格上下限、供给修正、补货顺序和购买动作进入统一市场响应链。" },
  { id: "interaction.combat_resolution", axis: "interaction", label: "战斗结算", slot: "interaction", provides: ["combat.damage", "combat.loss", "combat.control_flip"], requires: ["interaction.conflict", "effects.response_standard"], conflicts: [], runtimeStatus: "supported", description: "统一记录攻防修正、护盾、损失、得分、撤退和控制变化。" },
  { id: "score.endgame_audit", axis: "resolution", label: "终局审计", slot: "scoring", provides: ["score.endgame_conditions", "score.tie_break"], requires: ["score.comparison", "effects.response_standard"], conflicts: [], runtimeStatus: "partial", description: "已接入隐藏目标、区域多数和终局审计日志；倍率、复杂平局顺序仍需逐款配置。" },
  { id: "placement.worker", axis: "interaction", label: "工人放置与占位", slot: "placement", provides: ["placement.worker", "state.occupancy", "action.exclusive_space"], requires: ["timing.sequential", "info.public"], conflicts: [], runtimeStatus: "partial", description: "有限行动位上的先到先得占位，位置被占用后改变其他席位的选择空间。" },
  { id: "deckbuilding.cycle", axis: "resolution", label: "个人牌库循环", slot: "cards", provides: ["deck.personal", "deck.discard", "deck.shuffle_on_empty", "action.buy"], requires: ["card.play", "resource.currency", "online.viewer_projection"], conflicts: [], runtimeStatus: "partial", description: "已支持每席位独立牌库、个人弃牌、购买后入个人弃牌和个人洗回；完整牌型持续触发、清理阶段和污染/瘦身规则仍需逐款配置。" },
  { id: "objective.hidden", axis: "information", label: "隐藏目标与契约", slot: "visibility", provides: ["objective.private"], requires: ["online.viewer_projection"], conflicts: [], runtimeStatus: "supported", description: "每个席位持有不公开目标，满足条件后一次性计分并写入终局审计。" },
  { id: "route.destination", axis: "space", label: "目的地路线目标", slot: "space", provides: ["objective.destination", "score.connection"], requires: ["space.route", "objective.private", "score.collection"], conflicts: [], runtimeStatus: "partial", description: "秘密连接目标与公共路线占领绑定，完成连接得分，未完成承担终局损失。" },
  { id: "cooperation.crisis", axis: "interaction", label: "合作危机与共同失败", slot: "cooperation", provides: ["cooperation.shared_goal", "cooperation.loss_clock", "state.shared_board"], requires: ["timing.reveal", "info.public", "uncertainty.seeded"], conflicts: [], runtimeStatus: "supported", description: "玩家共同投入公共池，状态可同步审计；共同失败阈值由终局条件配置。" },
  { id: "engine.tableau", axis: "resolution", label: "桌面引擎与连锁触发", slot: "cards", provides: ["engine.tableau", "effects.reaction_chain", "effects.trigger_log"], requires: ["card.play", "resource.production"], conflicts: [], runtimeStatus: "partial", description: "公开部署的卡牌可在行动或轮次结束触发效果，持续效果进入统一响应链并写入可回放触发日志；复杂嵌套链仍需逐款配置。" },
  { id: "maintenance.harvest", axis: "pacing", label: "收获与维护压力", slot: "pacing", provides: ["pacing.harvest", "resource.upkeep", "resource.growth"], requires: ["resource.production", "pacing.age"], conflicts: [], runtimeStatus: "supported", description: "回合边界自动执行维护支付、缺口惩罚并写入维护日志。" },
  { id: "action.rondel", axis: "timing", label: "循环行动选择", slot: "turn", provides: ["action.selection", "action.cooldown"], requires: ["timing.sequential", "role.asymmetry"], conflicts: [], runtimeStatus: "supported", description: "行动可声明冷却回合和轨道步进，重复行动会被服务器拒绝。" },
  { id: "majority.area", axis: "space", label: "区域多数与控制奖励", slot: "space", provides: ["score.majority", "control.momentum"], requires: ["space.area", "score.comparison", "info.public"], conflicts: [], runtimeStatus: "supported", description: "按区域单位影响力计算多数、平局模式和终局奖励。" },
  { id: "reaction.opponent", axis: "interaction", label: "对手触发式反应", slot: "interaction", provides: ["effects.reaction", "interaction.counterplay"], requires: ["card.play", "info.public", "timing.response_window"], conflicts: [], runtimeStatus: "supported", description: "对手完成指定公开动作后开启有限时响应，允许放弃、反制或打出响应牌，超时走默认行为。" }
]);

const MODULE_BY_ID = new Map(BOARD_GAME_MECHANISM_MODULES.map((module) => [module.id, module]));

export const BOARD_GAME_MECHANISM_COMPOSITION_RECIPES = Object.freeze([
  {
    id: "city-engine-draft",
    label: "城市轮抽引擎",
    modules: ["timing.reveal", "draft.hand", "info.public", "resource.production", "resource.currency", "card.play", "effects.response_standard", "cards.chain", "score.collection", "role.asymmetry", "pacing.age", "pacing.timer", "online.command_server", "online.viewer_projection", "ai.public_policy"]
  },
  {
    id: "route-auction-race",
    label: "路线竞价竞速",
    modules: ["timing.reveal", "info.public", "interaction.auction", "resource.production", "resource.currency", "space.route", "score.comparison", "pacing.timer", "online.command_server", "ai.public_policy"]
  },
  {
    id: "cooperative-storm",
    label: "合作危机挑战",
    modules: ["timing.reveal", "info.public", "info.private.hand", "resource.production", "uncertainty.seeded", "uncertainty.push", "score.comparison", "pacing.timer", "online.command_server", "online.viewer_projection", "ai.public_policy"]
  },
  {
    id: "political-control",
    label: "政治区域控制",
    modules: ["timing.sequential", "timing.reveal", "info.public", "interaction.trade", "interaction.vote", "interaction.conflict", "resource.production", "resource.currency", "space.area", "score.comparison", "role.asymmetry", "pacing.age", "online.command_server", "ai.public_policy"]
  },
  {
    id: "frontier-workers",
    label: "边境工坊建设",
    modules: ["timing.sequential", "info.public", "placement.worker", "resource.production", "resource.currency", "card.play", "effects.response_standard", "maintenance.harvest", "role.asymmetry", "pacing.age", "pacing.timer", "online.command_server", "ai.public_policy"]
  },
  {
    id: "deck-city",
    label: "牌库城市引擎",
    modules: ["timing.sequential", "info.public", "online.viewer_projection", "card.play", "effects.response_standard", "cards.zones", "deckbuilding.cycle", "engine.tableau", "resource.production", "resource.currency", "score.collection", "pacing.age", "pacing.timer", "online.command_server", "ai.public_policy"]
  },
  {
    id: "expedition-network",
    label: "秘密远征网络",
    modules: ["timing.reveal", "info.public", "online.viewer_projection", "objective.hidden", "space.route", "route.destination", "card.play", "effects.response_standard", "score.collection", "score.comparison", "uncertainty.seeded", "pacing.timer", "online.command_server", "ai.public_policy"]
  },
  {
    id: "cooperative-outbreak",
    label: "共同防线危机",
    modules: ["timing.reveal", "info.public", "info.private.hand", "cooperation.crisis", "resource.production", "uncertainty.seeded", "pacing.timer", "online.command_server", "online.viewer_projection", "ai.public_policy"]
  },
  {
    id: "factional-rondel",
    label: "派系循环控制",
    modules: ["timing.sequential", "info.public", "action.rondel", "interaction.conflict", "resource.production", "space.area", "majority.area", "score.comparison", "role.asymmetry", "pacing.age", "online.command_server", "ai.public_policy"]
  }
]);

function issue(level, code, message, modules = []) {
  return { level, code, message, modules };
}

export function composeBoardGameMechanisms(moduleIds = [], options = {}) {
  const ids = [...new Set((Array.isArray(moduleIds) ? moduleIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
  const modules = ids.map((id) => MODULE_BY_ID.get(id)).filter(Boolean);
  const issues = [];
  ids.filter((id) => !MODULE_BY_ID.has(id)).forEach((id) => issues.push(issue("error", "MODULE_UNKNOWN", `未知机制模块「${id}」。`, [id])));
  const selected = new Set(modules.map((module) => module.id));
  const capabilities = new Set(modules.flatMap((module) => module.provides));
  for (const module of modules) {
    const missing = module.requires.filter((requirement) => !selected.has(requirement) && !capabilities.has(requirement) && !options.externalCapabilities?.includes(requirement));
    if (missing.length) issues.push(issue("error", "MODULE_REQUIREMENT_MISSING", `「${module.label}」缺少前置能力：${missing.join("、")}。`, [module.id, ...missing]));
    const conflicts = module.conflicts.filter((conflict) => selected.has(conflict));
    if (conflicts.length) issues.push(issue("error", "MODULE_CONFLICT", `「${module.label}」与「${conflicts.join("、")}」不能放在同一结算窗口。`, [module.id, ...conflicts]));
  }
  const slots = new Map();
  for (const module of modules) {
    if (!slots.has(module.slot)) slots.set(module.slot, []);
    slots.get(module.slot).push(module.id);
  }
  const duplicatedSlots = [...slots.entries()].filter(([, values]) => values.length > 1 && ["turn", "draft"].includes(values[0] && MODULE_BY_ID.get(values[0])?.slot));
  duplicatedSlots.forEach(([slot, values]) => issues.push(issue("warning", "MODULE_PHASE_MULTIPLE", `「${slot}」包含多个模块，需要明确它们位于不同阶段还是同一窗口。`, values)));
  if (selected.has("interaction.trade") && !selected.has("info.public")) issues.push(issue("warning", "TRADE_VISIBILITY", "交易模块缺少公共资源可见性，线上 UI 需要明确哪些资源可交易。", ["interaction.trade", "info.public"]));
  if (selected.has("ai.public_policy") && selected.has("info.private.hand") && !selected.has("online.viewer_projection")) issues.push(issue("error", "AI_PRIVATE_BOUNDARY", "隐藏信息 AI 必须经过席位视图投影，不能读取全局状态。", ["ai.public_policy", "info.private.hand"]));
  const axisIds = [...new Set(modules.map((module) => module.axis))];
  const pipeline = ["online", "pacing", "turn", "draft", "placement", "cooperation", "economy", "cards", "interaction", "space", "random", "scoring", "role", "ai"].flatMap((slot) => slots.get(slot) || []);
  const runtimeStatuses = modules.map((module) => module.runtimeStatus || "supported");
  const implementationStatus = runtimeStatuses.includes("planned") ? "planned" : runtimeStatuses.includes("partial") ? "partial" : "supported";
  return {
    ids,
    modules: clone(modules),
    axes: axisIds,
    capabilities: [...capabilities],
    pipeline,
    issues,
    ready: !issues.some((item) => item.level === "error"),
    implementationStatus,
    implementationReady: implementationStatus === "supported",
    summary: `${modules.length} 个机制模块 · ${axisIds.length} 个维度 · ${issues.filter((item) => item.level === "error").length} 个阻断问题`
  };
}

export function composeBoardGameRecipe(recipeId) {
  const recipe = BOARD_GAME_MECHANISM_COMPOSITION_RECIPES.find((item) => item.id === recipeId);
  return recipe ? composeBoardGameMechanisms(recipe.modules) : composeBoardGameMechanisms([]);
}

