import { throwErr } from "./api-errors.js";
import { createSession } from "./auth.js";
import { normalizeIdentityWriteError } from "./auth-identity-errors.js";
import { transaction } from "./db.js";
import { isInternalBetaEmail } from "./internal-accounts.js";
import { initialPlanForEmail } from "./plans.js";
import {
  acceptPendingWorldInvitesForVerifiedUser,
  applyIdentityPrivileges,
  configureIdentityTransaction,
  ensureIdentityFoundation,
  readIdentityUser
} from "./repositories/auth-identity-repository.js";
import {
  deleteOAuthUserSessions,
  deleteValidOAuthLoginCode,
  findOAuthAccountForUpdate,
  insertOAuthLoginCode,
  insertOAuthUser,
  linkOAuthAccount,
  listRegisteredUsersByEmailForUpdate,
  lockOAuthEmailAndListRegisteredUsers,
  lockOAuthGuest,
  lockOAuthIdentity,
  markOAuthUserEmailVerified,
  updateOAuthAccountProfile,
  upgradeOAuthGuest
} from "./repositories/oauth-repository.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVIDERS = new Set(["google", "github"]);
const MAX_PROFILE_BYTES = 256 * 1024;

function normalizeProfile(providerId, profile) {
  if (!PROVIDERS.has(providerId)) throwErr("OAUTH_PROVIDER_DISABLED");
  const providerUserId = String(profile?.providerUserId ?? "").trim();
  if (!providerUserId || providerUserId.length > 512) throwErr("OAUTH_EXCHANGE_FAILED");

  const rawEmail = String(profile?.email ?? "").trim().toLowerCase();
  if (rawEmail && !EMAIL_PATTERN.test(rawEmail)) throwErr("OAUTH_EXCHANGE_FAILED");
  const displayName = (String(profile?.displayName ?? "").trim() || `${providerId} user`).slice(0, 40);
  const profileJson = JSON.stringify(profile?.raw ?? {});
  if (Buffer.byteLength(profileJson, "utf8") > MAX_PROFILE_BYTES) throwErr("OAUTH_EXCHANGE_FAILED");
  return {
    providerUserId,
    email: rawEmail || null,
    displayName,
    emailVerified: profile?.emailVerified === true,
    profileJson
  };
}

function normalizeOAuthWriteError(error) {
  const normalized = normalizeIdentityWriteError(error);
  if (normalized !== error) return normalized;
  if (error?.code === "23503" || error?.code === "23505") {
    const conflict = new Error("OAuth identity could not be linked safely");
    conflict.statusCode = 409;
    conflict.code = "OAUTH_IDENTITY_CONFLICT";
    return conflict;
  }
  return error;
}

async function ensureOAuthIdentity(client, {
  providerId,
  profile,
  guestUserId,
  loginCode
}) {
  await configureIdentityTransaction(client);
  await lockOAuthIdentity(client, {
    providerId,
    providerUserId: profile.providerUserId
  });

  const linked = await findOAuthAccountForUpdate(client, {
    providerId,
    providerUserId: profile.providerUserId
  });
  let user;
  let newlyLinked = false;

  if (linked) {
    user = linked;
    await updateOAuthAccountProfile(client, {
      providerId,
      providerUserId: profile.providerUserId,
      email: profile.email,
      profileJson: profile.profileJson
    });
  } else {
    if (!profile.email) throwErr("OAUTH_EMAIL_REQUIRED");
    if (!profile.emailVerified) throwErr("OAUTH_EMAIL_UNVERIFIED");
    const registered = await lockOAuthEmailAndListRegisteredUsers(client, profile.email);
    if (registered.length > 1) throwErr("OAUTH_IDENTITY_CONFLICT");

    if (guestUserId) {
      const guest = await lockOAuthGuest(client, guestUserId);
      if (guest?.user_kind === "guest") {
        if (registered.length) throwErr("EMAIL_ALREADY_REGISTERED");
        user = await upgradeOAuthGuest(client, {
          userId: guestUserId,
          email: profile.email,
          displayName: profile.displayName
        });
        if (!user) throwErr("OAUTH_IDENTITY_CONFLICT");
        await deleteOAuthUserSessions(client, user.id);
      }
    }

    if (!user && registered.length) {
      user = await markOAuthUserEmailVerified(client, registered[0].id);
    }
    if (!user) {
      user = await insertOAuthUser(client, {
        email: profile.email,
        displayName: profile.displayName
      });
      if (!user) {
        const raced = await listRegisteredUsersByEmailForUpdate(client, profile.email);
        if (raced.length !== 1) throwErr("OAUTH_IDENTITY_CONFLICT");
        user = await markOAuthUserEmailVerified(client, raced[0].id);
      }
    }

    const linkedUserId = await linkOAuthAccount(client, {
      providerId,
      providerUserId: profile.providerUserId,
      userId: user.id,
      email: profile.email,
      profileJson: profile.profileJson
    });
    if (linkedUserId !== user.id) throwErr("OAUTH_IDENTITY_CONFLICT");
    newlyLinked = true;
  }

  const internalBeta = isInternalBetaEmail(user.email);
  const currentPlan = await ensureIdentityFoundation(client, {
    userId: user.id,
    planCode: initialPlanForEmail(user.email)
  });
  await applyIdentityPrivileges(client, {
    userId: user.id,
    internalBeta,
    currentPlan
  });
  if (internalBeta && !user.email_verified_at) {
    user = await readIdentityUser(client, user.id);
  }
  const acceptedInvites = user.email_verified_at
    ? await acceptPendingWorldInvitesForVerifiedUser(client, { userId: user.id, email: user.email })
    : [];

  if (loginCode) {
    await insertOAuthLoginCode(client, {
      codeHash: loginCode.codeHash,
      userId: user.id,
      expiresAt: loginCode.expiresAt
    });
  }
  return { user, acceptedInvites, newlyLinked };
}

export async function resolveOAuthIdentity({
  providerId,
  profile,
  guestUserId = null,
  loginCode = null,
  transactionRunner = transaction
}) {
  const normalizedProfile = normalizeProfile(providerId, profile);
  try {
    return await transactionRunner((client) => ensureOAuthIdentity(client, {
      providerId,
      profile: normalizedProfile,
      guestUserId,
      loginCode
    }));
  } catch (error) {
    throw normalizeOAuthWriteError(error);
  }
}

export async function redeemOAuthLoginCode({
  codeHash,
  sessionMeta = {},
  transactionRunner = transaction
}) {
  try {
    return await transactionRunner(async (client) => {
      await configureIdentityTransaction(client);
      const userId = await deleteValidOAuthLoginCode(client, codeHash);
      if (!userId) throwErr("OAUTH_LOGIN_CODE_INVALID");
      const user = await readIdentityUser(client, userId);
      if (!user) throwErr("OAUTH_LOGIN_CODE_INVALID");
      const session = await createSession(userId, sessionMeta, {
        executor: client.query.bind(client)
      });
      return { user, ...session };
    });
  } catch (error) {
    throw normalizeOAuthWriteError(error);
  }
}
