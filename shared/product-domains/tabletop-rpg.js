export const TABLETOP_RPG_DOMAIN = Object.freeze({
  key: "tabletop_rpg",
  shellMode: "tabletop-rpg",
  icon: "骰",
  label: "跑团",
  description: "角色卡、地点探索、判定、遭遇与可持续多场次战役。",
  homeView: "tabletopMap",
  defaultRunFormat: "campaign",
  defaultRoleMode: "mixed",
  defaultRulesetMode: "system_neutral",
  terminology: Object.freeze({
    role: "调查员 / PC",
    roleShort: "PC",
    act: "章节",
    scene: "地点",
    clue: "HO",
    secret: "KP 信息",
    host: "KP",
    work: "模组"
  }),
  toolViews: Object.freeze(["tabletopMap"]),
  allowedViews: Object.freeze(["tabletopMap", "account", "ops"]),
  labels: Object.freeze({
    tabletopMap: "跑团地图、判定与遭遇"
  })
});
