import { createStore } from "./create-store.js";

// UI 视图与交互态：路由视图、搜索、线索面板、账户中心、侧栏折叠
export const uiStore = createStore({
  view: "overview",
  searchFocus: null,
  cluesSearchQuery: "",
  cluesSelectedId: null,
  cluesBulkSelection: [],
  clueDetailTab: "detail",
  clueFlowFilter: "all",
  clueFlowZoom: 1,
  clueFlowScroll: null,
  clueFlowSuppressClick: false,
  panelCollapse: {},
  accountHubTab: "account",
  accountView: null,
  accountViewLoading: false,
  accountHubLoadId: 0,
  opsStatus: null,
  opsPlanRequests: null,
  opsAuditLog: null
});
