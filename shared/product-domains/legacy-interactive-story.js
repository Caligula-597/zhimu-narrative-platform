/** Read-only compatibility identity for old records. It is not an active product line. */
export const LEGACY_INTERACTIVE_STORY_DOMAIN = Object.freeze({
  key: "interactive_story",
  shellMode: "legacy-product",
  icon: "旧",
  label: "旧版互动叙事",
  description: "已停止新增；旧项目仅保留账号与导出入口。",
  homeView: "account",
  defaultRunFormat: "single_session",
  defaultRoleMode: "fixed",
  defaultRulesetMode: "none",
  terminology: Object.freeze({
    role: "角色",
    roleShort: "角色",
    act: "章节",
    scene: "场景",
    clue: "信息卡",
    secret: "隐藏信息",
    host: "导演",
    work: "互动故事"
  }),
  toolViews: Object.freeze([]),
  allowedViews: Object.freeze(["account", "ops"]),
  labels: Object.freeze({})
});
