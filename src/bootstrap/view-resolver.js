/** View metadata and resolution — extracted from app.js bootstrap. */
import { getView } from "../runtime/view-registry.js";

const viewMeta = {
  overview: ["世界工作区", "世界总览"],
  writer: ["剧本杀创作", "创作者工作台"],
  studio: ["内容创作", "剧情编排"],
  clues: ["内容创作", "线索管理"],
  rules: ["内容创作", "自动化规则"],
  miniGames: ["内容创作", "小游戏设计"],
  archive: ["历史记录", "存档与复盘"],
  settings: ["世界管理", "世界设置"],
  account: ["账号", "账号与资产"],
  ops: ["OPS", "运营控制台"]
};

export function getViewMeta(view) {
  return viewMeta[view];
}

export function resolveViewFn(view) {
  switch (view) {
    case "overview": return getView("overview").overview;
    case "writer": return getView("writer").writer;
    case "studio": return getView("studio").studioCloud;
    case "clues": return getView("clues").clues;
    case "rules": return getView("rules").rules;
    case "miniGames": return getView("miniGames").miniGames;
    case "archive": return getView("archive").archive;
    case "settings": return getView("settings").settings;
    case "account": return getView("accountHub").accountHub;
    case "ops": return getView("ops").ops;
    default: return undefined;
  }
}
