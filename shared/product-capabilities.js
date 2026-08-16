import { normalizeCreationType } from "./narrative-profile.js";

export const PRODUCT_TOOL_CAPABILITIES = Object.freeze({
  murder_mystery: Object.freeze({
    label: "剧本杀",
    dedicated: Object.freeze(["writer", "truth", "studio", "clues", "miniGames"]),
    shared: Object.freeze(["rules", "archive"]),
    labels: Object.freeze({
      writer: "角色私人剧本",
      truth: "谜底与关系",
      studio: "剧情编排图谱",
      clues: "线索管理",
      miniGames: "场内小游戏",
      rules: "自动化规则",
      archive: "存档与复盘"
    })
  }),
  tabletop_rpg: Object.freeze({
    label: "跑团",
    dedicated: Object.freeze(["writer", "studio", "tabletopMap", "miniGames"]),
    shared: Object.freeze(["rules", "archive"]),
    labels: Object.freeze({
      writer: "角色与 HO",
      studio: "模组编排",
      tabletopMap: "跑团地图与遭遇",
      miniGames: "团内小游戏",
      rules: "判定与自动化",
      archive: "战役存档"
    })
  }),
  board_game: Object.freeze({
    label: "桌游",
    dedicated: Object.freeze(["boardGame", "writer"]),
    shared: Object.freeze(["rules", "archive"]),
    labels: Object.freeze({
      boardGame: "桌游设计总台",
      writer: "玩家席位与私密信息",
      rules: "条件与结算规则",
      archive: "测试局记录"
    })
  }),
  interactive_story: Object.freeze({
    label: "互动叙事（兼容）",
    dedicated: Object.freeze(["writer", "truth", "studio", "clues", "miniGames"]),
    shared: Object.freeze(["rules", "archive"]),
    labels: Object.freeze({
      writer: "角色内容",
      truth: "设定与关系",
      studio: "剧情编排图谱",
      clues: "信息卡",
      miniGames: "互动组件",
      rules: "自动化规则",
      archive: "存档与复盘"
    })
  })
});

export function productToolCapabilities(value) {
  return PRODUCT_TOOL_CAPABILITIES[normalizeCreationType(value)];
}

export function productToolViews(value) {
  const capabilities = productToolCapabilities(value);
  return [...capabilities.dedicated, ...capabilities.shared];
}

export function productSupportsView(value, view) {
  return productToolViews(value).includes(view);
}

export function productToolLabel(value, view, fallback = "") {
  return productToolCapabilities(value).labels[view] || fallback || view;
}
