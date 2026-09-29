// 玩家端只读取这份轻量目录，不把创作端的整套设计工厂打进玩家 bundle。
// 目录条目对应商业机制研究适配版；名称、内容、美术和具体牌面均为原创。
export const COMMERCIAL_GAME_LIBRARY = Object.freeze([
  { id: "commercial-dominion-cycle", title: "潮汐牌库", sourceGame: "Dominion", family: "牌库构筑", summary: "把手牌变成引擎，再把牌库变薄，观察每轮循环的节奏变化。", players: "2—4 人", minutes: "25 分钟", difficulty: "入门到进阶", accent: "amber", status: "可试玩" },
  { id: "commercial-ticket-route", title: "星港商路", sourceGame: "Ticket to Ride", family: "路线连通", summary: "争夺公共线路、完成私有目的地，并在地图瓶颈处制造选择压力。", players: "2—4 人", minutes: "30 分钟", difficulty: "入门", accent: "teal", status: "可试玩" },
  { id: "commercial-pandemic-crisis", title: "潮汐议会", sourceGame: "Pandemic", family: "合作危机", summary: "全桌共同压住危机轨，同时让每个人的贡献都能被看见和结算。", players: "2—4 人", minutes: "25 分钟", difficulty: "合作", accent: "coral", status: "可试玩" },
  { id: "commercial-stone-age-workers", title: "四季工坊", sourceGame: "Stone Age / Agricola", family: "工人放置", summary: "有限工位、公开阻断和生产链互相牵制，资源每一轮都在转化。", players: "2—4 人", minutes: "28 分钟", difficulty: "经营", accent: "moss", status: "可试玩" },
  { id: "commercial-wingspan-engine", title: "天穹城", sourceGame: "Wingspan", family: "桌面引擎", summary: "从公共模块市场搭建个人城市，让多条资源轨互相触发。", players: "2—4 人", minutes: "30 分钟", difficulty: "引擎构筑", accent: "sky", status: "可试玩" },
  { id: "commercial-seven-wonders-draft", title: "暮环城", sourceGame: "7 Wonders", family: "同时轮抽", summary: "秘密选牌、定向传递和时代推进同时发生，别人拿走什么也很重要。", players: "2—5 人", minutes: "30 分钟", difficulty: "信息博弈", accent: "violet", status: "可试玩" },
  { id: "commercial-azul-pattern", title: "马赛克边境", sourceGame: "Azul", family: "空间放置", summary: "在共享版图上规划连片扩张，位置、邻接和剩余手牌共同决定得分。", players: "2—4 人", minutes: "25 分钟", difficulty: "空间规划", accent: "sand", status: "可试玩" }
]);

export function commercialGameLibraryEntry(id) {
  return COMMERCIAL_GAME_LIBRARY.find((item) => item.id === id) || null;
}
