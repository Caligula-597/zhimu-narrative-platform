export const MURDER_MYSTERY_DOMAIN = Object.freeze({
  key: "murder_mystery",
  shellMode: "murder-mystery",
  icon: "谜",
  label: "剧本杀",
  description: "固定或半固定角色、分幕阅读、搜证、指认与结局复盘。",
  homeView: "creatorCockpit",
  defaultRunFormat: "single_session",
  defaultRoleMode: "fixed",
  defaultRulesetMode: "none",
  terminology: Object.freeze({
    role: "角色本",
    roleShort: "角色",
    act: "公共幕",
    scene: "场景",
    clue: "线索",
    secret: "秘密",
    host: "主持人",
    work: "剧本"
  }),
  toolViews: Object.freeze(["writer", "truth", "studio", "clues", "miniGames", "rules", "archive"]),
  allowedViews: Object.freeze([
    "creatorCockpit", "diagnostics", "playtest", "overview",
    "production", "structure", "truth", "publish", "insights", "writer",
    "studio", "clues", "rules", "miniGames", "rooms", "archive", "settings",
    "account", "ops"
  ]),
  labels: Object.freeze({
    writer: "角色私人剧本",
    truth: "谜底与关系",
    studio: "剧情编排图谱",
    clues: "线索管理",
    miniGames: "场内小游戏",
    rules: "剧本自动化规则",
    archive: "场次存档与复盘"
  })
});
