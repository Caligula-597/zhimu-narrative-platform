const runtimeConfig = window.zhimuConfig || {};
const API_BASE = runtimeConfig.apiBase || "/api";
const demoMode = Boolean(runtimeConfig.demoMode);
const demoUsers = runtimeConfig.demoUsers || {};
const friendlyApiError = window.zhimuUserMessages?.friendlyApiError || ((payload, fb) => payload.error || fb);
const sessionAuth = () => window.zhimuSessionAuth || {};

const demoContext = {
  hostUserId: demoUsers.hostUserId || "",
  playerUserId: demoUsers.playerUserId || "",
  worldId: "",
  roomId: ""
};
demoContext.worldId = localStorage.getItem("zhimuActiveWorldId") || "";
demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${demoContext.worldId}`) || "";

function clientDeviceLabel() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";
  let browser = "浏览器";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}

function authHeaders(userId, extra = {}) {
  const headers = sessionAuth().authHeaders?.() || {};
  if (!headers.authorization && demoMode && userId) headers["x-user-id"] = userId;
  const deviceLabel = clientDeviceLabel();
  if (deviceLabel && !extra["x-device-label"] && !headers["x-device-label"]) {
    headers["x-device-label"] = deviceLabel;
  }
  return { ...headers, ...extra };
}

function markSessionFromResponse(result) {
  if (result?.token) sessionAuth().markAuthenticated?.(result.token);
  else if (result?.user?.id) sessionAuth().markAuthenticated?.();
  return result;
}

function resolveWorldRevision(worldId, explicit) {
  if (explicit != null) return explicit;
  return window.zhimuWorldRevision?.currentRevision?.(worldId) ?? null;
}

function ifMatchHeaders(worldId, explicitRevision) {
  const revision = resolveWorldRevision(worldId, explicitRevision);
  if (revision == null) return {};
  return { "If-Match": `"${revision}"` };
}

function trackWorldRevisionResponse(worldId, data) {
  if (data?.content_revision != null) {
    window.zhimuWorldRevision?.applySavedRevision?.(worldId, data.content_revision);
  }
  return data;
}

function worldWrite(path, { worldId = demoContext.worldId, userId = demoContext.hostUserId, method = "PATCH", body, revision, ...rest } = {}) {
  return request(path, {
    userId,
    method,
    body,
    headers: ifMatchHeaders(worldId, revision),
    ...rest
  }).then((data) => trackWorldRevisionResponse(worldId, data));
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sseCursorKey(roomId) {
  return `zhimuSseCursor:${roomId}`;
}

/** 普通 DeepSeek 步骤；须 ≥ 后端单次 DEEPSEEK_TIMEOUT_MS（默认 180s） */
const DEEPSEEK_TIMEOUT_MS = 180_000;
/** 逐章总剧情含续写，后端最多 2 轮 × 180s */
const DEEPSEEK_CHAPTER_NARRATIVE_TIMEOUT_MS = 420_000;
/** 上传编排/分幕到云端（多角色多章节时可能较慢） */
const PIPELINE_IMPORT_TIMEOUT_MS = 180_000;

function deepseekRequest(path, opts = {}) {
  const isChapterNarrative = /\/narrative\/chapter$/.test(path);
  const defaultTimeout = isChapterNarrative ? DEEPSEEK_CHAPTER_NARRATIVE_TIMEOUT_MS : DEEPSEEK_TIMEOUT_MS;
  return request(path, { ...opts, timeoutMs: opts.timeoutMs ?? defaultTimeout });
}

async function request(path, { userId, method = "GET", body, timeoutMs = 20000, idempotent = false, idempotencyKey, headers: extraHeaders = {} } = {}, authRetry = false) {
  const headers = authHeaders(userId, extraHeaders);
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idempotent && method !== "GET" && method !== "HEAD") {
    headers["idempotency-key"] = idempotencyKey || createIdempotencyKey();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: "include"
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 504) {
        const err = new Error("AI 生成超时（服务器等待过久）。请改用「分步参与」逐层生成，或减少章节/角色/场景数量。");
        err.code = payload.code || "GATEWAY_TIMEOUT";
        throw err;
      }
      if (response.status === 502 || response.status === 503) {
        const err = new Error(friendlyApiError(payload, "无法连接服务器，请稍后重试。"));
        err.code = payload.code || "API_UNAVAILABLE";
        throw err;
      }
      const err = new Error(friendlyApiError(payload, `${method} ${path} failed`));
      err.code = payload.code;
      err.details = payload.details;
      if (response.status === 409 && payload.code === "WORLD_VERSION_CONFLICT") {
        window.zhimuWorldRevision?.showConflict?.(payload.details);
      }
      if (response.status === 401 && !authRetry && sessionAuth().isAuthenticated?.()) {
        sessionAuth().markLoggedOut?.();
        return request(path, { userId, method, body, timeoutMs, idempotent, idempotencyKey, headers: extraHeaders }, true);
      }
      throw err;
    }
    const data = await response.json();
    if (/^\/auth\/(login|register|guest|upgrade|verify-email|oauth\/complete)/.test(path)) {
      if (data.token) sessionAuth().markAuthenticated?.(data.token);
      else markSessionFromResponse(data);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const secs = Math.round(timeoutMs / 1000);
      throw new Error(`请求超时（已等待 ${secs} 秒）。AI 生成较慢，请重试或减少章节/角色规模。`);
    }
    if (error instanceof TypeError) {
      throw new Error("无法连接服务器，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

window.zhimuApi = {
  context: demoContext,
  createIdempotencyKey,
  selectWorld(worldId) {
    demoContext.worldId = worldId;
    demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${worldId}`) || "";
    localStorage.setItem("zhimuActiveWorldId", worldId);
  },
  clearWorld() {
    demoContext.worldId = "";
    demoContext.roomId = "";
    localStorage.removeItem("zhimuActiveWorldId");
  },
  /** Drop active world/room — call on login, register, or logout to avoid demo world leaking into real accounts. */
  resetActiveWorld() {
    this.clearWorld();
    this.clearRoom();
  },
  selectRoom(roomId) { demoContext.roomId = roomId; localStorage.setItem(`zhimuActiveRoomId:${demoContext.worldId}`, roomId); },
  clearRoom() { demoContext.roomId = ""; localStorage.removeItem(`zhimuActiveRoomId:${demoContext.worldId}`); },
  loadKey() { return `${demoContext.worldId}:${demoContext.roomId}`; },
  getWorlds: (includeArchived = false) => request(`/worlds${includeArchived ? "?includeArchived=true" : ""}`, { userId: demoContext.hostUserId }),
  getWorldCatalog: () => request("/worlds/catalog", { userId: demoContext.hostUserId }),
  patchWorldCatalog: (catalogPublic, worldId = demoContext.worldId) =>
    request(`/worlds/${worldId}/catalog`, { userId: demoContext.hostUserId, method: "PATCH", body: { catalogPublic } }),
  requestCatalogReview: (payload, worldId = demoContext.worldId) =>
    request(`/worlds/${worldId}/catalog/request`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  joinWorldCatalog: (worldId) =>
    request(`/worlds/${worldId}/catalog/join`, { userId: demoContext.hostUserId, method: "POST", body: {} }),
  getWorld: (worldId = demoContext.worldId) => request(`/worlds/${worldId}`, { userId: demoContext.hostUserId }),
  patchWorld: (payload, worldId = demoContext.worldId, { revision } = {}) =>
    worldWrite(`/worlds/${worldId}`, { worldId, method: "PATCH", body: payload, revision }),
  patchRoomSettings: (settings, roomId = demoContext.roomId) =>
    request(`/rooms/${roomId}/settings`, { userId: demoContext.hostUserId, method: "PATCH", body: { settings } }),
  deleteWorld: (worldId = demoContext.worldId) => request(`/worlds/${worldId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  getWorldRooms: (worldId = demoContext.worldId) => request(`/worlds/${worldId}/rooms`, { userId: demoContext.hostUserId }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  createGuest: (payload = {}) => request("/auth/guest", { method: "POST", body: payload }),
  completeOAuth: (code) => request("/auth/oauth/complete", { method: "POST", body: { code } }),
  oauthStartUrl: (provider) => request(`/auth/oauth/${provider}/start-url`, { method: "POST", body: {} }),
  upgradeGuest: (payload) => request("/auth/upgrade", { method: "POST", body: payload }),
  listSessions: () => request("/auth/sessions"),
  revokeSession: (sessionId) => request(`/auth/sessions/${sessionId}`, { method: "DELETE" }),
  logoutAllDevices: () => request("/auth/logout-all", { method: "POST", body: {} }),
  getAuthConfig: () => request("/auth/config"),
  verifyEmail: (payload) => request("/auth/verify-email", { method: "POST", body: payload }),
  resendVerification: () => request("/auth/resend-verification", { method: "POST", body: {} }),
  requestPasswordReset: (payload) => request("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: payload }),
  me: () => request("/auth/me"),
  getAccountEntitlements: () => request("/account/entitlements"),
  exportAccountData: () => request("/account/export"),
  submitPlanUpgradeRequest: (payload) =>
    request("/account/plan-upgrade-request", { method: "POST", body: payload }),
  previewAccountDelete: () => request("/account/delete/preview"),
  deleteAccount: (payload) => request("/account/delete", { method: "POST", body: payload }),
  listPhysicalTokens: (worldId, query = "") =>
    request(`/worlds/${worldId || demoContext.worldId}/physical-tokens${query ? `?${query}` : ""}`, { userId: demoContext.hostUserId }),
  createPhysicalTokens: (payload, worldId = demoContext.worldId) =>
    request(`/worlds/${worldId}/physical-tokens`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  revokePhysicalToken: (tokenId, worldId = demoContext.worldId) =>
    request(`/worlds/${worldId}/physical-tokens/${tokenId}/revoke`, { userId: demoContext.hostUserId, method: "POST" }),
  previewPhysicalToken: (tokenCode) => request(`/physical-tokens/${encodeURIComponent(tokenCode)}/preview`),
  activatePhysicalToken: (roomId, payload) =>
    request(`/rooms/${roomId || demoContext.roomId}/physical-tokens/activate`, {
      userId: demoContext.playerUserId,
      method: "POST",
      body: payload,
      idempotent: true
    }),
  getAccountPlans: () => request("/account/plans"),
  logout: async () => {
    const result = await request("/auth/logout", { method: "POST", body: {} });
    sessionAuth().markLoggedOut?.();
    return result;
  },
  async ensurePlayerSession() {
    if (sessionAuth().isAuthenticated?.()) return null;
    const result = await this.createGuest({});
    markSessionFromResponse(result);
    return result;
  },
  getPlayerHome: () => request(`/rooms/${demoContext.roomId}/player-home`, { userId: demoContext.playerUserId }),
  getVoiceMessages: (voiceRoomId) => request(`/voice-rooms/${voiceRoomId}/messages`, { userId: demoContext.playerUserId }),
  getVoiceRoomToken: (voiceRoomId, userId = demoContext.playerUserId) =>
    request(`/rooms/${demoContext.roomId}/voice-rooms/${voiceRoomId}/token`, { userId, method: "POST", body: {} }),
  sendVoiceMessage: (voiceRoomId, body) => request(`/voice-rooms/${voiceRoomId}/messages`, { userId: demoContext.playerUserId, method: "POST", body: { body } }),
  createVoiceRoom: (payload) => request(`/rooms/${demoContext.roomId}/voice-rooms`, { userId: demoContext.playerUserId, method: "POST", body: payload }),
  inviteVoiceRoomMembers: (voiceRoomId, inviteUserIds) => request(`/voice-rooms/${voiceRoomId}/members`, { userId: demoContext.playerUserId, method: "POST", body: { inviteUserIds } }),
  getRoomInvite: (inviteCode) => request(`/rooms/invite/${encodeURIComponent(inviteCode)}`, { userId: demoContext.playerUserId }),
  joinRoom: (inviteCode, roleSlotId) => request("/rooms/join", { userId: demoContext.playerUserId, method: "POST", body: { inviteCode, roleSlotId } }),
  completeSection: (sectionId) =>
    request(`/rooms/${demoContext.roomId}/sections/${sectionId}/complete`, { userId: demoContext.playerUserId, method: "POST", idempotent: true }),
  addNotebookEntry: (entry) => request(`/rooms/${demoContext.roomId}/notebook`, { userId: demoContext.playerUserId, method: "POST", body: entry }),
  deleteNotebookEntry: (entryId) =>
    request(`/rooms/${demoContext.roomId}/notebook/${entryId}`, { userId: demoContext.playerUserId, method: "DELETE" }),
  getHostProgress: () => request(`/rooms/${demoContext.roomId}/host-progress`, { userId: demoContext.hostUserId }),
  getHostPlayers: () => request(`/rooms/${demoContext.roomId}/host/players`, { userId: demoContext.hostUserId }),
  getHostPlayerDetail: (roleSlotId) =>
    request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}`, { userId: demoContext.hostUserId }),
  hostGrantClue: (payload) =>
    request(`/rooms/${demoContext.roomId}/host/grant-clue`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true }),
  hostUnlockSection: (payload) =>
    request(`/rooms/${demoContext.roomId}/host/unlock-section`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true }),
  hostUnlockScene: (sceneId) => request(`/rooms/${demoContext.roomId}/scenes/${sceneId}/unlock`, { userId: demoContext.hostUserId, method: "POST" }),
  hostAddLog: (payload) => request(`/rooms/${demoContext.roomId}/host/log`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  hostNudgeWaiting: (payload) =>
    request(`/rooms/${demoContext.roomId}/host/nudge-waiting`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  hostSaveNotes: (roleSlotId, notes) => request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}/notes`, { userId: demoContext.hostUserId, method: "PUT", body: { notes } }),
  getExploration: () => request(`/rooms/${demoContext.roomId}/exploration`, { userId: demoContext.playerUserId }),
  investigate: (pointId) =>
    request(`/rooms/${demoContext.roomId}/investigation-points/${pointId}/investigate`, { userId: demoContext.playerUserId, method: "POST", idempotent: true }),
  readClue: (clueId) => request(`/rooms/${demoContext.roomId}/clues/${clueId}/read`, { userId: demoContext.playerUserId, method: "POST" }),
  shareClueToRoom: (clueId, shared = true) =>
    request(`/rooms/${demoContext.roomId}/clues/${clueId}/share-room`, { userId: demoContext.playerUserId, method: "POST", body: { shared }, idempotent: true }),
  shareClueToRoles: (clueId, roleSlotIds) =>
    request(`/rooms/${demoContext.roomId}/clues/${clueId}/share-roles`, { userId: demoContext.playerUserId, method: "POST", body: { roleSlotIds }, idempotent: true }),
  updateCluePlayerNote: (clueId, note) => request(`/rooms/${demoContext.roomId}/clues/${clueId}/player-note`, { userId: demoContext.playerUserId, method: "PATCH", body: { note } }),
  getHostClueMatrix: () => request(`/rooms/${demoContext.roomId}/host/clue-matrix`, { userId: demoContext.hostUserId }),
  hostClueNote: (clueId, payload) => request(`/rooms/${demoContext.roomId}/host/clues/${clueId}/notes`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  getHostEvents: () => request(`/rooms/${demoContext.roomId}/host-events`, { userId: demoContext.hostUserId }),
  getHostAuditLog: (limit = 50) =>
    request(`/rooms/${demoContext.roomId}/host/audit-log?limit=${limit}`, { userId: demoContext.hostUserId }),
  executeHostEvent: (eventId) =>
    request(`/rooms/${demoContext.roomId}/host-events/${eventId}/execute`, { userId: demoContext.hostUserId, method: "POST", idempotent: true }),
  dismissHostEvent: (eventId) =>
    request(`/rooms/${demoContext.roomId}/host-events/${eventId}/dismiss`, { userId: demoContext.hostUserId, method: "POST", idempotent: true }),
  delayHostEvent: (eventId, delayMinutes) =>
    request(`/rooms/${demoContext.roomId}/host-events/${eventId}/delay`, { userId: demoContext.hostUserId, method: "POST", body: { delayMinutes }, idempotent: true }),
  batchHostEvents: (action, eventIds) =>
    request(`/rooms/${demoContext.roomId}/host-events/batch`, {
      userId: demoContext.hostUserId,
      method: "POST",
      body: { action, eventIds },
      idempotent: true
    }),
  previewRoomRules: (roomId = demoContext.roomId) => request(`/rooms/${roomId}/rules/preview`, { userId: demoContext.hostUserId }),
  triggerManualRule: (ruleId, roomId = demoContext.roomId) =>
    request(`/rooms/${roomId}/rules/${ruleId}/trigger`, { userId: demoContext.hostUserId, method: "POST", idempotent: true }),
  getCheckpoints: () => request(`/rooms/${demoContext.roomId}/checkpoints`, { userId: demoContext.hostUserId }),
  getCheckpoint: (checkpointId) => request(`/rooms/${demoContext.roomId}/checkpoints/${checkpointId}`, { userId: demoContext.hostUserId }),
  getCheckpointRestores: (checkpointId) =>
    request(`/rooms/${demoContext.roomId}/checkpoints/${checkpointId}/restores`, { userId: demoContext.hostUserId }),
  createCheckpoint: (payload) =>
    request(`/rooms/${demoContext.roomId}/checkpoints`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  restoreCheckpoint: (checkpointId, { scope, targetRoomId } = {}) =>
    request(`/rooms/${targetRoomId || demoContext.roomId}/checkpoints/${checkpointId}/restore`, {
      userId: demoContext.hostUserId,
      method: "POST",
      body: { scope },
      idempotent: true
    }),
  getRecaps: () => request(`/rooms/${demoContext.roomId}/recaps`, { userId: demoContext.hostUserId }),
  getRecap: (recapId, asPlayer = false) =>
    request(`/rooms/${demoContext.roomId}/recaps/${recapId}`, { userId: asPlayer ? demoContext.playerUserId : demoContext.hostUserId }),
  getLatestRecap: (asPlayer = false) =>
    request(`/rooms/${demoContext.roomId}/recap/latest`, { userId: asPlayer ? demoContext.playerUserId : demoContext.hostUserId }),
  createRecap: (payload) => request(`/rooms/${demoContext.roomId}/recaps`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  createWorld: (payload) => request("/worlds", { userId: demoContext.hostUserId, method: "POST", body: payload }),
  bootstrapWorldFromWizard: (payload) =>
    request("/worlds/wizard/bootstrap", { userId: demoContext.hostUserId, method: "POST", body: payload }),
  getWorldTemplates: () => request("/platform/world-templates", { userId: demoContext.hostUserId }),
  createWorldFromTemplate: (templateId, payload = {}) =>
    request(`/worlds/from-template/${encodeURIComponent(templateId)}`, {
      userId: demoContext.hostUserId,
      method: "POST",
      body: payload
    }),
  createChapter: (worldId, payload) => worldWrite(`/worlds/${worldId}/chapters`, { worldId, method: "POST", body: payload }),
  createRole: (worldId, payload) => worldWrite(`/worlds/${worldId}/roles`, { worldId, method: "POST", body: payload }),
  updateRole: (roleId, payload) => worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}`, { method: "PUT", body: payload }),
  deleteRole: (roleId) => worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}`, { method: "DELETE" }),
  createSection: (worldId, roleId, payload) =>
    worldWrite(`/worlds/${worldId}/roles/${roleId}/sections`, { worldId, method: "POST", body: payload }),
  updateSection: (roleId, sectionId, payload) =>
    worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}/sections/${sectionId}`, { method: "PUT", body: payload }),
  deleteSection: (roleId, sectionId) =>
    worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}/sections/${sectionId}`, { method: "DELETE" }),
  updateChapter: (chapterId, payload) =>
    worldWrite(`/worlds/${demoContext.worldId}/chapters/${chapterId}`, { method: "PUT", body: payload }),
  getCreatorChecks: () => request(`/worlds/${demoContext.worldId}/creator-checks`, { userId: demoContext.hostUserId }),
  createContentVersion: (payload) => worldWrite(`/worlds/${demoContext.worldId}/content-versions`, { method: "POST", body: payload }),
  restoreContentVersion: (versionId) =>
    worldWrite(`/worlds/${demoContext.worldId}/content-versions/${versionId}/restore`, { method: "POST", body: {} }),
  deleteContentVersion: (versionId) =>
    worldWrite(`/worlds/${demoContext.worldId}/content-versions/${versionId}`, { method: "DELETE" }),
  createRoom: (worldId, payload) => request(`/worlds/${worldId}/rooms`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateRoomPublicListing: (worldId, roomId, publicListing) =>
    request(`/worlds/${worldId}/rooms/${roomId}/listing`, {
      userId: demoContext.hostUserId,
      method: "PATCH",
      body: { publicListing }
    }),
  getStudio: () => request(`/worlds/${demoContext.worldId}/studio`, { userId: demoContext.hostUserId }),
  createScene: (payload) => worldWrite(`/worlds/${demoContext.worldId}/scenes`, { method: "POST", body: payload }),
  updateScene: (sceneId, payload) => worldWrite(`/worlds/${demoContext.worldId}/scenes/${sceneId}`, { body: payload }),
  createClue: (payload) => worldWrite(`/worlds/${demoContext.worldId}/clues`, { method: "POST", body: payload }),
  updateClue: (clueId, payload) => worldWrite(`/worlds/${demoContext.worldId}/clues/${clueId}`, { body: payload }),
  createItem: (payload) => worldWrite(`/worlds/${demoContext.worldId}/items`, { method: "POST", body: payload }),
  updateItem: (itemId, payload) => worldWrite(`/worlds/${demoContext.worldId}/items/${itemId}`, { body: payload }),
  deleteItem: (itemId) => worldWrite(`/worlds/${demoContext.worldId}/items/${itemId}`, { method: "DELETE" }),
  hostGrantItem: (payload) =>
    request(`/rooms/${demoContext.roomId}/host/grant-item`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true }),
  createInvestigationPoint: (sceneId, payload) =>
    worldWrite(`/worlds/${demoContext.worldId}/scenes/${sceneId}/investigation-points`, { method: "POST", body: payload }),
  updateInvestigationPoint: (pointId, payload) =>
    worldWrite(`/worlds/${demoContext.worldId}/investigation-points/${pointId}`, { body: payload }),
  getStudioNodeReferences: (nodeType, nodeId) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/references`, { userId: demoContext.hostUserId }),
  createStudioChapter: (payload) => worldWrite(`/worlds/${demoContext.worldId}/chapters`, { method: "POST", body: payload }),
  createStoryEdge: (payload) => worldWrite(`/worlds/${demoContext.worldId}/story-edges`, { method: "POST", body: payload }),
  analyzeStoryDraft: (text) => request(`/worlds/${demoContext.worldId}/story-assistant/analyze`, { userId: demoContext.hostUserId, method: "POST", body: { text } }),
  importStoryDraft: (text) => request(`/worlds/${demoContext.worldId}/story-assistant/import`, { userId: demoContext.hostUserId, method: "POST", body: { text } }),
  getDeepseekStatus: () => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/status`, { userId: demoContext.hostUserId }),
  proposeWithDeepseek: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importDeepseekProposal: (proposal) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/import`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: { proposal },
    timeoutMs: PIPELINE_IMPORT_TIMEOUT_MS,
    idempotent: true
  }),
  deepseekPipelineSpec: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/spec`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineOutline: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/outline`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineStructure: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/structure`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineRoleMatrix: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/role-matrix`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineSection: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/section`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineManuscriptSynopsis: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/manuscript-synopsis`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importDeepseekPipeline: (pipeline) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/import`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: { pipeline },
    timeoutMs: PIPELINE_IMPORT_TIMEOUT_MS,
    idempotent: true
  }),
  deepseekPipelineEvaluate: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/evaluate`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: 240_000
  }),
  deepseekPipelineNarrativeChapter: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/chapter`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineNarrativeRolesMeta: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/roles-meta`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineNarrativeRoleScript: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/role-script`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: payload?.chapterKey ? 180_000 : 420_000
  }),
  deepseekPipelineNarrativeRoles: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/roles`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineNarrativeExtractStructure: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/narrative/extract-structure`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  proposeFullMysteryWithDeepseek: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/full-mystery/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 600_000 }),
  importFullMysteryWithDeepseek: (mystery) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/full-mystery/import`, { userId: demoContext.hostUserId, method: "POST", body: { mystery } }),
  getWorldMembers: async () => {
    const payload = await request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId });
    return Array.isArray(payload) ? payload : payload.members ?? [];
  },
  getWorldMemberInvites: async () => {
    const payload = await request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId });
    return Array.isArray(payload) ? [] : payload.pendingInvites ?? [];
  },
  addWorldMember: (payload) => request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  acceptWorldInvite: (token) => request("/worlds/invites/accept", { method: "POST", body: { token } }),
  resendWorldInvite: (inviteId) => request(`/worlds/${demoContext.worldId}/invites/${inviteId}/resend`, { userId: demoContext.hostUserId, method: "POST" }),
  revokeWorldInvite: (inviteId) => request(`/worlds/${demoContext.worldId}/invites/${inviteId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  updateWorldMember: (userId, role) => request(`/worlds/${demoContext.worldId}/members/${userId}`, { userId: demoContext.hostUserId, method: "PUT", body: { role } }),
  deleteWorldMember: (userId) => request(`/worlds/${demoContext.worldId}/members/${userId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  getWorldLogs: (params = {}) => request(`/worlds/${demoContext.worldId}/logs?${new URLSearchParams(params)}`, { userId: demoContext.hostUserId }),
  getWorldHostAuditLog: (limit = 50) =>
    request(`/worlds/${demoContext.worldId}/host-audit-log?limit=${limit}`, { userId: demoContext.hostUserId }),
  parseDocument: (payload) => request(`/worlds/${demoContext.worldId}/documents/parse`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importParsedDocument: (payload) =>
    worldWrite(`/worlds/${demoContext.worldId}/documents/import`, { method: "POST", body: payload }),
  importDocumentPages: (payload) => request(`/worlds/${demoContext.worldId}/documents/import-pages`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  getStoryManuscript: () => request(`/worlds/${demoContext.worldId}/story-manuscript`, { userId: demoContext.hostUserId }),
  saveStoryManuscript: (body) => request(`/worlds/${demoContext.worldId}/story-manuscript`, { userId: demoContext.hostUserId, method: "PUT", body: { body } }),
  syncStoryManuscriptFromGraph: () => request(`/worlds/${demoContext.worldId}/story-manuscript/sync-from-graph`, { userId: demoContext.hostUserId, method: "POST", body: {} }),
  syncStoryManuscriptToGraph: (body) =>
    worldWrite(`/worlds/${demoContext.worldId}/story-manuscript/sync-to-graph`, { method: "POST", body: { body } }),
  getRules: () => request(`/worlds/${demoContext.worldId}/rules`, { userId: demoContext.hostUserId }),
  createRule: (payload) => worldWrite(`/worlds/${demoContext.worldId}/rules`, { method: "POST", body: payload }),
  updateRule: (ruleId, payload) => worldWrite(`/worlds/${demoContext.worldId}/rules/${ruleId}`, { method: "PUT", body: payload }),
  deleteRule: (ruleId) => worldWrite(`/worlds/${demoContext.worldId}/rules/${ruleId}`, { method: "DELETE" }),
  validateRules: () => request(`/worlds/${demoContext.worldId}/rules/validate`, { userId: demoContext.hostUserId, method: "POST", body: {} }),
  validateRuleBody: (payload) => request(`/worlds/${demoContext.worldId}/rules/validate-body`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  exportContentPackage: () => request(`/worlds/${demoContext.worldId}/content-package`, { userId: demoContext.hostUserId }),
  getContentPackageSummary: () => request(`/worlds/${demoContext.worldId}/content-package/summary`, { userId: demoContext.hostUserId }),
  previewContentPackageImport: (payload) => request(`/worlds/${demoContext.worldId}/content-package/preview`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  previewNewWorldContentPackage: (payload) => request("/content-package/preview-new-world", { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importContentPackage: (payload) =>
    worldWrite(`/worlds/${demoContext.worldId}/content-package/import`, { method: "POST", body: payload }),
  importContentPackageAsNewWorld: (payload) => request("/worlds/from-content-package", { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deleteStoryEdge: (edgeId) => worldWrite(`/worlds/${demoContext.worldId}/story-edges/${edgeId}`, { method: "DELETE" }),
  deleteStudioNode: (nodeType, nodeId) =>
    worldWrite(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}`, { method: "DELETE" }),
  updateStudioNodePosition: (nodeType, nodeId, payload) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/position`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  updateStudioNodeAnchors: (nodeType, nodeId, anchors) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/anchors`, { userId: demoContext.hostUserId, method: "PUT", body: { anchors } }),
  updateStoryLayout: (positions) => request(`/worlds/${demoContext.worldId}/story-layout`, { userId: demoContext.hostUserId, method: "PUT", body: { positions } }),
  autoStoryLayout: (mode = "scene-tree") => request(`/worlds/${demoContext.worldId}/story-layout/auto`, { userId: demoContext.hostUserId, method: "POST", body: { mode } }),
  getStorageUsage: () => request("/storage/usage", { userId: demoContext.hostUserId }),
  getAssets: (params = {}) => {
    const query = new URLSearchParams();
    if (params.kind) query.set("kind", params.kind);
    if (params.q) query.set("q", params.q);
    if (params.recycled) query.set("recycled", "1");
    const qs = query.toString();
    return request(`/worlds/${demoContext.worldId}/assets${qs ? `?${qs}` : ""}`, { userId: demoContext.hostUserId });
  },
  deleteAsset: (assetId) => request(`/assets/${assetId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  restoreAsset: (assetId) => request(`/assets/${assetId}/restore`, { userId: demoContext.hostUserId, method: "POST" }),
  getAssetDownloadUrl: (assetId) => request(`/assets/${assetId}/download-url`, { userId: demoContext.hostUserId }),
  searchWorld: (q, { limit, type } = {}) => {
    const query = new URLSearchParams({ q: String(q).trim() });
    if (limit) query.set("limit", String(limit));
    if (type && type !== "all") query.set("type", type);
    return request(`/worlds/${demoContext.worldId}/search?${query}`, { userId: demoContext.hostUserId });
  },
  async uploadAsset(file) {
    const ticket = await request("/assets/upload-url", {
      userId: demoContext.hostUserId,
      method: "POST",
      body: {
        worldId: demoContext.worldId,
        filename: file.name,
        contentType: file.type,
        byteSize: file.size,
        visibility: "author"
      }
    });
    const upload = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.requiredHeaders,
      body: file
    });
    if (!upload.ok) throw new Error("上传失败，请检查网络或存储配置");
    return request(`/assets/${ticket.assetId}/confirm`, {
      userId: demoContext.hostUserId,
      method: "POST"
    });
  },

  /** SSE via fetch (supports Bearer / x-user-id). onEvent(type, data); type "__connected__" on open. */
  streamRoomEvents(roomId, onEvent, signal, userId = demoContext.hostUserId) {
    const headers = { Accept: "text/event-stream", ...authHeaders(userId) };
    const cursor = localStorage.getItem(sseCursorKey(roomId));
    if (cursor) headers["Last-Event-ID"] = cursor;

    return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal, credentials: "include" }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(friendlyApiError(err, `连接实时推送失败（${res.status}）`));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const idLine = block.split("\n").find((l) => l.startsWith("id: "));
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
          if (idLine) {
            const eventId = idLine.slice(4).trim();
            if (eventId) localStorage.setItem(sseCursorKey(roomId), eventId);
          }
          if (!dataLine) continue;
          try {
            const msg = JSON.parse(dataLine.slice(6));
            if (msg.type === "connected") {
              onEvent("__connected__", msg);
              continue;
            }
            if (msg.type === "heartbeat") continue;
            const { type, at, roomId: rid, ...rest } = msg;
            if (type) onEvent(type, rest);
          } catch {
            /* ignore malformed */
          }
        }
      }
    });
  }
};
window.zhimuSessionReady = (async () => {
  try {
    const me = await request("/auth/me");
    if (!sessionAuth().legacyToken?.()) sessionAuth().markAuthenticated?.();
    return me;
  } catch {
    if (sessionAuth().legacyToken?.()) sessionAuth().markLoggedOut?.();
    return null;
  }
})();
export {};
