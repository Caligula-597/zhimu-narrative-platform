/**
 * API client infrastructure — migrated to real ES Modules.
 * Contains only: request plumbing, auth headers, demo context, active-context state.
 * Domain methods live in ./auth.js, ./world.js, etc.
 * Aggregation + window.zhimuApi bridge lives in ./index.js.
 */
import { friendlyApiError } from "../utils/user-messages.js";

const runtimeConfig = window.zhimuConfig || {};
const API_BASE = runtimeConfig.apiBase || "/api";
const demoMode = Boolean(runtimeConfig.demoMode);
const demoUsers = runtimeConfig.demoUsers || {};
const sessionAuth = () => window.zhimuSessionAuth || {};

const demoContext = {
  hostUserId: demoUsers.hostUserId || "",
  playerUserId: demoUsers.playerUserId || "",
  worldId: "",
  roomId: ""
};
demoContext.worldId = localStorage.getItem("zhimuActiveWorldId") || "";
demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${demoContext.worldId}`) || "";

export { API_BASE, demoContext, demoMode };

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

export function authHeaders(userId, extra = {}) {
  const headers = sessionAuth().authHeaders?.() || {};
  if (!headers.authorization && demoMode && userId) headers["x-user-id"] = userId;
  const deviceLabel = clientDeviceLabel();
  if (deviceLabel && !extra["x-device-label"] && !headers["x-device-label"]) {
    headers["x-device-label"] = deviceLabel;
  }
  return { ...headers, ...extra };
}

export function markSessionFromResponse(result) {
  if (result?.token) sessionAuth().markAuthenticated?.(result.token);
  else if (result?.user?.id) sessionAuth().markAuthenticated?.();
  return result;
}

function resolveWorldRevision(worldId, explicit) {
  if (explicit != null) return explicit;
  return window.zhimuWorldRevision?.currentRevision?.(worldId) ?? null;
}

export function ifMatchHeaders(worldId, explicitRevision) {
  const revision = resolveWorldRevision(worldId, explicitRevision);
  if (revision == null) return {};
  return { "If-Match": `"${revision}"` };
}

export function trackWorldRevisionResponse(worldId, data) {
  if (data?.content_revision != null) {
    window.zhimuWorldRevision?.applySavedRevision?.(worldId, data.content_revision);
  }
  return data;
}

export function worldWrite(path, { worldId = demoContext.worldId, userId = demoContext.hostUserId, method = "PATCH", body, revision, ...rest } = {}) {
  return request(path, {
    userId,
    method,
    body,
    headers: ifMatchHeaders(worldId, revision),
    ...rest
  }).then((data) => trackWorldRevisionResponse(worldId, data));
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sseCursorKey(roomId) {
  return `zhimuSseCursor:${roomId}`;
}

export function opsToken() {
  return sessionStorage.getItem("zhimuOpsToken") || "";
}

export function opsRequest(path, options = {}) {
  const token = opsToken();
  const headers = token ? { "x-ops-token": token } : {};
  return request(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}

/** 普通 DeepSeek 步骤；须 ≥ 后端单次 DEEPSEEK_TIMEOUT_MS（默认 180s） */
export const DEEPSEEK_TIMEOUT_MS = 180_000;
/** 逐章总剧情含续写，后端最多 2 轮 × 180s */
export const DEEPSEEK_CHAPTER_NARRATIVE_TIMEOUT_MS = 420_000;
/** 上传编排/分幕到云端（多角色多章节时可能较慢） */
export const PIPELINE_IMPORT_TIMEOUT_MS = 180_000;

export function deepseekRequest(path, opts = {}) {
  const isChapterNarrative = /\/narrative\/chapter$/.test(path);
  const defaultTimeout = isChapterNarrative ? DEEPSEEK_CHAPTER_NARRATIVE_TIMEOUT_MS : DEEPSEEK_TIMEOUT_MS;
  return request(path, { ...opts, timeoutMs: opts.timeoutMs ?? defaultTimeout });
}

export async function request(path, { userId, method = "GET", body, timeoutMs = 20000, idempotent = false, idempotencyKey, headers: extraHeaders = {} } = {}, authRetry = false) {
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

/* ── Active context state (not API calls) ── */

export function selectWorld(worldId) {
  demoContext.worldId = worldId;
  demoContext.roomId = localStorage.getItem(`zhimuActiveRoomId:${worldId}`) || "";
  localStorage.setItem("zhimuActiveWorldId", worldId);
}

export function clearWorld() {
  demoContext.worldId = "";
  demoContext.roomId = "";
  localStorage.removeItem("zhimuActiveWorldId");
}

/** Drop active world/room — call on login, register, or logout to avoid demo world leaking into real accounts. */
export function resetActiveWorld() {
  clearWorld();
  clearRoom();
}

export function selectRoom(roomId) {
  demoContext.roomId = roomId;
  localStorage.setItem(`zhimuActiveRoomId:${demoContext.worldId}`, roomId);
}

export function clearRoom() {
  demoContext.roomId = "";
  localStorage.removeItem(`zhimuActiveRoomId:${demoContext.worldId}`);
}

export function loadKey() {
  return `${demoContext.worldId}:${demoContext.roomId}`;
}

/* ── Session bootstrap (runs on module load) ── */

window.zhimuSessionReady = (async () => {
  try {
    const me = await request("/auth/me");
    if (me?.id && window.zhimuState) window.zhimuState.currentUser = me;
    if (!sessionAuth().legacyToken?.()) sessionAuth().markAuthenticated?.();
    return me;
  } catch {
    if (sessionAuth().legacyToken?.()) sessionAuth().markLoggedOut?.();
    return null;
  }
})();
