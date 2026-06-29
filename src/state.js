// A2 状态分片 —— Phase 3.1 起激活 Proxy 兼容桥
// ui 字段已迁至 uiStore；其余字段保留在字面量，Proxy 未命中时 fallback 到此对象
import { activateShardBridge } from "./state/index.js";

window.zhimuState = {
  cloudPlayer: null,
  cloudHost: [],
  cloudHostPlayers: [],
  cloudHostPlayersError: "",
  cloudHostStuckCount: 0,
  cloudExploration: null,
  cloudHostEvents: [],
  cloudHostClueMatrix: null,
  cloudHostAuditLog: [],
  cloudWorldLogs: [],
  cloudCheckpoints: [],
  cloudRecaps: [],
  cloudRecapLatest: null,
  cloudRecapDetail: null,
  activeRecapId: null,
  cloudStudio: null,
  cloudLoading: true,
  cloudWorlds: [],
  cloudCatalog: [],
  cloudCatalogError: "",
  cloudRules: [],
  cloudCreatorChecks: [],
  studioSelectedNode: null,
  studioAnchorEditing: false,
  studioFilter: "all",
  studioZoom: 1,
  studioLayoutMode: "scene-tree",
  studioCollapsedScenes: [],
  studioCanvasHeight: 0,
  cloudAssets: [],
  assetKindFilter: "",
  assetSearchQuery: "",
  assetShowRecycle: false,
  assetTotal: 0,
  hostEventSelection: [],
  cloudRoomSettings: { hostVoiceListen: false },
  cloudRulesPreview: null,
  storageUsage: null
};
// 激活 Proxy 兼容桥：window.zhimuState 读/写按字段路由到对应 shard
// 未在 shard 中的字段 fallback 到上面的字面量对象（legacy）
// Phase 4 删除此 Proxy + 字面量，所有消费者改直接 import shard
activateShardBridge();

export {};
