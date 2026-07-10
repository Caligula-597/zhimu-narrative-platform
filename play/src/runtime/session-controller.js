export function normalizeSessionUser(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.display_name || raw.displayName,
    isGuest: raw.isGuest ?? raw.user_kind === "guest",
    emailVerified: raw.emailVerified ?? Boolean(raw.email_verified_at)
  };
}

export function createSessionController({ api, state, clearSession, getSessionToken, setSessionToken }) {
  async function loadSessionUser() {
    try {
      state.user = normalizeSessionUser(await api.me());
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        state.user = null;
      }
    }
  }

  async function ensureSession() {
    if (getSessionToken()) return;
    const guestName = `Player${Math.floor(Math.random() * 9000 + 1000)}`;
    const result = await api.guest(guestName);
    setSessionToken(result.token);
    state.user = normalizeSessionUser(result.user);
  }

  function cleanAuthUrl() {
    const url = new URL(window.location.href);
    ["oauth_code", "oauth_error", "auth", "verify"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  return { cleanAuthUrl, ensureSession, loadSessionUser, normalizeUser: normalizeSessionUser };
}
