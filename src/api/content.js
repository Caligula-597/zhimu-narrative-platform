/**
 * Content domain — documents, story manuscript, rules, content packages.
 */
import { demoContext, request, worldWrite } from "./client.js";

/* ── Documents ── */

export function getImportSource() {
  return request(`/worlds/${demoContext.worldId}/import-source`, { userId: demoContext.hostUserId });
}

export function parseDocument(payload) {
  return request(`/worlds/${demoContext.worldId}/documents/parse`, { userId: demoContext.hostUserId, method: "POST", body: payload });
}

export function parseFeishuDocument(payload) {
  return request(`/worlds/${demoContext.worldId}/documents/feishu/parse`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: 60_000
  });
}

export function importParsedDocument(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/documents/import`, { method: "POST", body: payload });
}

export function importDocumentPages(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/documents/import-pages`, { method: "POST", body: payload });
}

export function previewOpeningPackage(payload) {
  return request(`/worlds/${demoContext.worldId}/opening-package/preview`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: 120_000
  });
}

export function commitOpeningPackage(payload) {
  return worldWrite(`/worlds/${demoContext.worldId}/opening-package/commit`, { method: "POST", body: payload });
}

/* ── Story manuscript ── */

export function getStoryManuscript() {
  return request(`/worlds/${demoContext.worldId}/story-manuscript`, { userId: demoContext.hostUserId });
}

export function saveStoryManuscript(body) {
  return worldWrite(`/worlds/${demoContext.worldId}/story-manuscript`, { method: "PUT", body: { body } });
}

export function syncStoryManuscriptFromGraph() {
  return worldWrite(`/worlds/${demoContext.worldId}/story-manuscript/sync-from-graph`, { method: "POST", body: {} });
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
