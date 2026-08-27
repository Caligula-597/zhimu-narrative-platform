/** View metadata and resolution — extracted from app.js bootstrap. */
import { getView } from "../runtime/view-registry.js";
import { productToolCapabilities, productToolLabel } from "../../shared/product-capabilities.js";

const viewMeta = {
  creatorCockpit: ["创作驾驶舱", "创作驾驶舱"],
  diagnostics: ["作品诊断", "作品诊断中心"],
  playtest: ["体验验证", "AI 玩家试跑实验室"],
  overview: ["项目总控", "项目总控"],
  production: ["内容生产", "内容生产"],
  structure: ["结构编排", "运行段落工作台"],
  truth: ["谜底与关系", "谜底与关系"],
  publish: ["测试与发布", "测试与发布"],
  insights: ["复盘改本", "复盘改本"],
  writer: ["剧本杀创作", "角色私人剧本"],
  importSource: ["剧本杀创作", "来源稿与拆稿"],
  studio: ["内容创作", "剧情编排图谱"],
  tabletopMap: ["空间与结局", "跑团地图设计"],
  boardGame: ["桌游创作", "桌游创作中心"],
  clues: ["内容创作", "线索管理"],
  rules: ["内容创作", "自动化规则"],
  miniGames: ["内容创作", "小游戏设计"],
  rooms: ["测试与运行", "运行房工作区"],
  archive: ["历史记录", "存档与复盘"],
  settings: ["世界管理", "世界设置"],
  account: ["账号", "账号与资产"],
  ops: ["OPS", "运营控制台"]
};

export function getViewMeta(view, creationType) {
  const fallback = viewMeta[view];
  if (!fallback) return undefined;
  if (!creationType) return fallback;
  const capabilities = productToolCapabilities(creationType);
  if (["writer", "studio", "truth", "clues", "miniGames", "rules", "archive"].includes(view)) {
    return [`${capabilities.label}${view === "archive" ? "记录" : view === "rules" ? "规则" : "创作"}`, productToolLabel(creationType, view, fallback[1])];
  }
  return fallback;
}

export function resolveViewFn(view) {
  switch (view) {
    case "creatorCockpit": return getView("creatorCockpit").creatorCockpit;
    case "diagnostics": return getView("storyDiagnostics").storyDiagnostics;
    case "playtest": return getView("aiPlaytestLab").aiPlaytestLab;
    case "overview": return getView("overview").overview;
    case "production": return getView("creatorWorkspaces").production;
    case "structure": return getView("creatorWorkspaces").structure;
    case "truth": return getView("creatorWorkspaces").truth;
    case "publish": return getView("creatorWorkspaces").publishLab;
    case "insights": return getView("creatorWorkspaces").insights;
    case "writer": return getView("writer").writer;
    case "importSource": return getView("importSource").importSource;
    case "studio": return getView("studio").studioCloud;
    case "tabletopMap": return getView("tabletopMap").tabletopMap;
    case "boardGame": return getView("boardGame").boardGame;
    case "clues": return getView("clues").clues;
    case "rules": return getView("rules").rules;
    case "miniGames": return getView("miniGames").miniGames;
    case "rooms": return getView("rooms").rooms;
    case "archive": return getView("archive").archive;
    case "settings": return getView("settings").settings;
    case "account": return getView("accountHub").accountHub;
    case "ops": return getView("ops").ops;
    default: return undefined;
  }
}
