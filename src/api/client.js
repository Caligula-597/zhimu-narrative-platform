const runtimeConfig = window.zhimuConfig || {};
const API_BASE = runtimeConfig.apiBase || "/api";
const demoMode = Boolean(runtimeConfig.demoMode);
const demoUsers = runtimeConfig.demoUsers || {};
const demoWorld = runtimeConfig.demoWorld || {};
const friendlyApiError = window.zhimuUserMessages?.friendlyApiError || ((payload, fb) => payload.error || fb);

const demoContext = {
  hostUserId: demoUsers.hostUserId || "",
  playerUserId: demoUsers.playerUserId || "",
  worldId: demoWorld.worldId || "",
  roomId: demoWorld.roomId || ""
};
demoContext.worldId = localStorage.getItem("zhimuActiveWorldId") || demoContext.worldId;
demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${demoContext.worldId}`) || "";

function authHeaders(userId) {
  const headers = {};
  const sessionToken = localStorage.getItem("zhimuSessionToken");
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  else if (demoMode && userId) headers["x-user-id"] = userId;
  return headers;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sseCursorKey(roomId) {
  return `zhimuSseCursor:${roomId}`;
}

/** DeepSeek 单次生成常需 30～90 秒；默认 fetch 20 秒会误报超时 */
const DEEPSEEK_TIMEOUT_MS = 120_000;

function deepseekRequest(path, opts = {}) {
  return request(path, { ...opts, timeoutMs: opts.timeoutMs ?? DEEPSEEK_TIMEOUT_MS });
}

async function request(path, { userId, method = "GET", body, timeoutMs = 20000, idempotent = false, idempotencyKey } = {}, authRetry = false) {
  const headers = authHeaders(userId);
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
      signal: controller.signal
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        const err = new Error("无法连接后端 API。请确认已运行：cd backend && npm run dev（端口 4180）");
        err.code = "API_UNAVAILABLE";
        throw err;
      }
      const err = new Error(friendlyApiError(payload, `${method} ${path} failed`));
      err.code = payload.code;
      err.details = payload.details;
      if (response.status === 401 && !authRetry && localStorage.getItem("zhimuSessionToken")) {
        localStorage.removeItem("zhimuSessionToken");
        return request(path, { userId, method, body, timeoutMs, idempotent, idempotencyKey }, true);
      }
      throw err;
    }
    return response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      const secs = Math.round(timeoutMs / 1000);
      throw new Error(`请求超时（已等待 ${secs} 秒）。DeepSeek 生成较慢，请重试；若仍失败可在 backend/.env 增大 DEEPSEEK_TIMEOUT_MS，或减少章节/角色规模。`);
    }
    if (error instanceof TypeError) {
      throw new Error("无法连接后端 API。请确认已运行：cd backend && npm run dev（端口 4180）");
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
  selectRoom(roomId) { demoContext.roomId = roomId; localStorage.setItem(`zhimuActiveRoomId:${demoContext.worldId}`, roomId); },
  clearRoom() { demoContext.roomId = ""; localStorage.removeItem(`zhimuActiveRoomId:${demoContext.worldId}`); },
  loadKey() { return `${demoContext.worldId}:${demoContext.roomId}`; },
  getWorlds: (includeArchived = false) => request(`/worlds${includeArchived ? "?includeArchived=true" : ""}`, { userId: demoContext.hostUserId }),
  getWorldCatalog: () => request("/worlds/catalog", { userId: demoContext.hostUserId }),
  patchWorldCatalog: (catalogPublic, worldId = demoContext.worldId) =>
    request(`/worlds/${worldId}/catalog`, { userId: demoContext.hostUserId, method: "PATCH", body: { catalogPublic } }),
  joinWorldCatalog: (worldId) =>
    request(`/worlds/${worldId}/catalog/join`, { userId: demoContext.hostUserId, method: "POST", body: {} }),
  getWorld: (worldId = demoContext.worldId) => request(`/worlds/${worldId}`, { userId: demoContext.hostUserId }),
  patchWorld: (payload, worldId = demoContext.worldId) => request(`/worlds/${worldId}`, { userId: demoContext.hostUserId, method: "PATCH", body: payload }),
  patchRoomSettings: (settings, roomId = demoContext.roomId) =>
    request(`/rooms/${roomId}/settings`, { userId: demoContext.hostUserId, method: "PATCH", body: { settings } }),
  deleteWorld: (worldId = demoContext.worldId) => request(`/worlds/${worldId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  getWorldRooms: (worldId = demoContext.worldId) => request(`/worlds/${worldId}/rooms`, { userId: demoContext.hostUserId }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST", body: {} }),
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
  hostSaveNotes: (roleSlotId, notes) => request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}/notes`, { userId: demoContext.hostUserId, method: "PUT", body: { notes } }),
  getExploration: () => request(`/rooms/${demoContext.roomId}/exploration`, { userId: demoContext.playerUserId }),
  investigate: (pointId) =>
    request(`/rooms/${demoContext.roomId}/investigation-points/${pointId}/investigate`, { userId: demoContext.playerUserId, method: "POST", idempotent: true }),
  readClue: (clueId) => request(`/rooms/${demoContext.roomId}/clues/${clueId}/read`, { userId: demoContext.playerUserId, method: "POST" }),
  shareClueToRoom: (clueId, shared = true) =>
    request(`/rooms/${demoContext.roomId}/clues/${clueId}/share-room`, { userId: demoContext.playerUserId, method: "POST", body: { shared }, idempotent: true }),
  updateCluePlayerNote: (clueId, note) => request(`/rooms/${demoContext.roomId}/clues/${clueId}/player-note`, { userId: demoContext.playerUserId, method: "PATCH", body: { note } }),
  getHostClueMatrix: () => request(`/rooms/${demoContext.roomId}/host/clue-matrix`, { userId: demoContext.hostUserId }),
  hostClueNote: (clueId, payload) => request(`/rooms/${demoContext.roomId}/host/clues/${clueId}/notes`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  getHostEvents: () => request(`/rooms/${demoContext.roomId}/host-events`, { userId: demoContext.hostUserId }),
  executeHostEvent: (eventId) =>
    request(`/rooms/${demoContext.roomId}/host-events/${eventId}/execute`, { userId: demoContext.hostUserId, method: "POST", idempotent: true }),
  dismissHostEvent: (eventId) =>
    request(`/rooms/${demoContext.roomId}/host-events/${eventId}/dismiss`, { userId: demoContext.hostUserId, method: "POST", idempotent: true }),
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
  createChapter: (worldId, payload) => request(`/worlds/${worldId}/chapters`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  createRole: (worldId, payload) => request(`/worlds/${worldId}/roles`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateRole: (roleId, payload) => request(`/worlds/${demoContext.worldId}/roles/${roleId}`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  deleteRole: (roleId) => request(`/worlds/${demoContext.worldId}/roles/${roleId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  createSection: (worldId, roleId, payload) => request(`/worlds/${worldId}/roles/${roleId}/sections`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateSection: (roleId, sectionId, payload) => request(`/worlds/${demoContext.worldId}/roles/${roleId}/sections/${sectionId}`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  deleteSection: (roleId, sectionId) => request(`/worlds/${demoContext.worldId}/roles/${roleId}/sections/${sectionId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  updateChapter: (chapterId, payload) => request(`/worlds/${demoContext.worldId}/chapters/${chapterId}`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  getCreatorChecks: () => request(`/worlds/${demoContext.worldId}/creator-checks`, { userId: demoContext.hostUserId }),
  createContentVersion: (payload) => request(`/worlds/${demoContext.worldId}/content-versions`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  restoreContentVersion: (versionId) => request(`/worlds/${demoContext.worldId}/content-versions/${versionId}/restore`, { userId: demoContext.hostUserId, method: "POST", body: {} }),
  deleteContentVersion: (versionId) => request(`/worlds/${demoContext.worldId}/content-versions/${versionId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  createRoom: (worldId, payload) => request(`/worlds/${worldId}/rooms`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  getStudio: () => request(`/worlds/${demoContext.worldId}/studio`, { userId: demoContext.hostUserId }),
  createScene: (payload) => request(`/worlds/${demoContext.worldId}/scenes`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateScene: (sceneId, payload) => request(`/worlds/${demoContext.worldId}/scenes/${sceneId}`, { userId: demoContext.hostUserId, method: "PATCH", body: payload }),
  createClue: (payload) => request(`/worlds/${demoContext.worldId}/clues`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateClue: (clueId, payload) => request(`/worlds/${demoContext.worldId}/clues/${clueId}`, { userId: demoContext.hostUserId, method: "PATCH", body: payload }),
  createItem: (payload) => request(`/worlds/${demoContext.worldId}/items`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateItem: (itemId, payload) => request(`/worlds/${demoContext.worldId}/items/${itemId}`, { userId: demoContext.hostUserId, method: "PATCH", body: payload }),
  deleteItem: (itemId) => request(`/worlds/${demoContext.worldId}/items/${itemId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  hostGrantItem: (payload) =>
    request(`/rooms/${demoContext.roomId}/host/grant-item`, { userId: demoContext.hostUserId, method: "POST", body: payload, idempotent: true }),
  createInvestigationPoint: (sceneId, payload) => request(`/worlds/${demoContext.worldId}/scenes/${sceneId}/investigation-points`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateInvestigationPoint: (pointId, payload) => request(`/worlds/${demoContext.worldId}/investigation-points/${pointId}`, { userId: demoContext.hostUserId, method: "PATCH", body: payload }),
  getStudioNodeReferences: (nodeType, nodeId) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/references`, { userId: demoContext.hostUserId }),
  createStudioChapter: (payload) => request(`/worlds/${demoContext.worldId}/chapters`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  createStoryEdge: (payload) => request(`/worlds/${demoContext.worldId}/story-edges`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  analyzeStoryDraft: (text) => request(`/worlds/${demoContext.worldId}/story-assistant/analyze`, { userId: demoContext.hostUserId, method: "POST", body: { text } }),
  importStoryDraft: (text) => request(`/worlds/${demoContext.worldId}/story-assistant/import`, { userId: demoContext.hostUserId, method: "POST", body: { text } }),
  getDeepseekStatus: () => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/status`, { userId: demoContext.hostUserId }),
  proposeWithDeepseek: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importDeepseekProposal: (proposal) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/import`, { userId: demoContext.hostUserId, method: "POST", body: { proposal } }),
  deepseekPipelineSpec: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/spec`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineOutline: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/outline`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineStructure: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/structure`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineRoleMatrix: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/role-matrix`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineSection: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/section`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deepseekPipelineManuscriptSynopsis: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/manuscript-synopsis`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importDeepseekPipeline: (pipeline) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/import`, { userId: demoContext.hostUserId, method: "POST", body: { pipeline } }),
  deepseekPipelineEvaluate: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/pipeline/evaluate`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  proposeFullMysteryWithDeepseek: (payload) => deepseekRequest(`/worlds/${demoContext.worldId}/story-assistant/deepseek/full-mystery/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload, timeoutMs: 600_000 }),
  importFullMysteryWithDeepseek: (mystery) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/full-mystery/import`, { userId: demoContext.hostUserId, method: "POST", body: { mystery } }),
  getWorldMembers: () => request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId }),
  addWorldMember: (payload) => request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateWorldMember: (userId, role) => request(`/worlds/${demoContext.worldId}/members/${userId}`, { userId: demoContext.hostUserId, method: "PUT", body: { role } }),
  deleteWorldMember: (userId) => request(`/worlds/${demoContext.worldId}/members/${userId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  getWorldLogs: (params = {}) => request(`/worlds/${demoContext.worldId}/logs?${new URLSearchParams(params)}`, { userId: demoContext.hostUserId }),
  parseDocument: (payload) => request(`/worlds/${demoContext.worldId}/documents/parse`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importParsedDocument: (payload) => request(`/worlds/${demoContext.worldId}/documents/import`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  getStoryManuscript: () => request(`/worlds/${demoContext.worldId}/story-manuscript`, { userId: demoContext.hostUserId }),
  saveStoryManuscript: (body) => request(`/worlds/${demoContext.worldId}/story-manuscript`, { userId: demoContext.hostUserId, method: "PUT", body: { body } }),
  syncStoryManuscriptFromGraph: () => request(`/worlds/${demoContext.worldId}/story-manuscript/sync-from-graph`, { userId: demoContext.hostUserId, method: "POST", body: {} }),
  syncStoryManuscriptToGraph: (body) => request(`/worlds/${demoContext.worldId}/story-manuscript/sync-to-graph`, { userId: demoContext.hostUserId, method: "POST", body: { body } }),
  getRules: () => request(`/worlds/${demoContext.worldId}/rules`, { userId: demoContext.hostUserId }),
  createRule: (payload) => request(`/worlds/${demoContext.worldId}/rules`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateRule: (ruleId, payload) => request(`/worlds/${demoContext.worldId}/rules/${ruleId}`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  deleteRule: (ruleId) => request(`/worlds/${demoContext.worldId}/rules/${ruleId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  validateRules: () => request(`/worlds/${demoContext.worldId}/rules/validate`, { userId: demoContext.hostUserId, method: "POST", body: {} }),
  validateRuleBody: (payload) => request(`/worlds/${demoContext.worldId}/rules/validate-body`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  exportContentPackage: () => request(`/worlds/${demoContext.worldId}/content-package`, { userId: demoContext.hostUserId }),
  getContentPackageSummary: () => request(`/worlds/${demoContext.worldId}/content-package/summary`, { userId: demoContext.hostUserId }),
  previewContentPackageImport: (payload) => request(`/worlds/${demoContext.worldId}/content-package/preview`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  previewNewWorldContentPackage: (payload) => request("/content-package/preview-new-world", { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importContentPackage: (payload) => request(`/worlds/${demoContext.worldId}/content-package/import`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importContentPackageAsNewWorld: (payload) => request("/worlds/from-content-package", { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deleteStoryEdge: (edgeId) => request(`/worlds/${demoContext.worldId}/story-edges/${edgeId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  deleteStudioNode: (nodeType, nodeId) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  updateStudioNodePosition: (nodeType, nodeId, payload) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/position`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  updateStudioNodeAnchors: (nodeType, nodeId, anchors) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/anchors`, { userId: demoContext.hostUserId, method: "PUT", body: { anchors } }),
  updateStoryLayout: (positions) => request(`/worlds/${demoContext.worldId}/story-layout`, { userId: demoContext.hostUserId, method: "PUT", body: { positions } }),
  getStorageUsage: () => request("/storage/usage", { userId: demoContext.hostUserId }),
  getAssets: (params = {}) => {
    const query = new URLSearchParams();
    if (params.kind) query.set("kind", params.kind);
    if (params.q) query.set("q", params.q);
    const qs = query.toString();
    return request(`/worlds/${demoContext.worldId}/assets${qs ? `?${qs}` : ""}`, { userId: demoContext.hostUserId });
  },
  deleteAsset: (assetId) => request(`/assets/${assetId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
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
    const headers = { Accept: "text/event-stream" };
    const sessionToken = localStorage.getItem("zhimuSessionToken");
    if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
    else if (demoMode && userId) headers["x-user-id"] = userId;
    const cursor = localStorage.getItem(sseCursorKey(roomId));
    if (cursor) headers["Last-Event-ID"] = cursor;

    return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal }).then(async (res) => {
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
export {};
