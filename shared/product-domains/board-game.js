export const BOARD_GAME_DOMAIN = Object.freeze({
  key: "board_game",
  shellMode: "board-game",
  icon: "棋",
  label: "桌游",
  description: "棋盘、牌堆、标记、轨道、阶段与自定义组件。",
  homeView: "boardGame",
  defaultRunFormat: "single_session",
  defaultRoleMode: "player_created",
  defaultRulesetMode: "custom",
  terminology: Object.freeze({
    role: "玩家席位",
    roleShort: "玩家",
    act: "阶段",
    scene: "区域",
    clue: "卡牌 / 信息",
    secret: "隐藏信息",
    host: "设计者 / 裁判",
    work: "桌游"
  }),
  toolViews: Object.freeze(["boardGame"]),
  allowedViews: Object.freeze(["boardGame", "account", "ops"]),
  labels: Object.freeze({
    boardGame: "桌游创作中心"
  })
});
