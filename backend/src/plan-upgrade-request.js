/**
 * Plan upgrade applications — email ops; manual fulfillment via POST /api/ops/users/plan.
 * No Stripe checkout; distinct from closed-beta (beta) applications.
 */
import { sendTransactionalEmail } from "./email/index.js";
import { brandedEmailHtml } from "./email/templates.js";
import { throwErr } from "./api-errors.js";
import { query } from "./db.js";
import {
  PLAN_CATALOG,
  PLAN_DEFAULTS,
  fetchUserPlanCode,
  planMeta
} from "./plans.js";
import { fetchUserKind } from "./capabilities.js";

export const UPGRADE_TARGET_PLANS = ["creator", "studio"];

export const PLAN_RANK = {
  free: 0,
  creator: 1,
  studio: 2,
  beta: 3
};

export function planUpgradeNotifyEmail() {
  return (
    process.env.PLAN_UPGRADE_NOTIFY_EMAIL?.trim()
    || process.env.SUPPORT_EMAIL?.trim()
    || "support@getzhimu.com"
  );
}

function sanitizeText(value = "", maxLength = 4000) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
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

function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function listUpgradeTargets(currentPlanCode) {
  const currentRank = PLAN_RANK[currentPlanCode] ?? 0;
  return UPGRADE_TARGET_PLANS.filter((code) => (PLAN_RANK[code] ?? 0) > currentRank);
}

export function buildPublicPlanCards() {
  return Object.entries(PLAN_CATALOG)
    .filter(([code]) => code !== "beta")
    .map(([code, meta]) => {
      const limits = PLAN_DEFAULTS[code] ?? PLAN_DEFAULTS.free;
      return {
        code,
        label: meta.label,
        tier: meta.tier,
        description: meta.description,
        limits: {
          maxWorlds: limits.max_worlds,
          maxBytes: limits.max_bytes,
          maxSingleFileBytes: limits.max_single_file_bytes
        }
      };
    });
}

export async function fetchPendingPlanUpgradeRequest(userId) {
  const result = await query(
    `SELECT id, desired_plan_code, created_at
     FROM plan_upgrade_requests
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function buildPlanUpgradeMeta(userId, planCode) {
  const kind = await fetchUserKind(userId);
  const pending = kind === "registered" ? await fetchPendingPlanUpgradeRequest(userId) : null;
  const targets = kind === "registered" ? listUpgradeTargets(planCode) : [];
  return {
    supportEmail: planUpgradeNotifyEmail(),
    canRequest: kind === "registered" && targets.length > 0 && !pending,
    pending: pending
      ? {
          id: pending.id,
          desiredPlanCode: pending.desired_plan_code,
          createdAt: pending.created_at
        }
      : null,
    availableTargets: targets.map((code) => ({
      code,
      ...planMeta(code)
    })),
    fulfillment: "manual",
    note: "提交后由 support 人工审核并开通，暂无在线支付。"
  };
}

export async function sendPlanUpgradeRequestEmails({ request, user, usage }) {
  const opsTo = planUpgradeNotifyEmail();
  const currentLabel = planMeta(request.current_plan_code).label;
  const desiredLabel = planMeta(request.desired_plan_code).label;

  const detailRows = [
    ["用户", user.display_name || "—"],
    ["邮箱", request.email],
    ["用户 ID", user.id],
    ["当前套餐", `${currentLabel} (${request.current_plan_code})`],
    ["申请升级至", `${desiredLabel} (${request.desired_plan_code})`],
    ["申请理由", request.reason],
    ["补充联系方式", request.contact || "—"],
    ["当前用量 · 剧本", `${usage?.usedWorlds ?? "—"} / ${usage?.maxWorlds ?? "—"}`],
    ["当前用量 · 存储", `${formatBytes(usage?.usedBytes)} / ${formatBytes(usage?.maxBytes)}`],
    ["申请 ID", request.id],
    ["提交时间", new Date(request.created_at || Date.now()).toISOString()]
  ];

  const tableHtml = detailRows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${typeof value === "string" && value.includes("<br>") ? value : nl2br(String(value))}</td></tr>`
    )
    .join("");

  const opsHtml = brandedEmailHtml({
    title: "套餐升级 · 新申请",
    preview: `${request.email} · ${currentLabel} → ${desiredLabel}`,
    bodyHtml: `<p>有创作者申请升级套餐。请人工审核后开通：</p>
<ul style="font-size:14px;line-height:1.6">
  <li><code>POST /api/ops/users/plan</code> — body: <code>{ "email": "...", "planCode": "${escapeHtml(request.desired_plan_code)}" }</code></li>
  <li>或 CLI: <code>node scripts/set-user-plan.mjs ${escapeHtml(request.email)} ${escapeHtml(request.desired_plan_code)}</code></li>
  <li><code>GET /api/ops/plan-upgrade/requests?status=pending</code> — 待审列表</li>
</ul>
<p style="color:#6b7280;font-size:13px">请求头需 <code>x-ops-token</code>（与 OPS_API_TOKEN 一致）。</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">${tableHtml}</table>`
  });

  await sendTransactionalEmail({
    to: opsTo,
    subject: `[织幕升级] ${request.email} · ${currentLabel} → ${desiredLabel}`,
    html: opsHtml
  });

  const userHtml = brandedEmailHtml({
    title: "升级申请已收到",
    preview: "我们将在 1～3 个工作日内处理",
    bodyHtml: `<p>你好，${escapeHtml(user.display_name || "创作者")}，</p>
<p>我们已收到你的套餐升级申请（${escapeHtml(currentLabel)} → ${escapeHtml(desiredLabel)}）。</p>
<p>审核通过后，账号配额会自动提升，我们会邮件通知你。暂无在线支付入口。</p>
<p style="color:#6b7280;font-size:13px">如有疑问可回复此邮件或联系 ${escapeHtml(planUpgradeNotifyEmail())}。</p>`
  });

  await sendTransactionalEmail({
    to: request.email,
    subject: "织幕 · 升级申请已收到",
    html: userHtml
  });
}

export async function submitPlanUpgradeRequest(userId, body) {
  const kind = await fetchUserKind(userId);
  if (kind !== "registered") throwErr("GUEST_ACCOUNT_RESTRICTED");

  const userRow = await query(
    `SELECT id, email, display_name FROM users WHERE id = $1`,
    [userId]
  );
  if (!userRow.rowCount) throwErr("USER_NOT_FOUND");
  const user = userRow.rows[0];
  if (!user.email) throwErr("EMAIL_REQUIRED");

  const currentPlanCode = await fetchUserPlanCode(userId);
  const desiredPlanCode = sanitizeText(body?.desiredPlanCode, 32);
  const reason = sanitizeText(body?.reason, 4000);
  const contact = sanitizeText(body?.contact, 200);

  if (!UPGRADE_TARGET_PLANS.includes(desiredPlanCode)) {
    throwErr("PLAN_UPGRADE_INVALID", "请选择有效的升级档位");
  }
  if (!listUpgradeTargets(currentPlanCode).includes(desiredPlanCode)) {
    throwErr("PLAN_UPGRADE_ALREADY_ON_PLAN", "当前套餐已包含或高于所选档位");
  }
  if (reason.length < 8) {
    throwErr("PLAN_UPGRADE_NOTES_TOO_SHORT", "请填写至少 8 字的申请说明");
  }

  const pending = await fetchPendingPlanUpgradeRequest(userId);
  if (pending) throwErr("PLAN_UPGRADE_REQUEST_PENDING");

  const inserted = await query(
    `INSERT INTO plan_upgrade_requests
      (user_id, email, display_name, current_plan_code, desired_plan_code, reason, contact)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, user.email.trim().toLowerCase(), user.display_name || "", currentPlanCode, desiredPlanCode, reason, contact || null]
  );
  const request = inserted.rows[0];

  const { storageUsage } = await import("./routes/world-helpers.js");
  const { buildUsagePayload } = await import("./plans.js");
  const usageRow = await storageUsage(userId);
  const usage = buildUsagePayload(
    {
      planCode: currentPlanCode,
      max_bytes: usageRow.max_bytes,
      max_worlds: usageRow.max_worlds,
      max_single_file_bytes: usageRow.max_single_file_bytes
    },
    {
      usedBytes: Number(usageRow.used_bytes),
      usedWorlds: Number(usageRow.used_worlds)
    }
  );

  try {
    await sendPlanUpgradeRequestEmails({ request, user, usage });
  } catch (emailError) {
    console.error("[plan-upgrade] notify email failed:", emailError?.message || emailError);
  }

  return {
    id: request.id,
    status: request.status,
    desiredPlanCode: request.desired_plan_code,
    message: "申请已提交，我们将在 1～3 个工作日内邮件回复。"
  };
}

export async function listPlanUpgradeRequests({ status = "pending", limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const safeStatus = ["pending", "approved", "rejected"].includes(status) ? status : "pending";

  const [items, total] = await Promise.all([
    query(
      `SELECT pur.*, u.display_name AS linked_display_name
       FROM plan_upgrade_requests pur
       JOIN users u ON u.id = pur.user_id
       WHERE pur.status = $1
       ORDER BY pur.created_at ASC
       LIMIT $2 OFFSET $3`,
      [safeStatus, safeLimit, safeOffset]
    ),
    query(`SELECT COUNT(*)::int AS total FROM plan_upgrade_requests WHERE status = $1`, [safeStatus])
  ]);

  return {
    items: items.rows,
    total: total.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset,
    status: safeStatus
  };
}
