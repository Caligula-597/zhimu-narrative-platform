import { createDawnRingDraftDesign, createRouteNetworkDesign, createSkylineDraftDesign } from "./reference-board-game-presets.js";
import { createEchoArchiveDesign } from "./echo-archive-preset.js";
import { createSeasonWorkshopDesign } from "./season-workshop-preset.js";
import { createMosaicFrontierDesign, createTideCrisisDesign } from "./new-board-game-presets.js";

// 这里是商业桌游机制的线上研究适配，不复制原作的名称、文本、插画、牌面或版图。
// 每个条目都必须指向一份可以被当前引擎编译、说明书完整、可直接试玩的原创设计。
const study = (config) => Object.freeze({ ...config });

function adaptDesign(factory, config) {
  const design = factory();
  design.title = config.adapterTitle;
  design.designGoal = config.designGoal;
  design.commercialStudy = {
    sourceGame: config.sourceGame,
    family: config.family,
    coreMechanisms: [...config.coreMechanisms],
    adaptationBoundary: "保留机制骨架与决策节奏；世界观、名称、文本、美术和具体数值均为原创适配。",
    onlineOptimizations: [...config.onlineOptimizations]
  };
  design.rulebook.notes = `${config.rulebookNote} ${design.rulebook.notes}`;
  return design;
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
  })
]);

export function createCommercialStudyPreset(presetId = "commercial-ticket-route") {
  const preset = COMMERCIAL_STUDY_CATALOG.find((item) => item.id === presetId) || COMMERCIAL_STUDY_CATALOG[0];
  return preset.create();
}
