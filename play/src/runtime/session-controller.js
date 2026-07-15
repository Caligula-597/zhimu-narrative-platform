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
  let loadSessionPromise = null;
  let loadSessionToken = null;
  let ensureSessionPromise = null;

  function loadSessionUser() {
    const tokenAtStart = getSessionToken();
    if (loadSessionPromise) {
      if (loadSessionToken === tokenAtStart) return loadSessionPromise;
      return loadSessionPromise.finally(() => loadSessionUser());
    }
    loadSessionToken = tokenAtStart;
    loadSessionPromise = (async () => {
      try {
        const user = normalizeSessionUser(await api.me());
        if (getSessionToken() === tokenAtStart) state.user = user;
        return state.user;
      } catch (error) {
        if (error.status === 401 && getSessionToken() === tokenAtStart) {
          clearSession();
          state.user = null;
        }
        return state.user;
      } finally {
        loadSessionPromise = null;
        loadSessionToken = null;
      }
    })();
    return loadSessionPromise;
  }

  function ensureSession() {
    if (getSessionToken()) return;
    if (ensureSessionPromise) return ensureSessionPromise;
    ensureSessionPromise = (async () => {
      const guestName = `Player${Math.floor(Math.random() * 9000 + 1000)}`;
      const result = await api.guest(guestName);
      if (!getSessionToken()) {
        setSessionToken(result.token);
        state.user = normalizeSessionUser(result.user);
      } else {
        await loadSessionUser();
      }
      return state.user;
    })().finally(() => {
      ensureSessionPromise = null;
    });
    return ensureSessionPromise;
  }

  function cleanAuthUrl() {
    const url = new URL(window.location.href);
    ["oauth_code", "oauth_error", "auth", "verify"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  return { cleanAuthUrl, ensureSession, loadSessionUser, normalizeUser: normalizeSessionUser };
}
