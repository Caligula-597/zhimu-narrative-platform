/**
 * Expired token/session cleanup for Trusted Beta data-retention cron (TB-2.6).
 */
import { query } from "./db.js";

const DEFAULT_RETENTION_DAYS = {
  expiredSessions: 30,
  revokedSessions: 30,
  oauthStates: 7,
  oauthLoginCodes: 7,
  passwordResetTokens: 14,
  emailVerificationTokens: 30,
  accountCreationEvents: 7,
  opsUserAudits: 180,
  completedDeleteJobs: 90,
  expiredUploadSessions: 30,
  eventJournals: 30,
  voiceMessages: 90
};

export function resolveRetentionDays(env = process.env) {
  const read = (key, fallback) => {
    const value = Number(env[key]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  return {
    expiredSessions: read("RETENTION_EXPIRED_SESSIONS_DAYS", DEFAULT_RETENTION_DAYS.expiredSessions),
    revokedSessions: read("RETENTION_REVOKED_SESSIONS_DAYS", DEFAULT_RETENTION_DAYS.revokedSessions),
    oauthStates: read("RETENTION_OAUTH_STATES_DAYS", DEFAULT_RETENTION_DAYS.oauthStates),
    oauthLoginCodes: read("RETENTION_OAUTH_LOGIN_CODES_DAYS", DEFAULT_RETENTION_DAYS.oauthLoginCodes),
    passwordResetTokens: read("RETENTION_PASSWORD_RESET_DAYS", DEFAULT_RETENTION_DAYS.passwordResetTokens),
    emailVerificationTokens: read("RETENTION_EMAIL_VERIFICATION_DAYS", DEFAULT_RETENTION_DAYS.emailVerificationTokens),
    accountCreationEvents: read("RETENTION_ACCOUNT_CREATION_EVENTS_DAYS", DEFAULT_RETENTION_DAYS.accountCreationEvents),
    opsUserAudits: read("RETENTION_OPS_USER_AUDIT_DAYS", DEFAULT_RETENTION_DAYS.opsUserAudits),
    completedDeleteJobs: read("RETENTION_DELETE_JOBS_DAYS", DEFAULT_RETENTION_DAYS.completedDeleteJobs),
    expiredUploadSessions: read("RETENTION_UPLOAD_SESSIONS_DAYS", DEFAULT_RETENTION_DAYS.expiredUploadSessions),
    eventJournals: read("RETENTION_EVENT_JOURNALS_DAYS", DEFAULT_RETENTION_DAYS.eventJournals),
    voiceMessages: read("RETENTION_VOICE_MESSAGES_DAYS", DEFAULT_RETENTION_DAYS.voiceMessages)
  };
}

async function purgeTable({ dryRun, summary, key, countSql, deleteSql, params }) {
  if (dryRun) {
    const preview = await query(countSql, params);
    summary.deleted[key] = Number(preview.rows[0]?.count ?? 0);
    return;
  }
  const result = await query(deleteSql, params);
  summary.deleted[key] = result.rowCount ?? 0;
}

export async function purgeExpiredData(options = {}) {
  const days = { ...resolveRetentionDays(), ...(options.days ?? {}) };
  const dryRun = Boolean(options.dryRun);
  const summary = { dryRun, days, deleted: {} };

  await purgeTable({
    dryRun,
    summary,
    key: "authSessions",
    countSql: `SELECT COUNT(*)::int AS count FROM auth_sessions
      WHERE expires_at < now() - ($1::text || ' days')::interval
         OR (revoked_at IS NOT NULL AND revoked_at < now() - ($2::text || ' days')::interval)`,
    deleteSql: `DELETE FROM auth_sessions
      WHERE expires_at < now() - ($1::text || ' days')::interval
         OR (revoked_at IS NOT NULL AND revoked_at < now() - ($2::text || ' days')::interval)`,
    params: [days.expiredSessions, days.revokedSessions]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "oauthStates",
    countSql: `SELECT COUNT(*)::int AS count FROM oauth_states WHERE expires_at < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM oauth_states WHERE expires_at < now() - ($1::text || ' days')::interval`,
    params: [days.oauthStates]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "oauthLoginCodes",
    countSql: `SELECT COUNT(*)::int AS count FROM oauth_login_codes WHERE expires_at < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM oauth_login_codes WHERE expires_at < now() - ($1::text || ' days')::interval`,
    params: [days.oauthLoginCodes]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "passwordResetTokens",
    countSql: `SELECT COUNT(*)::int AS count FROM password_reset_tokens
      WHERE expires_at < now() - ($1::text || ' days')::interval
         OR (used_at IS NOT NULL AND used_at < now() - ($1::text || ' days')::interval)`,
    deleteSql: `DELETE FROM password_reset_tokens
      WHERE expires_at < now() - ($1::text || ' days')::interval
         OR (used_at IS NOT NULL AND used_at < now() - ($1::text || ' days')::interval)`,
    params: [days.passwordResetTokens]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "emailVerificationTokens",
    countSql: `SELECT COUNT(*)::int AS count FROM email_verification_tokens
      WHERE expires_at < now() - ($1::text || ' days')::interval
         OR (used_at IS NOT NULL AND used_at < now() - ($1::text || ' days')::interval)`,
    deleteSql: `DELETE FROM email_verification_tokens
      WHERE expires_at < now() - ($1::text || ' days')::interval
         OR (used_at IS NOT NULL AND used_at < now() - ($1::text || ' days')::interval)`,
    params: [days.emailVerificationTokens]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "accountCreationEvents",
    countSql: `SELECT COUNT(*)::int AS count FROM auth_account_creation_events
      WHERE created_at < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM auth_account_creation_events
      WHERE created_at < now() - ($1::text || ' days')::interval`,
    params: [days.accountCreationEvents]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "opsUserAudits",
    countSql: `SELECT COUNT(*)::int AS count FROM ops_user_audit_log
      WHERE created_at < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM ops_user_audit_log
      WHERE created_at < now() - ($1::text || ' days')::interval`,
    params: [days.opsUserAudits]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "accountDeleteJobs",
    countSql: `SELECT COUNT(*)::int AS count FROM account_delete_jobs
      WHERE status IN ('completed', 'failed')
        AND COALESCE(completed_at, updated_at) < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM account_delete_jobs
      WHERE status IN ('completed', 'failed')
        AND COALESCE(completed_at, updated_at) < now() - ($1::text || ' days')::interval`,
    params: [days.completedDeleteJobs]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "uploadSessions",
    countSql: `SELECT COUNT(*)::int AS count FROM upload_sessions
      WHERE expires_at < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM upload_sessions
      WHERE expires_at < now() - ($1::text || ' days')::interval`,
    params: [days.expiredUploadSessions]
  });

  for (const [key, table] of [
    ["roomEventJournal", "room_event_journal"],
    ["platformEventJournal", "platform_event_journal"]
  ]) {
    await purgeTable({
      dryRun,
      summary,
      key,
      countSql: `SELECT COUNT(*)::int AS count FROM ${table}
        WHERE created_at < now() - ($1::text || ' days')::interval`,
      deleteSql: `DELETE FROM ${table}
        WHERE created_at < now() - ($1::text || ' days')::interval`,
      params: [days.eventJournals]
    });
  }

  await purgeTable({
    dryRun,
    summary,
    key: "eventOutbox",
    countSql: `SELECT COUNT(*)::int AS count FROM event_outbox
      WHERE status IN ('published', 'dead')
        AND COALESCE(published_at, updated_at) < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM event_outbox
      WHERE status IN ('published', 'dead')
        AND COALESCE(published_at, updated_at) < now() - ($1::text || ' days')::interval`,
    params: [days.eventJournals]
  });

  await purgeTable({
    dryRun,
    summary,
    key: "voiceRoomMessages",
    countSql: `SELECT COUNT(*)::int AS count FROM voice_room_messages
      WHERE created_at < now() - ($1::text || ' days')::interval`,
    deleteSql: `DELETE FROM voice_room_messages
      WHERE created_at < now() - ($1::text || ' days')::interval`,
    params: [days.voiceMessages]
  });

  return summary;
}
