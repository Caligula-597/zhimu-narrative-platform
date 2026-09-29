// 玩家端只读取这份轻量目录，不把创作端的整套设计工厂打进玩家 bundle。
// 这里只展示已经通过首发验收的稳定适配版；名称、内容、美术和具体牌面均为原创。
export const COMMERCIAL_GAME_LIBRARY = Object.freeze([
  { id: "stable-ember-auction", title: "余烬集市", sourceGame: "For Sale / Modern Art 机制族", family: "密封竞价", summary: "每轮秘密出价争夺遗物，第二价格、卡牌效果和铸币储备共同决定终局。", players: "3—4 人", minutes: "20 分钟", difficulty: "风险竞价", accent: "amber", status: "稳定可玩" },
  { id: "stable-skyline-draft", title: "天穹城", sourceGame: "Sushi Go / 7 Wonders 机制族", family: "同时轮抽", summary: "秘密选牌、冲突重选和个人城市引擎同时发生，每一张模块都改变后续节奏。", players: "2—4 人", minutes: "26 分钟", difficulty: "信息博弈", accent: "sky", status: "稳定可玩" },
  { id: "stable-mosaic-frontier", title: "马赛克边境", sourceGame: "Azul / Cascadia 机制族", family: "地块放置", summary: "从私有地块中选择合法位置，围绕邻接和连通组件构建自己的边境版图。", players: "2—4 人", minutes: "25 分钟", difficulty: "空间规划", accent: "sand", status: "稳定可玩" },
  { id: "stable-storm-climb", title: "风暴峰线", sourceGame: "Incan Gold / Can't Stop 机制族", family: "推运气", summary: "继续掷骰还是安全停手？每次选择都可能把风险变成声望，也可能让本轮归零。", players: "2—4 人", minutes: "18 分钟", difficulty: "轻量策略", accent: "coral", status: "稳定可玩" },
  { id: "stable-route-network", title: "星港商路", sourceGame: "Ticket to Ride 机制族", family: "路线连通", summary: "支付路线资源争夺公开航线，连接关键港口并在终局计算网络价值。", players: "2—4 人", minutes: "24 分钟", difficulty: "入门策略", accent: "teal", status: "稳定可玩" }
]);

export function commercialGameLibraryEntry(id) {
  return COMMERCIAL_GAME_LIBRARY.find((item) => item.id === id) || null;
}
