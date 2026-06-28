/**
 * Content domain — documents, story manuscript, rules, content packages.
 */
import { demoContext, request, worldWrite } from "./client.js";

/* ── Documents ── */

export function parseDocument(payload) {
  return request(`/worlds/${demoContext.worldId}/documents/parse`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function importParsedDocument(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/documents/import`, { method: "POST", body: payload });
}

export function importDocumentPages(payload) {
  return request(`/worlds/${demoContext.worldId}/documents/import-pages`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

/* ── Story manuscript ── */

export function getStoryManuscript() {
  return request(`/worlds/${demoContext.worldId}/story-manuscript`, { userId: demoContext.hostUserId });
}

export function saveStoryManuscript(body) {
  return request(`/worlds/${demoContext.worldId}/story-manuscript`, { userId: demoContext.hostUserId, method: "PUT", body: { body } });
}

export function syncStoryManuscriptFromGraph() {
  return request(`/worlds/${demoContext.worldId}/story-manuscript/sync-from-graph`, { userId: demoContext.hostUserId, method: "POST", body: {} });
}

export function syncStoryManuscriptToGraph(body) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-manuscript/sync-to-graph`, { method: "POST", body: { body } });
}

/* ── Rules ── */

export function getRules() {
  return request(`/worlds/${demoContext.worldId}/rules`, { userId: demoContext.hostUserId });
}

export function createRule(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/rules`, { method: "POST", body: payload });
}

export function updateRule(ruleId, payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/rules/${ruleId}`, { method: "PUT", body: payload });
}

export function deleteRule(ruleId) {
  return worldWrite(`/worlds/${demoContext.worldId}/rules/${ruleId}`, { method: "DELETE" });
}

export function validateRules() {
  return request(`/worlds/${demoContext.worldId}/rules/validate`, { userId: demoContext.hostUserId, method: "POST", body: {} });
}

export function validateRuleBody(payload) {
  return request(`/worlds/${demoContext.worldId}/rules/validate-body`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

/* ── Content packages ── */

export function exportContentPackage() {
  return request(`/worlds/${demoContext.worldId}/content-package`, { userId: demoContext.hostUserId });
}

export function getContentPackageSummary() {
  return request(`/worlds/${demoContext.worldId}/content-package/summary`, { userId: demoContext.hostUserId });
}

export function previewContentPackageImport(payload) {
  return request(`/worlds/${demoContext.worldId}/content-package/preview`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function previewNewWorldContentPackage(payload) {
  return request("/content-package/preview-new-world", { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function importContentPackage(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/content-package/import`, { method: "POST", body: payload });
}

export function importContentPackageAsNewWorld(payload) {
  return request("/worlds/from-content-package", { userId: demoContext.hostUserId, method: "POST", body: payload });
}
