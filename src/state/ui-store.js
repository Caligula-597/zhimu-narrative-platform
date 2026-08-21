import { createStore } from "./create-store.js";

// UI 视图与交互态：路由视图、搜索、线索面板、账户中心、侧栏折叠
export const uiStore = createStore({
  view: "creatorCockpit",
  searchFocus: null,
  cluesSearchQuery: "",
  cluesSelectedId: null,
  cluesBulkSelection: [],
  clueDetailTab: "detail",
  clueFlowFilter: "all",
  clueFlowZoom: 1,
  clueFlowScroll: null,
  clueFlowSuppressClick: false,
  writerSelectedRoleId: null,
  writerEditorOpen: false,
  writerEditorRoleId: null,
  writerEditorSectionId: null,
  panelCollapse: {},
  accountHubTab: "account",
  accountView: null,
  accountViewLoading: false,
  accountViewError: "",
  accountHubLoadId: 0,
  boardGameRequestedTab: "",
  opsStatus: null,
  opsPlanRequests: null,
  opsAuditLog: null,
  opsUsers: null,
  opsUserQuery: {
    search: "",
    verification: "all",
    limit: 20,
    offset: 0
  }
});
