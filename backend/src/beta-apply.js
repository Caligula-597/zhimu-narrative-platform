/**
 * Closed-beta applications from marketing site (Part 6).
 */
import { sendTransactionalEmail } from "./email/index.js";
import { brandedEmailHtml } from "./email/templates.js";
import { throwErr } from "./api-errors.js";
import { query } from "./db.js";
import { setUserPlan, fetchUserPlanCode } from "./plans.js";

export const BETA_ROLE_OPTIONS = [
  { id: "creator", label: "创作者", description: "编写剧本、编排剧情与规则" },
  { id: "host", label: "主持", description: "开团、监控进度、确认关键事件" },
  { id: "player", label: "玩家", description: "受邀入房体验阅读与搜证" },
  { id: "mixed", label: "创作 + 主持", description: "自己写本并带队测试" },
  { id: "other", label: "其他", description: "社团、发行或技术合作等" }
];

export function betaReviewNotifyEmail() {
  return (
    process.env.BETA_REVIEW_NOTIFY_EMAIL?.trim()
    || process.env.CATALOG_REVIEW_NOTIFY_EMAIL?.trim()
    || process.env.SUPPORT_EMAIL?.trim()
    || "support@getzhimu.com"
  );
}

export function isBetaApplicationsOpen() {
  const flag = process.env.BETA_APPLICATIONS_OPEN?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

export function getBetaApplicationFormConfig() {
  const appUrl = (process.env.APP_PUBLIC_URL || "").replace(/\/$/, "");
  const marketingUrl = (process.env.MARKETING_SITE_URL || process.env.MARKETING_SITE_ORIGIN || "").replace(
    /\/$/,
    ""
  );
  return {
    acceptingApplications: isBetaApplicationsOpen(),
    title: "申请织幕内测",
    description: "内测期间免费使用，无订阅或充值入口。我们会在 3～5 个工作日内邮件回复。",
    roleOptions: BETA_ROLE_OPTIONS,
    minUseCaseLength: 16,
    supportEmail: process.env.SUPPORT_EMAIL?.trim() || "support@getzhimu.com",
    registerUrl: appUrl ? `${appUrl}/?auth=register` : null,
    marketingSiteUrl: marketingUrl || null,
    applyApiPath: "/api/platform/beta/apply"
  };
}

function sanitizeText(value = "", maxLength = 4000) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isHoneypotTriggered(body) {
  return Boolean(String(body?.companyWebsite || body?.website || "").trim());
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(text = "") {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

export async function sendBetaApplicationEmails(application) {
  const opsTo = betaReviewNotifyEmail();
  const roleLabel = BETA_ROLE_OPTIONS.find((item) => item.id === application.role_intent)?.label || application.role_intent;

  const detailRows = [
    ["称呼", application.display_name],
    ["邮箱", application.email],
    ["意向", roleLabel],
    ["使用场景", application.use_case],
    ["来源", application.referral_source || "—"],
    ["联系方式", application.contact || "—"],
    ["申请 ID", application.id],
    ["提交时间", new Date(application.created_at || Date.now()).toISOString()]
  ];

  const tableHtml = detailRows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${typeof value === "string" && value.includes("<br>") ? value : nl2br(String(value))}</td></tr>`
    )
    .join("");

  const opsHtml = brandedEmailHtml({
    title: "内测 · 新申请",
    preview: `${application.display_name} · ${application.email}`,
    bodyHtml: `<p>有新的内测申请。可在运维 API 审核：</p>
<ul style="font-size:14px;line-height:1.6">
  <li><code>GET /api/ops/beta/applications</code> — 待审列表</li>
  <li><code>POST /api/ops/beta/applications/${escapeHtml(application.id)}/approve</code> — 通过</li>
  <li><code>POST /api/ops/beta/applications/${escapeHtml(application.id)}/reject</code> — 拒绝（body: note）</li>
</ul>
<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">${tableHtml}</table>`
  });

  await sendTransactionalEmail({
    to: opsTo,
    subject: `[织幕内测] 新申请 · ${application.display_name}`,
    html: opsHtml
  });

  const userHtml = brandedEmailHtml({
    title: "内测申请已收到",
    preview: "我们将在 3～5 个工作日内回复",
    bodyHtml: `<p>你好，${escapeHtml(application.display_name)}，</p>
<p>我们已收到你的织幕内测申请。</p>
<p>审核通过后，你会收到邮件通知；届时可使用同一邮箱注册并登录。</p>
<p style="color:#6b7280;font-size:13px">内测期间免费使用，请勿重复提交相同申请。</p>`
  });

  await sendTransactionalEmail({
    to: application.email,
    subject: "织幕 · 内测申请已收到",
    html: userHtml
  });
}

export async function sendBetaApprovalEmail(application) {
  const appUrl = (process.env.APP_PUBLIC_URL || "").replace(/\/$/, "");
  const registerLink = appUrl ? `${appUrl}/?auth=register` : null;

  const userHtml = brandedEmailHtml({
    title: "内测申请已通过",
    preview: "欢迎加入织幕内测",
    bodyHtml: `<p>你好，${escapeHtml(application.display_name)}，</p>
<p>你的织幕内测申请已通过。</p>
<p>请使用邮箱 <strong>${escapeHtml(application.email)}</strong> 注册并登录。内测账号会自动获得更高创作配额。</p>
<p style="color:#6b7280;font-size:13px">内测期间免费使用，暂无订阅或充值入口。</p>`,
    ctaUrl: registerLink || undefined,
    ctaLabel: registerLink ? "前往注册" : undefined
  });

  await sendTransactionalEmail({
    to: application.email,
    subject: "织幕 · 内测申请已通过",
    html: userHtml
  });
}

export async function submitBetaApplication(body) {
  if (!isBetaApplicationsOpen()) throwErr("BETA_APPLICATIONS_CLOSED");

  if (isHoneypotTriggered(body)) {
    return {
      id: null,
      status: "pending",
      message: "申请已收到，我们将在 3～5 个工作日内邮件回复。"
    };
  }

  const email = sanitizeText(body?.email, 320).toLowerCase();
  const displayName = sanitizeText(body?.displayName, 40);
  const roleIntent = sanitizeText(body?.roleIntent || "creator", 32);
  const useCase = sanitizeText(body?.useCase, 4000);
  const referralSource = sanitizeText(body?.referralSource, 200);
  const contact = sanitizeText(body?.contact, 200);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throwErr("EMAIL_INVALID");
  if (displayName.length < 2) throwErr("DISPLAY_NAME_INVALID");
  if (!BETA_ROLE_OPTIONS.some((item) => item.id === roleIntent)) throwErr("BETA_APPLICATION_INVALID", "请选择有效的使用意向");
  if (useCase.length < 16) throwErr("BETA_APPLICATION_NOTES_TOO_SHORT", "请填写至少 16 字的使用说明");

  const pending = await query(
    `SELECT id FROM beta_applications WHERE lower(email) = $1 AND status = 'pending'`,
    [email]
  );
  if (pending.rowCount) throwErr("BETA_APPLICATION_PENDING");

  const approved = await query(
    `SELECT id FROM beta_applications WHERE lower(email) = $1 AND status = 'approved' ORDER BY reviewed_at DESC LIMIT 1`,
    [email]
  );
  if (approved.rowCount) {
    return {
      id: approved.rows[0].id,
      status: "approved",
      message: "该邮箱已通过内测审核，请直接注册登录。"
    };
  }

  const inserted = await query(
    `INSERT INTO beta_applications (email, display_name, role_intent, use_case, referral_source, contact)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [email, displayName, roleIntent, useCase, referralSource || null, contact || null]
  );
  const application = inserted.rows[0];

  try {
    await sendBetaApplicationEmails(application);
  } catch (emailError) {
    console.error("[beta-apply] notify email failed:", emailError?.message || emailError);
  }

  return {
    id: application.id,
    status: application.status,
    message: "申请已收到，我们将在 3～5 个工作日内邮件回复。"
  };
}

export async function applyApprovedBetaApplicationPrivileges(userId, email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const currentPlan = await fetchUserPlanCode(userId);
  if (currentPlan === "beta") return true;

  const approved = await query(
    `SELECT id FROM beta_applications
     WHERE lower(email) = $1 AND status = 'approved'
     ORDER BY reviewed_at DESC NULLS LAST
     LIMIT 1`,
    [normalized]
  );
  if (!approved.rowCount) return false;

  await setUserPlan(userId, "beta");
  await query(
    `UPDATE beta_applications
     SET user_id = $1, updated_at = now()
     WHERE id = $2 AND user_id IS NULL`,
    [userId, approved.rows[0].id]
  );
  return true;
}

export async function countBetaApplications(status = "pending") {
  const result = await query(`SELECT COUNT(*)::int AS total FROM beta_applications WHERE status = $1`, [status]);
  return result.rows[0]?.total ?? 0;
}

export async function listBetaApplications({ status = "pending", limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const safeStatus = ["pending", "approved", "rejected"].includes(status) ? status : "pending";

  const [items, total] = await Promise.all([
    query(
      `SELECT ba.*,
              u.display_name AS linked_display_name,
              u.email AS linked_email
       FROM beta_applications ba
       LEFT JOIN users u ON u.id = ba.user_id
       WHERE ba.status = $1
       ORDER BY ba.created_at ASC
       LIMIT $2 OFFSET $3`,
      [safeStatus, safeLimit, safeOffset]
    ),
    query(`SELECT COUNT(*)::int AS total FROM beta_applications WHERE status = $1`, [safeStatus])
  ]);

  return {
    items: items.rows,
    total: total.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
    status: safeStatus
  };
}

async function loadBetaApplication(applicationId) {
  const result = await query(`SELECT * FROM beta_applications WHERE id = $1`, [applicationId]);
  if (!result.rowCount) throwErr("BETA_APPLICATION_NOT_FOUND");
  return result.rows[0];
}

async function linkExistingUserOnApproval(application) {
  const user = await query(`SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`, [application.email]);
  if (!user.rowCount) return null;
  const userId = user.rows[0].id;
  await setUserPlan(userId, "beta");
  await query(
    `UPDATE beta_applications SET user_id = $1, updated_at = now() WHERE id = $2`,
    [userId, application.id]
  );
  return userId;
}

export async function approveBetaApplication(applicationId, note = "") {
  const application = await loadBetaApplication(applicationId);
  if (application.status !== "pending") {
    throwErr("BETA_APPLICATION_NOT_PENDING", "仅「待审」的申请可通过");
  }

  const updated = await query(
    `UPDATE beta_applications
     SET status = 'approved',
         review_note = $2,
         reviewed_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [applicationId, String(note || "").trim() || null]
  );

  const row = updated.rows[0];
  await linkExistingUserOnApproval(row);

  try {
    await sendBetaApprovalEmail(row);
  } catch (emailError) {
    console.error("[beta-apply] approval email failed:", emailError?.message || emailError);
  }

  return row;
}

export async function rejectBetaApplication(applicationId, note) {
  const reviewNote = String(note || "").trim();
  if (reviewNote.length < 4) throwErr("BETA_APPLICATION_REJECT_NOTE_REQUIRED", "拒审说明至少 4 个字");

  const application = await loadBetaApplication(applicationId);
  if (application.status !== "pending") {
    throwErr("BETA_APPLICATION_NOT_PENDING", "仅「待审」的申请可拒绝");
  }

  const updated = await query(
    `UPDATE beta_applications
     SET status = 'rejected',
         review_note = $2,
         reviewed_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [applicationId, reviewNote]
  );
  return updated.rows[0];
}
