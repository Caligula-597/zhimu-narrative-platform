/**
 * World domain — worlds CRUD, catalog, members, invites, logs, templates,
 * physical tokens, search, chapters/roles/sections, content versions.
 */
import { request, worldWrite, demoContext } from "./client.js";

/* ── Worlds ── */

export function getWorlds(includeArchived = false) {
  return request(`/worlds${includeArchived ? "?includeArchived=true" : ""}`, { userId: demoContext.hostUserId });
}

export function getWorldCatalog(tagQuery = "") {
  const qs = tagQuery ? (tagQuery.startsWith("?") ? tagQuery : `?${tagQuery}`) : "";
  return request(`/worlds/catalog${qs}`, { userId: demoContext.hostUserId });
}

export function getCatalogTagFacets() {
  return request("/worlds/catalog/tag-facets", { userId: demoContext.hostUserId });
}

export function getWorldTags(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/tags`, { userId: demoContext.hostUserId });
}

export function putWorldTags(tags, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/tags`, { worldId, method: "PUT", body: { tags } });
}

export function getSegmentRemedies(worldId = demoContext.worldId, segmentKey = "") {
  const qs = segmentKey ? `?segmentKey=${encodeURIComponent(segmentKey)}` : "";
  return request(`/worlds/${worldId}/segment-remedies${qs}`, { userId: demoContext.hostUserId });
}

export function createSegmentRemedy(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/segment-remedies`, { worldId, method: "POST", body: payload });
}

export function updateSegmentRemedy(remedyId, payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/segment-remedies/${remedyId}`, { worldId, method: "PATCH", body: payload });
}

export function deleteSegmentRemedy(remedyId, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/segment-remedies/${remedyId}`, { worldId, method: "DELETE" });
}

export function patchWorldCatalog(catalogPublic, worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/catalog`, { userId: demoContext.hostUserId, method: "PATCH", body: { catalogPublic } });
}

export function requestCatalogReview(payload, worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/catalog/request`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function joinWorldCatalog(worldId) {
  return request(`/worlds/${worldId}/catalog/join`, { userId: demoContext.hostUserId, method: "POST", body: {} });
}

export function getWorld(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}`, { userId: demoContext.hostUserId });
}

export function patchWorld(payload, worldId = demoContext.worldId, { revision } = {}) {
  return worldWrite(`/worlds/${worldId}`, { worldId, method: "PATCH", body: payload, revision });
}

export function deleteWorld(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}`, { userId: demoContext.hostUserId, method: "DELETE" });
}

export function getWorldRooms(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/rooms`, { userId: demoContext.hostUserId });
}

export function createWorld(payload) {
  return request("/worlds", { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function bootstrapWorldFromWizard(payload) {
  return request("/worlds/wizard/bootstrap", { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function getWorldTemplates() {
  return request("/platform/world-templates", { userId: demoContext.hostUserId });
}

export function createWorldFromTemplate(templateId, payload = {}) {
  return request(`/worlds/from-template/${encodeURIComponent(templateId)}`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload
  });
}

/* ── Members / invites ── */

export async function getWorldMembers() {
  const payload = await request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId });
  return Array.isArray(payload) ? payload : payload.members ?? [];
}

export async function getWorldMemberInvites() {
  const payload = await request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId });
  return Array.isArray(payload) ? [] : payload.pendingInvites ?? [];
}

export function addWorldMember(payload) {
  return request(`/worlds/${demoContext.worldId}/members`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function acceptWorldInvite(token) {
  return request("/worlds/invites/accept", { method: "POST", body: { token } });
}

export function resendWorldInvite(inviteId) {
  return request(`/worlds/${demoContext.worldId}/invites/${inviteId}/resend`, { userId: demoContext.hostUserId, method: "POST" });
}

export function revokeWorldInvite(inviteId) {
  return request(`/worlds/${demoContext.worldId}/invites/${inviteId}`, { userId: demoContext.hostUserId, method: "DELETE" });
}

export function updateWorldMember(userId, role) {
  return request(`/worlds/${demoContext.worldId}/members/${userId}`, { userId: demoContext.hostUserId, method: "PUT", body: { role } });
}

export function deleteWorldMember(userId) {
  return request(`/worlds/${demoContext.worldId}/members/${userId}`, { userId: demoContext.hostUserId, method: "DELETE" });
}

/* ── Logs / checks ── */

export function getWorldLogs(params = {}) {
  return request(`/worlds/${demoContext.worldId}/logs?${new URLSearchParams(params)}`, { userId: demoContext.hostUserId });
}

export function getWorldHostAuditLog(limit = 50) {
  return request(`/worlds/${demoContext.worldId}/host-audit-log?limit=${limit}`, { userId: demoContext.hostUserId });
}

export function getCreatorChecks() {
  return request(`/worlds/${demoContext.worldId}/creator-checks`, { userId: demoContext.hostUserId });
}

export function getCreatorDashboard({ roomId, worldId } = {}) {
  const params = new URLSearchParams();
  if (roomId) params.set("roomId", roomId);
  const query = params.toString();
  const wid = worldId || demoContext.worldId;
  return request(`/worlds/${wid}/creator-dashboard${query ? `?${query}` : ""}`, {
    userId: demoContext.hostUserId
  });
}

export function getWorldSegments(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/segments`, { userId: demoContext.hostUserId });
}

export function createWorldSegment(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/segments`, { worldId, method: "POST", body: payload });
}

export function updateWorldSegment(segmentId, payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/segments/${segmentId}`, { worldId, method: "PATCH", body: payload });
}

export function syncWorldSegmentsFromGraph(worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/segments/sync-from-graph`, { worldId, method: "POST", body: {} });
}

export function getTruthClaims(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/truth-claims`, { userId: demoContext.hostUserId });
}

export function createTruthClaim(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/truth-claims`, { worldId, method: "POST", body: payload });
}

export function getRoleRelationships(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/role-relationships`, { userId: demoContext.hostUserId });
}

export function createRoleRelationship(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/role-relationships`, { worldId, method: "POST", body: payload });
}

export function getBibleSummary(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/bible/summary`, { userId: demoContext.hostUserId });
}

export function getCoreTrick(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/bible/core-trick`, { userId: demoContext.hostUserId });
}

export function patchCoreTrick(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/core-trick`, { worldId, method: "PATCH", body: payload });
}

export function getRoleArchives(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/bible/role-archives`, { userId: demoContext.hostUserId });
}

export function getRoleArchive(roleSlotId, worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/bible/role-archives/${roleSlotId}`, { userId: demoContext.hostUserId });
}

export function patchRoleArchive(roleSlotId, payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/role-archives/${roleSlotId}`, { worldId, method: "PATCH", body: payload });
}

export function getForeshadowBeats(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/bible/foreshadow-beats`, { userId: demoContext.hostUserId });
}

export function createForeshadowBeat(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/foreshadow-beats`, { worldId, method: "POST", body: payload });
}

export function patchForeshadowBeat(beatId, payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/foreshadow-beats/${beatId}`, { worldId, method: "PATCH", body: payload });
}

export function deleteForeshadowBeat(beatId, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/foreshadow-beats/${beatId}`, { worldId, method: "DELETE" });
}

export function getTimelineEvents(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/bible/timeline-events`, { userId: demoContext.hostUserId });
}

export function createTimelineEvent(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/timeline-events`, { worldId, method: "POST", body: payload });
}

export function patchTimelineEvent(eventId, payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/timeline-events/${eventId}`, { worldId, method: "PATCH", body: payload });
}

export function deleteTimelineEvent(eventId, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/bible/timeline-events/${eventId}`, { worldId, method: "DELETE" });
}

export function patchTruthClaim(claimId, payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/truth-claims/${claimId}`, { worldId, method: "PATCH", body: payload });
}

export function deleteTruthClaim(claimId, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/truth-claims/${claimId}`, { worldId, method: "DELETE" });
}

export function getCreatorAnalytics(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/creator-analytics`, { userId: demoContext.hostUserId });
}

export function getQualityReports(worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/quality-reports`, { userId: demoContext.hostUserId });
}

export function createQualityReport(payload, worldId = demoContext.worldId) {
  return worldWrite(`/worlds/${worldId}/quality-reports`, { worldId, method: "POST", body: payload });
}

export function getSegmentCompletion({ roomId, worldId } = {}) {
  const params = new URLSearchParams();
  if (roomId) params.set("roomId", roomId);
  const query = params.toString();
  const wid = worldId || demoContext.worldId;
  return request(`/worlds/${wid}/segment-completion${query ? `?${query}` : ""}`, {
    userId: demoContext.hostUserId
  });
}

export function getClueHitRate({ roomId, worldId } = {}) {
  const params = new URLSearchParams();
  if (roomId) params.set("roomId", roomId);
  const query = params.toString();
  const wid = worldId || demoContext.worldId;
  return request(`/worlds/${wid}/clue-hit-rate${query ? `?${query}` : ""}`, {
    userId: demoContext.hostUserId
  });
}

/* ── Physical tokens ── */

export function listPhysicalTokens(worldId, query = "") {
  return request(`/worlds/${worldId || demoContext.worldId}/physical-tokens${query ? `?${query}` : ""}`, { userId: demoContext.hostUserId });
}

export function createPhysicalTokens(payload, worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/physical-tokens`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function revokePhysicalToken(tokenId, worldId = demoContext.worldId) {
  return request(`/worlds/${worldId}/physical-tokens/${tokenId}/revoke`, { userId: demoContext.hostUserId, method: "POST" });
}

export function previewPhysicalToken(tokenCode) {
  return request(`/physical-tokens/${encodeURIComponent(tokenCode)}/preview`);
}

export function activatePhysicalToken(roomId, payload) {
  return request(`/rooms/${roomId || demoContext.roomId}/physical-tokens/activate`, {
    userId: demoContext.playerUserId,
    method: "POST",
    body: payload,
    idempotent: true
  });
}

/* ── Search ── */

export function searchWorld(q, { limit, type } = {}) {
  const query = new URLSearchParams({ q: String(q).trim() });
  if (limit) query.set("limit", String(limit));
  if (type && type !== "all") query.set("type", type);
  return request(`/worlds/${demoContext.worldId}/search?${query}`, { userId: demoContext.hostUserId });
}

/* ── Chapters / roles / sections ── */

export function createChapter(worldId, payload) {
  return worldWrite(`/worlds/${worldId}/chapters`, { worldId, method: "POST", body: payload });
}

export function createRole(worldId, payload) {
  return worldWrite(`/worlds/${worldId}/roles`, { worldId, method: "POST", body: payload });
}

export function updateRole(roleId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}`, { method: "PUT", body: payload });
}

export function deleteRole(roleId) {
  return worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}`, { method: "DELETE" });
}

export function createSection(worldId, roleId, payload) {
  return worldWrite(`/worlds/${worldId}/roles/${roleId}/sections`, { worldId, method: "POST", body: payload });
}

export function updateSection(roleId, sectionId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}/sections/${sectionId}`, { method: "PUT", body: payload });
}

export function deleteSection(roleId, sectionId) {
  return worldWrite(`/worlds/${demoContext.worldId}/roles/${roleId}/sections/${sectionId}`, { method: "DELETE" });
}

export function updateChapter(chapterId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/chapters/${chapterId}`, { method: "PUT", body: payload });
}

/* ── Content versions ── */

export function createContentVersion(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/content-versions`, { method: "POST", body: payload });
}

export function restoreContentVersion(versionId) {
  return worldWrite(`/worlds/${demoContext.worldId}/content-versions/${versionId}/restore`, { method: "POST", body: {} });
}

export function deleteContentVersion(versionId) {
  return worldWrite(`/worlds/${demoContext.worldId}/content-versions/${versionId}`, { method: "DELETE" });
}
