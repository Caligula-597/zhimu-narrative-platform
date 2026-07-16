/**
 * Canonical interpretation of an authentication probe.
 *
 * A local token or cookie is only a credential hint. `/auth/me` is the
 * authority: a valid user means authenticated, while only an explicit 401
 * means anonymous. Transport and server failures leave the last known session
 * in an unavailable state and must not silently log the user out.
 */

export function normalizeAuthenticatedUser(payload) {
  const user = payload?.user?.id ? payload.user : payload;
  return user?.id ? user : null;
}

export function isSessionRejection(error) {
  return Number(error?.status) === 401;
}

export function authProbeFailureStatus(error) {
  return isSessionRejection(error) ? "anonymous" : "unavailable";
}

const CREDENTIAL_ATTEMPT_PATH = /^\/auth\/(login|register|guest|forgot-password|reset-password|verify-email|oauth\/complete)(?:\/|$)/;

/** A failed login/code/reset attempt must not revoke an already active session. */
export function shouldInvalidateSessionForUnauthorized(path) {
  const normalized = String(path || "").replace(/^https?:\/\/[^/]+\/api/, "");
  return !CREDENTIAL_ATTEMPT_PATH.test(normalized);
}

/** Treat an already-expired session as a successful logout. */
export async function revokeSessionForLogout(requestLogout) {
  try {
    await requestLogout();
  } catch (error) {
    if (!isSessionRejection(error)) throw error;
  }
}
