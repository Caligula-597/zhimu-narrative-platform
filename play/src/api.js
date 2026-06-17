const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || "https://app.getzhimu.com").replace(/\/$/, "");
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "")
  ?? (import.meta.env.DEV ? "" : APP_ORIGIN);
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

const TOKEN_KEY = "zhimuSessionToken";

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", body, timeoutMs = 20000 } = {}) {
  const headers = { ...authHeaders() };
  if (body !== undefined) headers["content-type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload.error || payload.message || `请求失败 (${response.status})`);
      err.code = payload.code;
      err.status = response.status;
      err.details = payload.details;
      throw err;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export function getAppOrigin() {
  return APP_ORIGIN;
}

export function getPlayOrigin() {
  return window.location.origin;
}

export function getSessionToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = {
  authConfig: () => request("/auth/config"),
  guest: (displayName) => request("/auth/guest", { method: "POST", body: { displayName } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (email, displayName, password) =>
    request("/auth/register", { method: "POST", body: { email, displayName, password } }),
  oauthStartUrl: (provider, returnOrigin) =>
    request(`/auth/oauth/${provider}/start-url`, {
      method: "POST",
      body: returnOrigin ? { returnOrigin } : {}
    }),
  oauthComplete: (code) => request("/auth/oauth/complete", { method: "POST", body: { code } }),
  lookupInvite: (inviteCode) => request(`/rooms/invite/${encodeURIComponent(inviteCode)}`),
  joinRoom: (inviteCode, roleSlotId) =>
    request("/rooms/join", { method: "POST", body: { inviteCode, roleSlotId } }),
  playerHome: (roomId) => request(`/rooms/${roomId}/player-home`),
  completeSection: (roomId, sectionId) =>
    request(`/rooms/${roomId}/sections/${sectionId}/complete`, { method: "POST", body: {} }),
  exploration: (roomId) => request(`/rooms/${roomId}/exploration`),
  investigate: (roomId, pointId) =>
    request(`/rooms/${roomId}/investigation-points/${pointId}/investigate`, { method: "POST", body: {} }),
  readClue: (roomId, clueId) =>
    request(`/rooms/${roomId}/clues/${clueId}/read`, { method: "POST", body: {} }),
  platformSite: () => request("/platform/site"),
  officialExample: () => request("/platform/official-example"),
  joinOfficialExample: () => request("/platform/official-example/join", { method: "POST", body: {} })
};
