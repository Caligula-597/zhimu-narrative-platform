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
  cloudRulesPreview: null,
  hostEventSelection: [],
  panelCollapse: {},

  roomEventsConnected: false,
  roomEventsStatus: "idle"
};
