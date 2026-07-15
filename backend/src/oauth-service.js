import { createHash, randomBytes } from "node:crypto";
import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { createSession } from "./auth.js";
import { acceptWorldMemberInvitesForEmail } from "./world-invites.js";
import { applyInternalBetaPrivileges } from "./internal-accounts.js";
import { applyApprovedBetaApplicationPrivileges } from "./beta-apply.js";
import { ensureUserPlan, initialPlanForEmail } from "./plans.js";
import {
  oauthCallbackUrl,
  oauthFrontendReturnUrl,
  oauthProviderConfig,
  resolveOAuthReturnOrigin
} from "./oauth-providers.js";
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
  const state = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);
  const resolvedReturn = returnOrigin
    ? new URL(resolveOAuthReturnOrigin(returnOrigin)).origin
    : null;
  await query(
    `INSERT INTO oauth_states (state_hash, provider, guest_user_id, expires_at, return_origin)
     VALUES ($1, $2, $3, $4, $5)`,
    [hash(state), providerId, guestUserId, expiresAt, resolvedReturn]
  );
  return state;
}

export async function consumeOAuthState(state, providerId) {
  const result = await query(
    `DELETE FROM oauth_states
     WHERE state_hash = $1 AND provider = $2 AND expires_at > now()
     RETURNING guest_user_id, return_origin`,
    [hash(state), providerId]
  );
  if (!result.rowCount) throwErr("OAUTH_STATE_INVALID");
  return {
    guestUserId: result.rows[0].guest_user_id,
    returnOrigin: result.rows[0].return_origin
  };
}

async function issueLoginCode(userId) {
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MS);
  await query(
    `INSERT INTO oauth_login_codes (code_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
    [hash(code), userId, expiresAt]
  );
  return code;
}

export async function completeOAuthLoginCode(code, sessionMeta = {}) {
  const result = await query(
    `DELETE FROM oauth_login_codes
     WHERE code_hash = $1 AND expires_at > now()
     RETURNING user_id`,
    [hash(code.trim())]
  );
  if (!result.rowCount) throwErr("OAUTH_LOGIN_CODE_INVALID");
  const session = await createSession(result.rows[0].user_id, sessionMeta);
  const user = await query(
    `SELECT id, email, display_name, email_verified_at, user_kind FROM users WHERE id = $1`,
    [result.rows[0].user_id]
  );
  return { user: user.rows[0], ...session };
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
    return {
      providerUserId: String(profile.sub),
      email: profile.email?.trim().toLowerCase() || null,
      displayName: profile.name || profile.email?.split("@")[0] || "Google 用户",
      emailVerified: Boolean(profile.email_verified),
      raw: profile
    };
  }

  let email = profile.email?.trim().toLowerCase() || null;
  let emailVerified = false;
  if (!email && config.emailUrl) {
    const emailsRes = await fetchUpstream(config.emailUrl, { headers }, { timeoutMs: oauthTimeoutMs() });
    const emails = await emailsRes.json().catch(() => []);
    const primary = Array.isArray(emails)
      ? emails.find((row) => row.primary && row.verified) || emails.find((row) => row.verified)
      : null;
    email = primary?.email?.trim().toLowerCase() || null;
    emailVerified = Boolean(primary?.verified);
  }

  return {
    providerUserId: String(profile.id),
    email,
    displayName: profile.name || profile.login || "GitHub 用户",
    emailVerified,
    raw: profile
  };
}

async function ensureStorageQuota(userId) {
  await query(
    `INSERT INTO storage_quotas (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function bootstrapOAuthAccount(userId, email) {
  await ensureUserPlan(userId, initialPlanForEmail(email));
  await applyInternalBetaPrivileges(userId, email);
  await applyApprovedBetaApplicationPrivileges(userId, email);
  await ensureStorageQuota(userId);
}

function rethrowOAuthDbError(error) {
  if (error?.code === "23503" || error?.code === "23505") {
    throwErr("OAUTH_EXCHANGE_FAILED");
  }
  throw error;
}

async function linkOAuthAccount(client, { providerId, providerUserId, userId, email, profile }) {
  await client.query(
    `INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email, profile)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (provider, provider_user_id)
     DO UPDATE SET user_id = EXCLUDED.user_id, email = EXCLUDED.email, profile = EXCLUDED.profile, updated_at = now()`,
    [providerId, providerUserId, userId, email, JSON.stringify(profile)]
  );
}

async function resolveOAuthUser(providerId, profile, guestUserId) {
  let bootstrapAccount = false;
  const userId = await transaction(async (client) => {
    const linked = await client.query(
      `SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2`,
      [providerId, profile.providerUserId]
    );
    if (linked.rowCount) {
      return linked.rows[0].user_id;
    }

    if (!profile.email) throwErr("OAUTH_EMAIL_REQUIRED");

    const byEmail = await client.query(
      `SELECT id, user_kind FROM users WHERE lower(email) = lower($1) AND user_kind = 'registered'`,
      [profile.email]
    );

    if (guestUserId) {
      const guest = await client.query(`SELECT id, user_kind FROM users WHERE id = $1`, [guestUserId]);
      if (guest.rowCount && guest.rows[0].user_kind === "guest") {
        if (byEmail.rowCount && byEmail.rows[0].id !== guestUserId) {
          throwErr("EMAIL_ALREADY_REGISTERED");
        }
        await client.query(
          `UPDATE users
           SET email = $2,
               display_name = COALESCE(NULLIF(display_name, ''), $3),
               user_kind = 'registered',
               email_verified_at = COALESCE(email_verified_at, now()),
               updated_at = now()
           WHERE id = $1`,
          [guestUserId, profile.email, profile.displayName.slice(0, 40)]
        );
        await linkOAuthAccount(client, {
          providerId,
          providerUserId: profile.providerUserId,
          userId: guestUserId,
          email: profile.email,
          profile: profile.raw
        });
        await ensureStorageQuota(guestUserId);
        return guestUserId;
      }
    }

    if (byEmail.rowCount) {
      const existingUserId = byEmail.rows[0].id;
      await linkOAuthAccount(client, {
        providerId,
        providerUserId: profile.providerUserId,
        userId: existingUserId,
        email: profile.email,
        profile: profile.raw
      });
      return existingUserId;
    }

    const created = await client.query(
      `INSERT INTO users (email, display_name, user_kind, email_verified_at)
       VALUES ($1, $2, 'registered', $3)
       RETURNING id`,
      [profile.email, profile.displayName.slice(0, 40), profile.emailVerified ? new Date() : new Date()]
    );
    const newUserId = created.rows[0].id;
    await linkOAuthAccount(client, {
      providerId,
      providerUserId: profile.providerUserId,
      userId: newUserId,
      email: profile.email,
      profile: profile.raw
    });
    bootstrapAccount = true;
    return newUserId;
  }).catch(rethrowOAuthDbError);

  if (bootstrapAccount && profile.email) {
    await bootstrapOAuthAccount(userId, profile.email);
  }
  return userId;
}

export async function resolveOAuthUserForTests(providerId, profile, guestUserId = null) {
  return resolveOAuthUser(providerId, profile, guestUserId);
}

export async function handleOAuthCallback(providerId, { code, state }) {
  if (!oauthProviderConfig(providerId)) throwErr("OAUTH_PROVIDER_DISABLED");
  const { guestUserId, returnOrigin } = await consumeOAuthState(state, providerId);
  const accessToken = await exchangeAuthorizationCode(providerId, code);
  const profile = await fetchOAuthProfile(providerId, accessToken);
  const userId = await resolveOAuthUser(providerId, profile, guestUserId);
  if (profile.email) {
    await applyInternalBetaPrivileges(userId, profile.email);
    await acceptWorldMemberInvitesForEmail(userId, profile.email);
  }
  const loginCode = await issueLoginCode(userId);
  const base = returnOrigin ? `${returnOrigin.replace(/\/$/, "")}/` : oauthFrontendReturnUrl();
  const redirectUrl = new URL(base);
  redirectUrl.searchParams.set("oauth_code", loginCode);
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
