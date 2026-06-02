const API_BASE = "http://localhost:4180/api";

const demoContext = {
  hostUserId: "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
  playerUserId: "1d5e8155-a80f-4e7f-99f0-0ae317a35f35",
  worldId: "e0370ac3-65d4-4de1-89e3-d54ed51fa72a",
  roomId: "a65f94eb-a987-463c-bb81-aa482367e54a"
};
demoContext.worldId = localStorage.getItem("zhimuActiveWorldId") || demoContext.worldId;
demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${demoContext.worldId}`) || "";

async function request(path, { userId, method = "GET", body } = {}) {
  const headers = {};
  const sessionToken = localStorage.getItem("zhimuSessionToken");
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  if (userId) headers["x-user-id"] = userId;
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
  completeSection: (sectionId) => request(`/rooms/${demoContext.roomId}/sections/${sectionId}/complete`, { userId: demoContext.playerUserId, method: "POST" }),
  addNotebookEntry: (entry) => request(`/rooms/${demoContext.roomId}/notebook`, { userId: demoContext.playerUserId, method: "POST", body: entry }),
  getHostProgress: () => request(`/rooms/${demoContext.roomId}/host-progress`, { userId: demoContext.hostUserId }),
  getExploration: () => request(`/rooms/${demoContext.roomId}/exploration`, { userId: demoContext.playerUserId }),
  investigate: (pointId) => request(`/rooms/${demoContext.roomId}/investigation-points/${pointId}/investigate`, { userId: demoContext.playerUserId, method: "POST" }),
  readClue: (clueId) => request(`/rooms/${demoContext.roomId}/clues/${clueId}/read`, { userId: demoContext.playerUserId, method: "POST" }),
  getHostEvents: () => request(`/rooms/${demoContext.roomId}/host-events`, { userId: demoContext.hostUserId }),
  executeHostEvent: (eventId) => request(`/rooms/${demoContext.roomId}/host-events/${eventId}/execute`, { userId: demoContext.hostUserId, method: "POST" }),
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
  createClue: (payload) => request(`/worlds/${demoContext.worldId}/clues`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
  createInvestigationPoint: (sceneId, payload) => request(`/worlds/${demoContext.worldId}/scenes/${sceneId}/investigation-points`, { userId: demoContext.hostUserId, method: "POST", body: payload }),
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
  }
};
