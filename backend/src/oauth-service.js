import { createHash, randomBytes } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { resolveOAuthIdentity, redeemOAuthLoginCode } from "./oauth-identity-service.js";
import {
  oauthCallbackUrl,
  oauthFrontendReturnUrl,
  oauthProviderConfig,
  resolveOAuthReturnOrigin
} from "./oauth-providers.js";
import {
  deleteValidOAuthState,
  insertOAuthState
} from "./repositories/oauth-repository.js";
import { fetchUpstream, resolveUpstreamTimeoutMs } from "./upstream-fetch.js";

const STATE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;

function oauthTimeoutMs() {
  return resolveUpstreamTimeoutMs(process.env.OAUTH_REQUEST_TIMEOUT_MS);
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export async function createOAuthState(providerId, guestUserId = null, returnOrigin = null) {
  if (!oauthProviderConfig(providerId)) throwErr("OAUTH_PROVIDER_DISABLED");
  const state = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);
  const resolvedReturn = returnOrigin
    ? new URL(resolveOAuthReturnOrigin(returnOrigin)).origin
    : null;
  await insertOAuthState({
    stateHash: hash(state),
    providerId,
    guestUserId,
    expiresAt,
    returnOrigin: resolvedReturn
  });
  return state;
}

export async function consumeOAuthState(state, providerId) {
  const result = await deleteValidOAuthState({ stateHash: hash(state), providerId });
  if (!result) throwErr("OAUTH_STATE_INVALID");
  return {
    guestUserId: result.guest_user_id,
    returnOrigin: result.return_origin
  };
}

function createLoginCode() {
  const code = randomBytes(32).toString("base64url");
  return {
    code,
    challenge: {
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS)
    }
  };
}

export async function completeOAuthLoginCode(code, sessionMeta = {}) {
  return redeemOAuthLoginCode({
    codeHash: hash(String(code).trim()),
    sessionMeta
  });
}

async function exchangeAuthorizationCode(providerId, code) {
  const config = oauthProviderConfig(providerId);
  if (!config) throwErr("OAUTH_PROVIDER_DISABLED");

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: oauthCallbackUrl(providerId),
    grant_type: "authorization_code"
  });

  const response = await fetchUpstream(config.tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  }, { timeoutMs: oauthTimeoutMs() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throwErr("OAUTH_EXCHANGE_FAILED");
  }
  return payload.access_token;
}

async function fetchOAuthProfile(providerId, accessToken) {
  const config = oauthProviderConfig(providerId);
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${accessToken}`,
    "user-agent": "zhimu-narrative-platform"
  };

  const profileRes = await fetchUpstream(config.profileUrl, { headers }, { timeoutMs: oauthTimeoutMs() });
  const profile = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok) throwErr("OAUTH_EXCHANGE_FAILED");

  if (providerId === "google") {
    if (!profile.sub) throwErr("OAUTH_EXCHANGE_FAILED");
    return {
      providerUserId: String(profile.sub),
      email: profile.email?.trim().toLowerCase() || null,
      displayName: profile.name || profile.email?.split("@")[0] || "Google 用户",
      emailVerified: Boolean(profile.email_verified),
      raw: profile
    };
  }

  if (!profile.id) throwErr("OAUTH_EXCHANGE_FAILED");
  const publicEmail = profile.email?.trim().toLowerCase() || null;
  let email = null;
  let emailVerified = false;
  if (config.emailUrl) {
    const emailsRes = await fetchUpstream(config.emailUrl, { headers }, { timeoutMs: oauthTimeoutMs() });
    const emails = await emailsRes.json().catch(() => []);
    if (!emailsRes.ok || !Array.isArray(emails)) throwErr("OAUTH_EXCHANGE_FAILED");
    const verified = emails.filter((row) => row?.verified && row?.email);
    const selected = verified.find((row) => row.email.trim().toLowerCase() === publicEmail)
      || verified.find((row) => row.primary)
      || verified[0];
    email = selected?.email?.trim().toLowerCase() || null;
    emailVerified = Boolean(selected);
  }

  return {
    providerUserId: String(profile.id),
    email,
    displayName: profile.name || profile.login || "GitHub 用户",
    emailVerified,
    raw: profile
  };
}

export async function resolveOAuthUserForTests(providerId, profile, guestUserId = null) {
  const result = await resolveOAuthIdentity({ providerId, profile, guestUserId });
  return result.user.id;
}

export async function handleOAuthCallback(providerId, { code, state }) {
  if (!oauthProviderConfig(providerId)) throwErr("OAUTH_PROVIDER_DISABLED");
  const { guestUserId, returnOrigin } = await consumeOAuthState(state, providerId);
  const accessToken = await exchangeAuthorizationCode(providerId, code);
  const profile = await fetchOAuthProfile(providerId, accessToken);
  const loginCode = createLoginCode();
  await resolveOAuthIdentity({
    providerId,
    profile,
    guestUserId,
    loginCode: loginCode.challenge
  });
  const base = returnOrigin ? `${returnOrigin.replace(/\/$/, "")}/` : oauthFrontendReturnUrl();
  const redirectUrl = new URL(base);
  redirectUrl.searchParams.set("oauth_code", loginCode.code);
  return redirectUrl.toString();
}

export function buildOAuthAuthorizeUrl(providerId, state) {
  const config = oauthProviderConfig(providerId);
  if (!config) throwErr("OAUTH_PROVIDER_DISABLED");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: oauthCallbackUrl(providerId),
    response_type: "code",
    scope: config.scopes.join(" "),
    state
  });
  if (providerId === "github") params.set("allow_signup", "true");
  return `${config.authorizeUrl}?${params.toString()}`;
}
