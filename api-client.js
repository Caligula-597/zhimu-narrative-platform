const runtimeConfig = window.zhimuConfig || {};
const API_BASE = runtimeConfig.apiBase || "/api";
const demoMode = Boolean(runtimeConfig.demoMode);
const demoUsers = runtimeConfig.demoUsers || {};
const demoWorld = runtimeConfig.demoWorld || {};

const demoContext = {
  hostUserId: demoUsers.hostUserId || "",
  playerUserId: demoUsers.playerUserId || "",
  worldId: demoWorld.worldId || "",
  roomId: demoWorld.roomId || ""
};
demoContext.worldId = localStorage.getItem("zhimuActiveWorldId") || demoContext.worldId;
demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${demoContext.worldId}`) || "";

async function request(path, { userId, method = "GET", body } = {}) {
  const headers = {};
  const sessionToken = localStorage.getItem("zhimuSessionToken");
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  if (demoMode && userId && !sessionToken) headers["x-user-id"] = userId;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `${method} ${path} failed`);
  }
  return response.json();
}

window.zhimuApi = {
  context: demoContext,
  selectWorld(worldId) { demoContext.worldId = worldId; demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${worldId}`) || ""; localStorage.setItem("zhimuActiveWorldId", worldId); },
  selectRoom(roomId) { demoContext.roomId = roomId; localStorage.setItem(`zhimuActiveRoomId:${demoContext.worldId}`, roomId); },
  clearRoom() { demoContext.roomId = ""; localStorage.removeItem(`zhimuActiveRoomId:${demoContext.worldId}`); },
  getWorlds: () => request("/worlds", { userId: demoContext.hostUserId }),
  getWorldRooms: (worldId = demoContext.worldId) => request(`/worlds/${worldId}/rooms`, { userId: demoContext.hostUserId }),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST", body: {} }),
  getPlayerHome: () => request(`/rooms/${demoContext.roomId}/player-home`, { userId: demoContext.playerUserId }),
  getVoiceMessages: (voiceRoomId) => request(`/voice-rooms/${voiceRoomId}/messages`, { userId: demoContext.playerUserId }),
  sendVoiceMessage: (voiceRoomId, body) => request(`/voice-rooms/${voiceRoomId}/messages`, { userId: demoContext.playerUserId, method: "POST", body: { body } }),
  createVoiceRoom: (payload) => request(`/rooms/${demoContext.roomId}/voice-rooms`, { userId: demoContext.playerUserId, method: "POST", body: payload }),
  inviteVoiceRoomMembers: (voiceRoomId, inviteUserIds) => request(`/voice-rooms/${voiceRoomId}/members`, { userId: demoContext.playerUserId, method: "POST", body: { inviteUserIds } }),
  getRoomInvite: (inviteCode) => request(`/rooms/invite/${encodeURIComponent(inviteCode)}`, { userId: demoContext.playerUserId }),
  joinRoom: (inviteCode, roleSlotId) => request("/rooms/join", { userId: demoContext.playerUserId, method: "POST", body: { inviteCode, roleSlotId } }),
  completeSection: (sectionId) => request(`/rooms/${demoContext.roomId}/sections/${sectionId}/complete`, { userId: demoContext.playerUserId, method: "POST" }),
  addNotebookEntry: (entry) => request(`/rooms/${demoContext.roomId}/notebook`, { userId: demoContext.playerUserId, method: "POST", body: entry }),
  getHostProgress: () => request(`/rooms/${demoContext.roomId}/host-progress`, { userId: demoContext.hostUserId }),
  getHostPlayers: () => request(`/rooms/${demoContext.roomId}/host/players`, { userId: demoContext.hostUserId }),
  getHostPlayerDetail: (roleSlotId) => request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}`, { userId: demoContext.hostUserId }),
  hostGrantClue: (payload) => request(`/rooms/${demoContext.roomId}/host/grant-clue`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  hostUnlockSection: (payload) => request(`/rooms/${demoContext.roomId}/host/unlock-section`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  hostUnlockScene: (sceneId) => request(`/rooms/${demoContext.roomId}/scenes/${sceneId}/unlock`, { userId: demoContext.hostUserId, method: "POST" }),
  hostAddLog: (payload) => request(`/rooms/${demoContext.roomId}/host/log`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  hostSaveNotes: (roleSlotId, notes) => request(`/rooms/${demoContext.roomId}/host/players/${roleSlotId}/notes`, { userId: demoContext.hostUserId, method: "PUT", body: { notes } }),
  getExploration: () => request(`/rooms/${demoContext.roomId}/exploration`, { userId: demoContext.playerUserId }),
  investigate: (pointId) => request(`/rooms/${demoContext.roomId}/investigation-points/${pointId}/investigate`, { userId: demoContext.playerUserId, method: "POST" }),
  readClue: (clueId) => request(`/rooms/${demoContext.roomId}/clues/${clueId}/read`, { userId: demoContext.playerUserId, method: "POST" }),
  getHostEvents: () => request(`/rooms/${demoContext.roomId}/host-events`, { userId: demoContext.hostUserId }),
  executeHostEvent: (eventId) => request(`/rooms/${demoContext.roomId}/host-events/${eventId}/execute`, { userId: demoContext.hostUserId, method: "POST" }),
  dismissHostEvent: (eventId) => request(`/rooms/${demoContext.roomId}/host-events/${eventId}/dismiss`, { userId: demoContext.hostUserId, method: "POST" }),
  getCheckpoints: () => request(`/rooms/${demoContext.roomId}/checkpoints`, { userId: demoContext.hostUserId }),
  getCheckpoint: (checkpointId) => request(`/rooms/${demoContext.roomId}/checkpoints/${checkpointId}`, { userId: demoContext.hostUserId }),
  createCheckpoint: (payload) => request(`/rooms/${demoContext.roomId}/checkpoints`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
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
  createInvestigationPoint: (sceneId, payload) => request(`/worlds/${demoContext.worldId}/scenes/${sceneId}/investigation-points`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  updateInvestigationPoint: (pointId, payload) => request(`/worlds/${demoContext.worldId}/investigation-points/${pointId}`, { userId: demoContext.hostUserId, method: "PATCH", body: payload }),
  getStudioNodeReferences: (nodeType, nodeId) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/references`, { userId: demoContext.hostUserId }),
  createStudioChapter: (payload) => request(`/worlds/${demoContext.worldId}/chapters`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  createStoryEdge: (payload) => request(`/worlds/${demoContext.worldId}/story-edges`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  analyzeStoryDraft: (text) => request(`/worlds/${demoContext.worldId}/story-assistant/analyze`, { userId: demoContext.hostUserId, method: "POST", body: { text } }),
  importStoryDraft: (text) => request(`/worlds/${demoContext.worldId}/story-assistant/import`, { userId: demoContext.hostUserId, method: "POST", body: { text } }),
  getDeepseekStatus: () => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/status`, { userId: demoContext.hostUserId }),
  proposeWithDeepseek: (payload) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  importDeepseekProposal: (proposal) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/import`, { userId: demoContext.hostUserId, method: "POST", body: { proposal } }),
  proposeFullMysteryWithDeepseek: (payload) => request(`/worlds/${demoContext.worldId}/story-assistant/deepseek/full-mystery/propose`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
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
  exportContentPackage: () => request(`/worlds/${demoContext.worldId}/content-package`, { userId: demoContext.hostUserId }),
  importContentPackage: (payload) => request(`/worlds/${demoContext.worldId}/content-package/import`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  deleteStoryEdge: (edgeId) => request(`/worlds/${demoContext.worldId}/story-edges/${edgeId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  deleteStudioNode: (nodeType, nodeId) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
  updateStudioNodePosition: (nodeType, nodeId, payload) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/position`, { userId: demoContext.hostUserId, method: "PUT", body: payload }),
  updateStudioNodeAnchors: (nodeType, nodeId, anchors) => request(`/worlds/${demoContext.worldId}/studio-nodes/${nodeType}/${nodeId}/anchors`, { userId: demoContext.hostUserId, method: "PUT", body: { anchors } }),
  updateStoryLayout: (positions) => request(`/worlds/${demoContext.worldId}/story-layout`, { userId: demoContext.hostUserId, method: "PUT", body: { positions } }),
  getStorageUsage: () => request("/storage/usage", { userId: demoContext.hostUserId }),
  getAssets: () => request(`/worlds/${demoContext.worldId}/assets`, { userId: demoContext.hostUserId }),
  deleteAsset: (assetId) => request(`/assets/${assetId}`, { userId: demoContext.hostUserId, method: "DELETE" }),
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
    if (!upload.ok) throw new Error("对象存储上传失败，请检查 R2 CORS 设置");
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
    return fetch(`${API_BASE}/rooms/${roomId}/events/stream`, { headers, signal }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `SSE ${res.status}`);
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
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
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
