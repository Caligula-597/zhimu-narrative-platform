import { createDawnRingDraftDesign, createRouteNetworkDesign, createSkylineDraftDesign, createStormClimbDesign } from "./reference-board-game-presets.js";
import { createEchoArchiveDesign } from "./echo-archive-preset.js";
import { createSeasonWorkshopDesign } from "./season-workshop-preset.js";
import { createEmberAuctionDesign, createMosaicFrontierDesign, createTideCrisisDesign } from "./new-board-game-presets.js";

// 这里是商业桌游机制的线上研究适配，不复制原作的名称、文本、插画、牌面或版图。
// 每个条目都必须指向一份可以被当前引擎编译、说明书完整、可直接试玩的原创设计。
const study = (config) => Object.freeze({ ...config });

function adaptDesign(factory, config) {
  const design = factory();
  design.title = config.adapterTitle;
  design.designGoal = config.designGoal;
  design.commercialStudy = {
    studyId: config.studyId || "",
    releaseTier: config.releaseTier || "research",
    sourceGame: config.sourceGame,
    family: config.family,
    coreMechanisms: [...config.coreMechanisms],
    adaptationBoundary: "保留机制骨架与决策节奏；世界观、名称、文本、美术和具体数值均为原创适配。",
    onlineOptimizations: [...config.onlineOptimizations],
    acceptanceChecklist: Array.isArray(config.acceptanceChecklist) ? [...config.acceptanceChecklist] : []
  };
  design.rulebook.notes = `${config.rulebookNote} ${design.rulebook.notes}`;
  annotateCardFaces(design, config);
  return design;
}

function annotateCardFaces(design, config) {
  const accent = config.visualTheme?.accent || "ember";
  const icon = config.visualTheme?.icon || "✦";
  const eyebrow = config.visualTheme?.eyebrow || "原创牌面";
  for (const component of Array.isArray(design.components) ? design.components : []) {
    for (const entry of Array.isArray(component.entries) ? component.entries : []) {
      const effects = Array.isArray(entry.effects) ? entry.effects : [];
      const effectText = effects.length
        ? `效果：${effects.map((effect) => `${effect.targetKey} ${effect.operation} ${effect.value}`).join("；")}`
        : "效果：无即时数值变化；按条目说明进入对应区域。";
      entry.cardFace = {
        eyebrow,
        icon,
        accent,
        illustration: `${config.id || "board-game"}/${entry.id}`,
        rulesText: entry.description || "按当前牌面与行动说明执行。",
        effectText
      };
    }
  }
}

const commonOnlineOptimizations = [
  "服务器权威校验合法行动、支付和结束条件",
  "公开与私有信息按席位投影，AI 只能读取自己的秘密状态",
  "超时执行安全默认行动并记录事件，避免整局卡住",
  "随机牌堆、骰点和结算日志使用种子，可回放和复盘"
];

export const COMMERCIAL_STUDY_CATALOG = Object.freeze([
  study({
    id: "commercial-dominion-cycle",
    label: "循环牌库研究局",
    sourceGame: "Dominion",
    family: "牌库构筑 / 行动—购买—清理",
    status: "runnable_adapter",
    coreMechanisms: ["牌库循环", "手牌管理", "引擎成长", "终局牌堆压力"],
    summary: "研究牌库变薄、手牌节奏和引擎成长；完整牌库规则另有专用响应面板。",
    adapterTitle: "潮汐牌库：循环构筑研究局",
    designGoal: "用公开可审计的抽牌、手牌消耗和条件拼接，验证牌库循环游戏的节奏、购买机会与终局压力。",
    rulebookNote: "本局是 Dominion 牌库构筑骨架的原创线上适配版，不是原作内容复刻；原作式逐张卡牌响应在牌库研究面板中单独验收。",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(createEchoArchiveDesign, {
      sourceGame: "Dominion",
      family: "牌库构筑 / 行动—购买—清理",
      coreMechanisms: ["牌库循环", "手牌管理", "引擎成长", "终局牌堆压力"],
      adapterTitle: "潮汐牌库：循环构筑研究局",
      designGoal: "用公开可审计的抽牌、手牌消耗和条件拼接，验证牌库循环游戏的节奏、购买机会与终局压力。",
      rulebookNote: "本局是 Dominion 牌库构筑骨架的原创线上适配版，不是原作内容复刻；原作式逐张卡牌响应在牌库研究面板中单独验收。",
      onlineOptimizations: commonOnlineOptimizations
    })
  }),
  study({
    id: "commercial-ticket-route",
    label: "路线连通研究局",
    sourceGame: "Ticket to Ride",
    family: "公共路线占领 / 隐藏目标 / 图连通",
    status: "runnable_adapter",
    coreMechanisms: ["颜色资源", "公共路线争夺", "隐藏目的地", "连通计分"],
    summary: "研究公开路线瓶颈、隐藏目标与最长网络如何共同制造竞速。",
    adapterTitle: "星港商路：路线连通研究局",
    designGoal: "在公开路线与私有目的地之间做网络竞速，让玩家必须同时读取公共瓶颈和自己的终局目标。",
    rulebookNote: "本局只研究路线网络与隐藏目标的决策结构，所有地名、路线、牌面和分值均为原创适配。",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(createRouteNetworkDesign, {
      sourceGame: "Ticket to Ride",
      family: "公共路线占领 / 隐藏目标 / 图连通",
      coreMechanisms: ["颜色资源", "公共路线争夺", "隐藏目的地", "连通计分"],
      adapterTitle: "星港商路：路线连通研究局",
      designGoal: "在公开路线与私有目的地之间做网络竞速，让玩家必须同时读取公共瓶颈和自己的终局目标。",
      rulebookNote: "本局只研究路线网络与隐藏目标的决策结构，所有地名、路线、牌面和分值均为原创适配。",
      onlineOptimizations: commonOnlineOptimizations
    })
  }),
  study({
    id: "commercial-pandemic-crisis",
    label: "合作危机研究局",
    sourceGame: "Pandemic",
    family: "合作行动点 / 公共危机 / 共同胜负",
    status: "runnable_adapter",
    coreMechanisms: ["团队行动点", "公共危机轨", "个人贡献", "共同胜负"],
    summary: "研究合作桌游中公共危机、个人贡献和同步结算的张力。",
    adapterTitle: "潮汐议会：合作危机研究局",
    designGoal: "让所有席位共同维持公共潮汐池，同时通过个人贡献获得排名；团队目标和个人收益不能互相脱钩。",
    rulebookNote: "本局抽取 Pandemic 的合作危机骨架，采用原创危机牌和资源池；不复制城市、角色、文本或美术。",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(createTideCrisisDesign, {
      sourceGame: "Pandemic",
      family: "合作行动点 / 公共危机 / 共同胜负",
      coreMechanisms: ["团队行动点", "公共危机轨", "个人贡献", "共同胜负"],
      adapterTitle: "潮汐议会：合作危机研究局",
      designGoal: "让所有席位共同维持公共潮汐池，同时通过个人贡献获得排名；团队目标和个人收益不能互相脱钩。",
      rulebookNote: "本局抽取 Pandemic 的合作危机骨架，采用原创危机牌和资源池；不复制城市、角色、文本或美术。",
      onlineOptimizations: commonOnlineOptimizations
    })
  }),
  study({
    id: "commercial-stone-age-workers",
    label: "工人放置研究局",
    sourceGame: "Stone Age / Agricola",
    family: "工人放置 / 生产链 / 维护压力",
    status: "runnable_adapter",
    coreMechanisms: ["工位占用", "资源生产", "生产链", "轮次维护"],
    summary: "研究工人数量、公开阻断和资源转化如何形成稳定但有竞争的回合节奏。",
    adapterTitle: "四季工坊：工人放置研究局",
    designGoal: "在有限工位中安排工人，把基础资源转成订单和声望，观察阻断、生产链与维护压力的平衡。",
    rulebookNote: "本局采用 Stone Age / Agricola 常见的工人放置和生产链骨架，组件、订单、地点和数值均为原创适配。",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(createSeasonWorkshopDesign, {
      sourceGame: "Stone Age / Agricola",
      family: "工人放置 / 生产链 / 维护压力",
      coreMechanisms: ["工位占用", "资源生产", "生产链", "轮次维护"],
      adapterTitle: "四季工坊：工人放置研究局",
      designGoal: "在有限工位中安排工人，把基础资源转成订单和声望，观察阻断、生产链与维护压力的平衡。",
      rulebookNote: "本局采用 Stone Age / Agricola 常见的工人放置和生产链骨架，组件、订单、地点和数值均为原创适配。",
      onlineOptimizations: commonOnlineOptimizations
    })
  }),
  study({
    id: "commercial-wingspan-engine",
    label: "桌面引擎研究局",
    sourceGame: "Wingspan",
    family: "个人桌面 / 公共市场 / 多轨引擎",
    status: "runnable_adapter",
    coreMechanisms: ["个人桌面", "公共市场", "资源支付", "触发式引擎"],
    summary: "研究个人桌面成长、公共市场争夺和多轨资源引擎。",
    adapterTitle: "天穹城：桌面引擎研究局",
    designGoal: "从公共模块市场中选择城市部件，平衡能源、贸易、科研和声望四条成长轨。",
    rulebookNote: "本局抽取 Wingspan 式个人桌面与多轨引擎结构，使用原创城市模块与结算文本。",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(createSkylineDraftDesign, {
      sourceGame: "Wingspan",
      family: "个人桌面 / 公共市场 / 多轨引擎",
      coreMechanisms: ["个人桌面", "公共市场", "资源支付", "触发式引擎"],
      adapterTitle: "天穹城：桌面引擎研究局",
      designGoal: "从公共模块市场中选择城市部件，平衡能源、贸易、科研和声望四条成长轨。",
      rulebookNote: "本局抽取 Wingspan 式个人桌面与多轨引擎结构，使用原创城市模块与结算文本。",
      onlineOptimizations: commonOnlineOptimizations
    })
  }),
  study({
    id: "commercial-seven-wonders-draft",
    label: "同时轮抽研究局",
    sourceGame: "7 Wonders",
    family: "同时轮抽 / 多轨资源 / 时代推进",
    status: "runnable_adapter",
    coreMechanisms: ["私有手牌", "同时选择", "定向传牌", "时代结算"],
    summary: "研究信息不完全公开时的同时决策、卡组否认与时代节奏。",
    adapterTitle: "暮环城：同时轮抽研究局",
    designGoal: "每个时代从私有手牌同时选择城市模块，按方向传递剩余牌，并在多条成长轨上竞争终局声望。",
    rulebookNote: "本局采用 7 Wonders 常见的轮抽与时代推进骨架，保留私有手牌边界，使用原创议会、模块和分数。",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(createDawnRingDraftDesign, {
      sourceGame: "7 Wonders",
      family: "同时轮抽 / 多轨资源 / 时代推进",
      coreMechanisms: ["私有手牌", "同时选择", "定向传牌", "时代结算"],
      adapterTitle: "暮环城：同时轮抽研究局",
      designGoal: "每个时代从私有手牌同时选择城市模块，按方向传递剩余牌，并在多条成长轨上竞争终局声望。",
      rulebookNote: "本局采用 7 Wonders 常见的轮抽与时代推进骨架，保留私有手牌边界，使用原创议会、模块和分数。",
      onlineOptimizations: commonOnlineOptimizations
    })
  }),
  study({
    id: "commercial-azul-pattern",
    label: "供给图案研究局",
    sourceGame: "Azul",
    family: "公共供给 / 选择顺序 / 图案放置",
    status: "runnable_adapter",
    coreMechanisms: ["公共供给", "拿取顺序", "空间容量", "邻接计分"],
    summary: "研究公开供给竞争、空间规划和溢出惩罚的组合压力。",
    adapterTitle: "马赛克边境：供给图案研究局",
    designGoal: "在公开供给与共享版图中选择并放置私有地块，用相邻扩张换取声望，同时承担位置稀缺风险。",
    rulebookNote: "本局把 Azul 的公共供给与图案放置思想转成原创地块适配；不复制工厂、图案、牌面或美术。",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(createMosaicFrontierDesign, {
      sourceGame: "Azul",
      family: "公共供给 / 选择顺序 / 图案放置",
      coreMechanisms: ["公共供给", "拿取顺序", "空间容量", "邻接计分"],
      adapterTitle: "马赛克边境：供给图案研究局",
      designGoal: "在公开供给与共享版图中选择并放置私有地块，用相邻扩张换取声望，同时承担位置稀缺风险。",
      rulebookNote: "本局把 Azul 的公共供给与图案放置思想转成原创地块适配；不复制工厂、图案、牌面或美术。",
      onlineOptimizations: commonOnlineOptimizations
    })
  }),
  productionStudy({
    id: "stable-ember-auction",
    label: "余烬集市：稳定首发局",
    sourceGame: "For Sale / Modern Art 机制族",
    family: "密封竞价 / 第二价格 / 资源节奏",
    summary: "第一批稳定上线桌游：逐轮密封出价、第二价格结算、遗物效果和资源终局全部可审计。",
    factory: createEmberAuctionDesign,
    adapterTitle: "余烬集市：稳定首发局",
    designGoal: "在短局密封竞价中管理铸币储备，判断每件遗物的即时价值和终局价值。",
    rulebookNote: "本局是竞价机制族的原创线上适配版；每张遗物、每次出价、第二价格、并列裁决和终局资源都进入标准响应日志。",
    coreMechanisms: ["密封竞价", "第二价格", "资源储备", "即时卡牌效果", "终局平局裁决"],
    acceptanceChecklist: ["全部遗物条目可消费", "每轮并发出价统一结算", "最高价与第二价格可回放", "出价过期有默认策略", "铸币与声望终局平局可审计"],
    visualTheme: { accent: "ember", icon: "◈", eyebrow: "余烬牌面" }
  }),
  productionStudy({
    id: "stable-skyline-draft",
    label: "天穹城：稳定轮抽局",
    sourceGame: "Sushi Go / 7 Wonders 机制族",
    family: "同时轮抽 / 选择冲突 / 桌面引擎",
    summary: "第一批稳定上线桌游：私有手牌、同时选择、冲突重选、模块触发和时代终局完整运行。",
    factory: createSkylineDraftDesign,
    adapterTitle: "天穹城：稳定轮抽局",
    designGoal: "在同时轮抽和选择冲突中搭建个人城市，让公开市场、私有手牌和成长轨共同决定终局声望。",
    rulebookNote: "本局是同时轮抽机制族的原创线上适配版；每轮选择、冲突重选、市场补牌、个人桌面和终局比较均有明确状态。",
    coreMechanisms: ["私有手牌", "同时提交", "选择冲突重选", "桌面引擎", "多轨终局计分"],
    acceptanceChecklist: ["所有模块条目可选择", "缺席席位按时限自动提交", "重复选择进入重选队列", "卡牌效果按顺序结算", "能源科研贸易平局顺序可审计"],
    visualTheme: { accent: "sky", icon: "⌂", eyebrow: "天穹模块牌" }
  }),
  productionStudy({
    id: "stable-mosaic-frontier",
    label: "马赛克边境：稳定拼图局",
    sourceGame: "Azul / Cascadia 机制族",
    family: "地块放置 / 邻接图形 / 连通计分",
    summary: "第一批稳定上线桌游：私有地块、合法邻接、图形连通、地块效果和空间终局完整运行。",
    factory: createMosaicFrontierDesign,
    adapterTitle: "马赛克边境：稳定拼图局",
    designGoal: "从私有地块中选择并放入合法邻接位置，用连通结构、地块标签和扩张数量争夺边境声望。",
    rulebookNote: "本局是空间放置机制族的原创线上适配版；坐标合法性、邻接校验、地块归属、连通关系和终局平局都由服务器结算。",
    coreMechanisms: ["私有地块", "合法邻接", "坐标放置", "连通组件", "空间终局计分"],
    acceptanceChecklist: ["每种地块条目可抽取和放置", "非法坐标被拒绝", "放置后归属和效果公开", "连通组件可重算", "数量、声望、剩余手牌平局可审计"],
    visualTheme: { accent: "sand", icon: "⬡", eyebrow: "边境地块牌" }
  }),
  productionStudy({
    id: "stable-storm-climb",
    label: "风暴峰线：稳定停手局",
    sourceGame: "Incan Gold / Can't Stop 机制族",
    family: "推运气 / 风险轨 / 停手结算",
    summary: "第一批稳定上线桌游：服务器骰点、继续/停手、爆裂回退、回合限时和终局裁决完整运行。",
    factory: createStormClimbDesign,
    adapterTitle: "风暴峰线：稳定停手局",
    designGoal: "在继续挑战和安全停手之间管理风险，把每次骰点变成可回放、可解释的登峰决策。",
    rulebookNote: "本局是推运气机制族的原创线上适配版；骰点种子、风险变化、爆裂回退、停手结算和终局平局全部记录。",
    coreMechanisms: ["服务器骰点", "继续或停手", "爆裂回退", "个人风险轨", "多条件终局"],
    acceptanceChecklist: ["每次骰点可回放", "继续行动保持当前席位", "爆裂只回退未结算风险", "超时执行安全停手", "声望、停手风险、爆裂次数平局可审计"],
    visualTheme: { accent: "coral", icon: "⚡", eyebrow: "风暴事件牌" }
  }),
  productionStudy({
    id: "stable-route-network",
    label: "星港商路：稳定连线局",
    sourceGame: "Ticket to Ride 机制族",
    family: "公共路线 / 图连通 / 资源支付",
    summary: "第一批稳定上线桌游：公共路线争夺、路线资源、连通计分、阻断和终局路线审计完整运行。",
    factory: createRouteNetworkDesign,
    adapterTitle: "星港商路：稳定连线局",
    designGoal: "在公开路线网络中支付资源占领关键航线，计算连通奖励并判断阻断与终局扩张的时机。",
    rulebookNote: "本局是公共路线机制族的原创线上适配版；路线占用、资源支付、网络连通、最长网络和终局资源均保持可复盘。",
    coreMechanisms: ["公开路线", "资源支付", "路线阻断", "图连通", "终局网络计分"],
    acceptanceChecklist: ["每条路线可消费且不可重复占领", "资源支付原子结算", "路线连通可重算", "公共阻断立即同步", "网络长度和剩余资源平局可审计"],
    visualTheme: { accent: "teal", icon: "✧", eyebrow: "星港航线牌" }
  })
]);

function productionStudy(config) {
  return study({
    ...config,
    status: "production_ready",
    releaseTier: "production",
    onlineOptimizations: commonOnlineOptimizations,
    create: () => adaptDesign(config.factory, {
      ...config,
      releaseTier: "production",
      onlineOptimizations: commonOnlineOptimizations
    })
  });
}

export function createCommercialStudyPreset(presetId = "commercial-ticket-route") {
  const preset = COMMERCIAL_STUDY_CATALOG.find((item) => item.id === presetId) || COMMERCIAL_STUDY_CATALOG[0];
  const design = preset.create();
  if (design.commercialStudy && typeof design.commercialStudy === "object") {
    design.commercialStudy.studyId = preset.id;
  }
  return design;
}
