// 只抽取成熟商业桌游的机制结构，不复制其卡名、文案、插画或可识别素材。
// 这些记录是设计研究输入；只有 implementationStatus 为 runnable 的内容才可直接进入 AI 基准局。

const decomposition = (value) => Object.freeze({
  ...value,
  coreLoop: Object.freeze([...value.coreLoop]),
  stateLayers: Object.freeze([...value.stateLayers]),
  decisionPressures: Object.freeze([...value.decisionPressures]),
  balanceLevers: Object.freeze([...value.balanceLevers]),
  requiredModules: Object.freeze([...value.requiredModules]),
  missingModules: Object.freeze([...(value.missingModules || [])]),
  onlineResponseContract: Object.freeze([...value.onlineResponseContract]),
  cardRoleBalance: Object.freeze({ ...value.cardRoleBalance }),
  roleBalance: Object.freeze({ ...value.roleBalance }),
  knownGaps: Object.freeze([...value.knownGaps])
});

export const COMMERCIAL_MECHANISM_DECOMPOSITIONS = Object.freeze([
  decomposition({
    id: "seven-wonders-draft",
    sourceGame: "7 Wonders",
    family: "同时轮抽 / 多轨资源 / 邻接互动",
    coreLoop: [
      "每人从私有牌组选择一张牌并同时揭示",
      "支付资源或满足免费建造条件，把牌部署到自己的城市",
      "将剩余手牌按固定方向传给下一位，重复至本时代结束",
      "按时代推进升级牌池，并在终局合并军事、科技、商业与城市分数"
    ],
    stateLayers: [
      "公开：每座城市已建卡、资源产能、军事邻接值、时代与公共弃牌",
      "席位私有：当前手牌、尚未公开的选择意图",
      "派生：可支付牌、邻居比较、免费链、终局套组与分数明细"
    ],
    decisionPressures: [
      "强牌、卡组否认和传牌方向之间的取舍",
      "短期资源产能与终局倍率之间的时间价值冲突",
      "只看自己城市会漏掉邻居军事、科技和关键链条的公共信息",
      "弃牌换钱或造奇观是无法直接获得牌面收益的节奏选择"
    ],
    balanceLevers: [
      "按座位数和时代调整牌池密度，避免关键牌被某个方向垄断",
      "限制免费链的连续爆发，给付费建造保留有效竞争力",
      "让军事、科技、商业和奇观都存在可比较的机会成本",
      "对首位、末位以及传牌方向分别做胜率与关键牌可达性审计"
    ],
    cardRoleBalance: {
      payoff: "一张牌同时承担即时收益、持续引擎或终局分，三者不能都拉满",
      tempo: "资源与免费链提高当回合节奏；终局牌应有较慢回报",
      denial: "否认价值受传牌方向、邻居可支付条件和剩余时代数约束",
      scaling: "科技和套组效果必须随可收集数量递减或设置重复成本",
      risk: "高倍率牌要暴露资源、邻接或时代窗口风险，不能无条件领先"
    },
    roleBalance: {
      identity: "城市差异来自起始奇观、资源偏好与邻接收益，而非固定强制路线",
      powerBudget: "起始能力的终局等价分应在可观察的资源与牌池条件下校准",
      counterplay: "邻居能通过军事、否认和资源竞争压制强路线",
      seatRisk: "首末位的传牌方向收益需要单独统计，并用牌池轮换修正"
    },
    requiredModules: ["timing.reveal", "draft.hand", "info.public", "resource.production", "card.play", "effects.response_standard", "cards.zones", "score.collection", "score.comparison", "score.endgame_audit", "pacing.age", "pacing.multi_era_cleanup", "online.viewer_projection", "online.command_server"],
    missingModules: ["draft.direction_balance", "adjacent_neighbor_projection", "multi_track_end_scoring"],
    onlineResponseContract: [
      "锁定选牌后在揭示前不可改牌，超时使用明确的默认合法牌",
      "效果按牌面文字顺序、支付、部署、触发、连锁顺序逐条记录",
      "免费链必须回溯来源牌与被跳过的支付成本",
      "邻居与传牌动作只公开必要信息，不泄露其他玩家未选择的手牌",
      "同一张牌的重复触发必须有唯一事件编号和幂等保护",
      "时代切换前清空待处理效果，避免跨时代污染牌池"
    ],
    implementationStatus: "decomposition_only",
    knownGaps: ["尚未接入方向性轮抽的独立模拟器", "尚未完成四条终局计分轨的通用配置化"]
  }),
  decomposition({
    id: "azul-market-pattern",
    sourceGame: "Azul",
    family: "公共供给 / 选择顺序 / 图案放置",
    coreLoop: [
      "从公共工厂或中央供给选择同色物件",
      "把整组物件放入一条图案线，多余物件落入地板惩罚区",
      "供给耗尽后逐线完成图案并移动到墙面",
      "用邻接、同色和完成行列触发即时或终局分数"
    ],
    stateLayers: [
      "公开：工厂供给、中央池、每个玩家图案线、墙面与惩罚轨",
      "私有：通常没有手牌秘密，核心是公开信息下的顺序竞争",
      "派生：可选组、放置合法性、溢出数量、邻接收益与回合先手"
    ],
    decisionPressures: [
      "拿走大组会给自己效率，也会把难处理的颜色留给对手",
      "提前拿中央池可能获得先手，却承担更多地板惩罚",
      "为高邻接分延迟完成，可能错过稀缺颜色或制造溢出",
      "同色限制把空间规划与供给读取绑在一起"
    ],
    balanceLevers: [
      "工厂数量、颜色分布和中央池初始化决定先手优势",
      "墙面图案的邻接权重不能让单一颜色路线统治",
      "地板惩罚应能惩罚贪取，但不能把一次坏拿取变成不可逆淘汰",
      "终局触发线数需要匹配短局与长局的得分斜率"
    ],
    cardRoleBalance: {
      payoff: "无卡牌时，把供给组视为一次性公共资源卡，收益由数量、颜色和位置共同决定",
      tempo: "先手权是节奏资源，不应单独等价于最大组收益",
      denial: "拿取动作的主要否认来自改变中央池，而非隐藏信息",
      scaling: "多人局必须按玩家数调整供给总量与补充节奏",
      risk: "高价值邻接规划的风险是供给不确定和溢出惩罚"
    },
    roleBalance: {
      identity: "无角色不等于无平衡；座位顺序和公共池位置是隐性角色变量",
      powerBudget: "先手权应通过中央池暴露的风险抵消，而不是固定补偿分",
      counterplay: "每次选择都应能改变至少一名对手的可行空间",
      seatRisk: "首位和末位的可得组规模、中央池数量与惩罚分需分座位统计"
    },
    requiredModules: ["timing.sequential", "info.public", "resource.production", "effects.response_standard", "space.area", "space.tile_topology", "score.comparison", "online.command_server"],
    missingModules: ["pattern_placement", "factory_supply_refill", "overflow_penalty"],
    onlineResponseContract: [
      "选择供给组、放置线和溢出区必须作为一个原子命令校验",
      "客户端只展示合法颜色与容量，服务器仍需重新验证",
      "完成墙面图案时先结算邻接分，再清理图案线",
      "同一供给组不可被两个并发命令重复领取",
      "回合结束快照必须包含供给、墙面、地板和先手标记"
    ],
    implementationStatus: "decomposition_only",
    knownGaps: ["尚未把空间容量约束接入通用放置效果", "尚未建立多人供给量自动缩放器"]
  }),
  decomposition({
    id: "carcassonne-tile-claims",
    sourceGame: "Carcassonne",
    family: "随机拼图 / 共享地图 / 计分占用",
    coreLoop: [
      "从牌堆抽取一块地块，必须与已放置边缘合法连接",
      "选择是否放置一个单位争夺道路、城市、修道院或农田",
      "完成结构时按结构规模和占用者结算分数并归还单位",
      "牌堆耗尽后对未完成结构和农田进行终局计分"
    ],
    stateLayers: [
      "公开：已放地块、边缘类型、占用单位、完成标记与分数",
      "私有：下一块地块通常未知，随机种子和牌堆索引属于服务器状态",
      "派生：合法旋转、可放位置、结构连通、占用冲突和终局归属"
    ],
    decisionPressures: [
      "地块的即时合法位置与未来扩张潜力不一致",
      "单位投入能获得控制权，也会锁定可用单位造成节奏风险",
      "连接结构可能帮助对手合并，形成共享收益与反向送分",
      "短期完成分、长线农田收益和保留单位之间相互冲突"
    ],
    balanceLevers: [
      "地块边缘频率与稀有闭合地块决定可完成性",
      "单位总量与归还速度决定空间争夺的紧张程度",
      "平局共享或抢占规则必须明确并统一到结算顺序",
      "终局农田价值不能压过全部中期结构决策"
    ],
    cardRoleBalance: {
      payoff: "地块既是地图增量也是潜在计分载体，位置收益不能脱离周边状态",
      tempo: "快速闭合提高现金分，但会牺牲扩大结构和单位回收机会",
      denial: "放置本身通过占据稀缺连接位实现公开否认",
      scaling: "地图边缘和牌堆剩余量需要随人数调整闭合概率",
      risk: "随机地块带来可复现但不可完全预测的空间风险"
    },
    roleBalance: {
      identity: "无固定派系；差异由单位位置和公开地图控制产生",
      powerBudget: "任何新单位能力都应以可计算的占用效率和归还速度计价",
      counterplay: "地图必须提供多条合法落点，避免单一位置决定胜负",
      seatRisk: "首末位抽牌先后、可用边缘和终局最后一手需要按种子统计"
    },
    requiredModules: ["timing.sequential", "info.public", "space.area", "space.tile_topology", "effects.response_standard", "score.comparison", "uncertainty.seeded", "online.command_server"],
    missingModules: ["tile_rotation_placement", "connected_component_scoring", "worker_return_cycle"],
    onlineResponseContract: [
      "地块旋转、落点、单位投放必须在一个版本号下原子结算",
      "每次闭合都记录参与结构的完整成员与计分前后值",
      "占用冲突必须依据公开地图重算，不接受客户端的预计算结果",
      "随机抽牌记录种子、索引和牌面摘要，支持完整回放",
      "终局计分与中局闭合使用同一结构扫描器，避免两套规则漂移"
    ],
    implementationStatus: "decomposition_only",
    knownGaps: ["尚未实现通用地块拓扑编辑器", "尚未把结构组件扫描器接入标准效果队列"]
  }),
  decomposition({
    id: "catan-production-trade",
    sourceGame: "Catan",
    family: "骰子生产 / 公开交易 / 网络扩张",
    coreLoop: [
      "触发公共生产结果，依据数字和地块为拥有相邻据点的玩家发放资源",
      "玩家在公开交易窗口交换资源或使用港口转换",
      "支付资源建设道路、据点或升级结构，改变后续生产网络",
      "通过隐藏目标、最长网络或公开里程碑竞争终局分"
    ],
    stateLayers: [
      "公开：地图连接、据点、数字标记、资源生产结果与公开交易声明",
      "私有：资源手牌、隐藏目标、持有的特殊牌",
      "派生：每个据点的生产集合、合法建设位、港口比率与胜利点"
    ],
    decisionPressures: [
      "高频资源与稀缺资源之间的网络位置竞争",
      "交易能提高当前玩家效率，也可能帮助对手完成关键建设",
      "持有过多资源承担公共惩罚风险，过早花光又失去爆发窗口",
      "扩张、阻断和隐藏目标完成的路线互相消耗同一资源"
    ],
    balanceLevers: [
      "数字概率与资源分布决定开局位置质量，必须做座位和种子统计",
      "交易自由度应有窗口、最小单位或公开性边界，避免无成本协作垄断",
      "建设位置的稀缺度需要让阻断有价值但不至于锁死玩家",
      "隐藏目标奖励要和公开里程碑的可预测性拉开差异"
    ],
    cardRoleBalance: {
      payoff: "特殊牌提供一次性节奏、保护或转换，不能替代基础网络建设",
      tempo: "生产结果带来回合间资源波动，建设将波动转为长期产能",
      denial: "阻断和稀缺位置占用是公开否认，交易本身不应隐含强制否认",
      scaling: "人数增加时资源产出、地图瓶颈与交易窗口要同步扩容",
      risk: "随机生产要可回放，坏运气应有转换、交易或保护性出口"
    },
    roleBalance: {
      identity: "位置、港口和资源组合形成非对称起点，但不是固定角色能力",
      powerBudget: "开局位置按预期生产、扩张可达性和阻断暴露综合定价",
      counterplay: "公共交易和地图替代路线应提供追赶工具",
      seatRisk: "先手建设、骰子连续命中和资源断供必须拆开统计，不能只看胜率"
    },
    requiredModules: ["timing.sequential", "info.public", "info.private.hand", "interaction.trade", "interaction.trade_window", "resource.production", "random.dice_production", "resource.currency", "effects.response_standard", "space.route", "objective.hidden", "uncertainty.seeded", "online.viewer_projection", "online.command_server"],
    missingModules: ["dice_production", "port_conversion", "trade_window_protocol", "hand_limit_penalty"],
    onlineResponseContract: [
      "生产、资源进入手牌和公共惩罚必须按同一随机事件顺序结算",
      "交易只在明确窗口接受，双方确认后原子转移资源",
      "资源手牌在公共快照中只显示数量或允许的聚合信息",
      "建设前重算地图合法性与支付，防止并发占位",
      "特殊牌的使用与目标选择记录为独立响应事件，支持撤销前审计而不允许事后改写"
    ],
    implementationStatus: "decomposition_only",
    knownGaps: ["尚未接入骰子生产和交易确认协议", "尚未完成隐藏目标与公共胜利点的统一计分器"]
  }),
  decomposition({
    id: "brass-network-market",
    sourceGame: "Brass: Birmingham",
    family: "双时代网络 / 市场供需 / 贷款与转型",
    coreLoop: [
      "打出牌或使用通用牌，选择地点建设、连接、开发或售出产业",
      "从市场按供需取用资源，建筑转化为收入、产能或网络连接",
      "时代结束时清理旧建筑、重置部分牌池并把网络价值转入下一时代",
      "在收入、贷款、建筑等级、连接分和终局产业分之间平衡资本"
    ],
    stateLayers: [
      "公开：产业等级、已建连接、市场库存与价格、收入轨和时代",
      "私有：手牌、可用地点选择与未来建设意图",
      "派生：牌的地点合法性、市场价格、贷款利息、翻面产业与时代计分"
    ],
    decisionPressures: [
      "早期扩网可能牺牲现金流，晚期转型又会错过稀缺位置",
      "市场采购既是支付成本，也是替对手补充市场库存的机会",
      "高等级产业有更高收益，但需要前置连接和时代窗口",
      "手牌地点限制迫使玩家在通用行动与精确规划间取舍"
    ],
    balanceLevers: [
      "市场补充顺序和价格曲线决定不同产业类型的真实成本",
      "贷款利率与收入轨必须让借钱既可追赶又不能无限滚雪球",
      "两时代牌池密度要防止某一地点或产业类型断供",
      "网络连接分、产业收益和现金流应形成三种不同胜利路线"
    ],
    cardRoleBalance: {
      payoff: "地点牌限制选择，产业牌提供收益；通用牌放宽地点但应承担机会成本",
      tempo: "连接和翻面是中期节奏，终局产业分不能完全补偿早期现金流崩溃",
      denial: "占用地点和市场资源是公开否认，牌的地点限制控制否认强度",
      scaling: "市场供给、产业槽位和网络边缘必须按人数重算",
      risk: "贷款与市场价格带来经济风险，价格变化需要公开且可重放"
    },
    roleBalance: {
      identity: "不同起始城市、资源位置或产业偏好形成软非对称",
      powerBudget: "开局网络的预期收入、可达市场和时代转换成本要统一预算",
      counterplay: "市场替代、通用牌与跨区连接提供反制，不允许一张地点牌锁死整局",
      seatRisk: "先手抢位、末手市场残余与时代结束顺序需分别审计"
    },
    requiredModules: ["timing.sequential", "info.public", "info.private.hand", "card.play", "effects.response_standard", "cards.zones", "resource.production", "resource.currency", "resource.market_curve", "pacing.age", "pacing.multi_era_cleanup", "online.viewer_projection", "online.command_server"],
    missingModules: ["market_price_curve", "loan_interest", "dual_era_cleanup", "industry_flip_resolution"],
    onlineResponseContract: [
      "建造、采购、市场价格变化和产业翻面严格按操作顺序记录",
      "贷款与利息是独立可审计效果，不能藏在一个不可解释的余额变化中",
      "时代结束要先完成所有待处理卡牌效果，再做清场与计分",
      "市场取货必须有并发锁和库存 before/after，避免重复消费",
      "牌的地点限制、通用牌例外和建筑等级条件统一走编译期检查"
    ],
    implementationStatus: "decomposition_only",
    knownGaps: ["尚未实现供需价格曲线", "尚未实现跨时代清场和产业翻面流水线"]
  }),
  decomposition({
    id: "root-asymmetric-factions",
    sourceGame: "Root",
    family: "强非对称派系 / 区域控制 / 行动编程",
    coreLoop: [
      "各派系按照不同的行动经济和维护顺序执行回合",
      "通过移动、生产、建设、战斗或政治动作争夺林地中的公共区域",
      "派系目标、牌面组合和公共胜利点同时塑造短期路线",
      "某派系达成胜利点或特殊目标后结束游戏并进行条件审计"
    ],
    stateLayers: [
      "公开：地图控制、单位数量、建筑、公共牌区、分数与战斗结果",
      "私有：手牌、派系行动计划、部分任务或牌面组合",
      "派系私有规则：每个派系的行动阶段、资源账本、胜利条件与可用动作",
      "派生：合法动作、控制判定、战斗结果、资源供需和胜利触发"
    ],
    decisionPressures: [
      "玩家不仅选择动作，还要理解自己的派系何时会失速",
      "公开地图的即时威胁与私有牌组的长期路线互相牵制",
      "攻击能削弱领先者，也可能使第三方获得政治或资源收益",
      "不同派系的行动窗口不对称，不能用统一价值函数简单比较"
    ],
    balanceLevers: [
      "派系的开局资源、行动点、扩张速度和终局上限必须分别预算",
      "战斗随机性要有足够的控制、撤退或牌面修正让决策仍有权重",
      "地图首回合可达性与公共牌供给决定派系是否能启动",
      "胜利目标要让其他席位看得见威胁并拥有可执行的反制窗口"
    ],
    cardRoleBalance: {
      payoff: "牌既是行动支付又是组合资源，强牌必须受颜色、时机或弃牌成本约束",
      tempo: "行动编程或多阶段回合把先后顺序变成核心收益，而非单纯多行动",
      denial: "区域占领、牌库争抢和强制弃牌构成多层否认，需限制连锁锁死",
      scaling: "派系人数变化不能只复制同一牌池，公共区域和牌流要按席位校准",
      risk: "非对称派系的失败通常来自启动条件或连锁断点，系统要提供恢复路径"
    },
    roleBalance: {
      identity: "派系拥有不同的资源、行动顺序、移动方式和获胜压力",
      powerBudget: "平衡对象不是单张能力，而是完整的启动速度、峰值、恢复与反制曲线",
      counterplay: "每个派系至少有两条可被其他玩家识别并干预的弱点",
      seatRisk: "座位顺序、初始邻接和首回合行动顺序必须按派系对局矩阵统计"
    },
    requiredModules: ["timing.sequential", "info.public", "info.private.hand", "role.asymmetry", "role.faction_plugin", "space.area", "interaction.conflict", "interaction.combat_resolution", "card.play", "effects.response_standard", "score.comparison", "score.endgame_audit", "online.viewer_projection", "online.command_server"],
    missingModules: ["faction_rule_plugins", "multi_phase_action_economy", "combat_resolution", "victory_trigger_audit"],
    onlineResponseContract: [
      "每个派系的阶段顺序由规则插件声明，不能把所有派系强行压成统一回合",
      "战斗必须记录攻击方、守方、修正、随机结果、损失和控制变化",
      "私有牌效果只向持有者可见，但公共结果和触发原因必须可解释",
      "连续触发设最大深度、唯一事件链和原子失败回滚",
      "胜利检查在每个可改变分数或控制的效果后执行，并记录触发快照",
      "AI 视图只能读取本派系状态与公共地图，不能读取对手私有牌或派系账本"
    ],
    implementationStatus: "decomposition_only",
    knownGaps: ["尚未实现派系规则插件隔离层", "尚未实现战斗与胜利触发的通用结算器"]
  })
]);

const BY_ID = new Map(COMMERCIAL_MECHANISM_DECOMPOSITIONS.map((item) => [item.id, item]));

export function getCommercialMechanismDecomposition(id) {
  return BY_ID.get(String(id || "")) || null;
}

export function summarizeCommercialMechanismDecompositions() {
  const byFamily = {};
  for (const item of COMMERCIAL_MECHANISM_DECOMPOSITIONS) byFamily[item.family] = (byFamily[item.family] || 0) + 1;
  return {
    count: COMMERCIAL_MECHANISM_DECOMPOSITIONS.length,
    implementationStatuses: COMMERCIAL_MECHANISM_DECOMPOSITIONS.reduce((result, item) => {
      result[item.implementationStatus] = (result[item.implementationStatus] || 0) + 1;
      return result;
    }, {}),
    familyCount: Object.keys(byFamily).length,
    families: byFamily
  };
}
