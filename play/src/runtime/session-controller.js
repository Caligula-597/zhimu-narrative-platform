import { mergePortalProfileIntoUser } from "../../../shared/portal-profile-ui.js";

export function normalizeSessionUser(raw) {
  if (!raw) return null;
  const user = {
    id: raw.id,
    email: raw.email,
    displayName: raw.display_name || raw.displayName,
    isGuest: raw.isGuest ?? raw.user_kind === "guest",
    emailVerified: raw.emailVerified ?? Boolean(raw.email_verified_at)
  };
  const avatarUrl = raw.avatar_url || raw.avatarUrl;
  if (avatarUrl) user.avatarUrl = avatarUrl;
  return user;
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
        let user = normalizeSessionUser(await api.me());
        const profile = user && api.getPortalProfile
          ? await api.getPortalProfile("player").catch(() => null)
          : null;
        if (profile) user = mergePortalProfileIntoUser(user, profile);
        if (getSessionToken() === tokenAtStart) {
          state.user = user;
          state.portalProfile = profile;
        }
        return state.user;
      } catch (error) {
        if (error.status === 401 && !error.staleCredential && getSessionToken() === tokenAtStart) {
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
