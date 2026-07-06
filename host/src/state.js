export const state = {
  view: "landing",
  user: null,
  authMode: "login",
  authConfig: null,
  busy: false,
  toast: "",
  error: "",
  apiError: "",
  loading: false,

  worlds: [],
  rooms: [],
  room: null,
  studio: null,
  rules: [],
  cloudWorldLogs: [],

  cloudHostPlayers: [],
  cloudHostPlayersError: "",
  cloudHostStuckCount: 0,
  cloudHostEvents: [],
  cloudHostClueMatrix: null,
  cloudHostAuditLog: [],
  cloudHostTestimonies: [],
  cloudHostSegmentRemedies: [],
  cloudHostVotes: [],
  cloudHostPrivateActions: [],
  cloudRunReport: null,
  cloudRulesPreview: null,
  hostEventSelection: [],
  panelCollapse: {},

  roomEventsConnected: false,
  roomEventsStatus: "idle",

  /** 节奏计时器状态 — 保存在 localStorage，仅主持人本地使用，不同步给玩家 */
  paceTimer: null
};
