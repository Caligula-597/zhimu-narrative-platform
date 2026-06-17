/**
 * Public catalog review — submit requests by email; ops approves manually (SQL / future ops API).
 */
import { sendTransactionalEmail } from "./email/index.js";
import { brandedEmailHtml } from "./email/templates.js";
import { throwErr } from "./api-errors.js";
import { query } from "./db.js";
import { loadWorldPublishReadiness } from "./world-readiness-service.js";

export function catalogReviewNotifyEmail() {
  return (
    process.env.CATALOG_REVIEW_NOTIFY_EMAIL?.trim()
    || process.env.SUPPORT_EMAIL?.trim()
    || "support@getzhimu.com"
  );
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

export async function sendCatalogReviewRequestEmails({
  world,
  submitter,
  playtestNotes,
  themeNotes,
  sampleNotes,
  contact
}) {
  const opsTo = catalogReviewNotifyEmail();
  const roleCount = world.role_count ?? "—";
  const appUrl = (process.env.APP_PUBLIC_URL || "").replace(/\/$/, "");
  const worldLink = appUrl ? `${appUrl}/?world=${world.id}` : world.id;

  const detailRows = [
    ["剧本名称", world.name],
    ["世界 ID", world.id],
    ["简介", world.summary || "（未填写）"],
    ["角色席", String(roleCount)],
    ["创作者", submitter.display_name || "—"],
    ["登录邮箱", submitter.email || "（游客/未绑定邮箱）"],
    ["用户 ID", submitter.id],
    ["自测情况", playtestNotes],
    ["题材说明", themeNotes],
    ["审核备注", sampleNotes || "—"],
    ["联系方式", contact || "—"],
    ["提交时间", new Date().toISOString()]
  ];

  const tableHtml = detailRows
    .map(([label, value]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${typeof value === "string" && value.includes("<br>") ? value : nl2br(String(value))}</td></tr>`)
    .join("");

  const opsHtml = brandedEmailHtml({
    title: "公开剧本库 · 新审核申请",
    preview: `${world.name} · ${submitter.email || submitter.display_name || "用户"}`,
    bodyHtml: `<p>有新的剧本申请上架公开库。可在运维 API 审核：</p>
<ul style="font-size:14px;line-height:1.6">
  <li><code>GET /api/ops/catalog/reviews</code> — 待审列表</li>
  <li><code>POST /api/ops/catalog/reviews/${escapeHtml(world.id)}/approve</code> — 通过</li>
  <li><code>POST /api/ops/catalog/reviews/${escapeHtml(world.id)}/reject</code> — 拒绝（body: note）</li>
</ul>
<p style="color:#6b7280;font-size:13px">请求头需 <code>x-ops-token</code>（与 OPS_API_TOKEN 一致）。</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">${tableHtml}</table>`,
    ctaUrl: worldLink.startsWith("http") ? worldLink : undefined,
    ctaLabel: "打开织幕"
  });

  await sendTransactionalEmail({
    to: opsTo,
    subject: `[织幕审核] 公开库申请 · ${world.name}`,
    html: opsHtml
  });

  if (submitter.email) {
    const userHtml = brandedEmailHtml({
      title: "公开库申请已收到",
      preview: "我们将在 3～5 个工作日内回复",
      bodyHtml: `<p>你好，${escapeHtml(submitter.display_name || "创作者")}，</p>
<p>我们已收到剧本 <strong>${escapeHtml(world.name)}</strong> 的公开库上架申请。</p>
<p>世界 ID：<code>${escapeHtml(world.id)}</code></p>
<p>审核通过后，剧本会出现在侧栏「公开剧本库」。若需补充材料，我们会通过邮件联系你。</p>
<p style="color:#6b7280;font-size:13px">请勿重复提交；如需修改说明，请回复本邮件。</p>`
    });
    await sendTransactionalEmail({
      to: submitter.email,
      subject: "织幕 · 公开库申请已收到",
      html: userHtml
    });
  }
}

export async function submitCatalogReviewRequest(actorId, worldId, body) {
  if (!body?.agreed) throwErr("CATALOG_REVIEW_AGREEMENT_REQUIRED");

  const owner = await query(
    `SELECT w.id, w.name, w.summary, w.catalog_public, w.catalog_review_status, w.status,
            (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = w.id) AS role_count
     FROM worlds w
     WHERE w.id = $1 AND w.owner_user_id = $2`,
    [worldId, actorId]
  );
  if (!owner.rowCount) throwErr("WORLD_OWNER_REQUIRED");
  const world = owner.rows[0];
  if (world.status === "archived") throwErr("BAD_REQUEST", "Cannot submit catalog review for an archived world");
  if (world.catalog_public || world.catalog_review_status === "approved") {
    throwErr("CATALOG_ALREADY_PUBLIC");
  }
  if (world.catalog_review_status === "pending") {
    throwErr("CATALOG_REVIEW_PENDING");
  }

  const user = await query(
    `SELECT id, email, display_name, user_kind FROM users WHERE id = $1`,
    [actorId]
  );
  const submitter = user.rows[0];
  if (submitter.user_kind === "guest") throwErr("GUEST_ACCOUNT_RESTRICTED");

  const playtestNotes = String(body.playtestNotes || "").trim();
  const themeNotes = String(body.themeNotes || "").trim();
  if (playtestNotes.length < 8) throwErr("CATALOG_REVIEW_NOTES_TOO_SHORT", "请填写至少 8 字的自测说明");
  if (themeNotes.length < 8) throwErr("CATALOG_REVIEW_NOTES_TOO_SHORT", "请填写至少 8 字的题材说明");

  const readiness = await loadWorldPublishReadiness(worldId);
  if (!readiness.summary.readyForCatalog) {
    const blocking = readiness.checks.filter((item) => item.level === "error" || item.level === "warning");
    throwErr("CATALOG_READINESS_BLOCKED", "剧本尚未满足公开库上架要求，请先完成发布前检查", {
      readyForPlaytest: readiness.summary.readyForPlaytest,
      readyForCatalog: readiness.summary.readyForCatalog,
      summary: readiness.summary,
      issues: blocking.slice(0, 8).map(({ id, level, title, detail }) => ({ id, level, title, detail }))
    });
  }

  const updated = await query(
    `UPDATE worlds
     SET catalog_review_status = 'pending',
         catalog_review_submitted_at = now(),
         catalog_review_note = NULL,
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, catalog_public, catalog_review_status, catalog_review_submitted_at, catalog_review_note`,
    [worldId]
  );

  try {
    await sendCatalogReviewRequestEmails({
      world,
      submitter,
      playtestNotes,
      themeNotes,
      sampleNotes: String(body.sampleNotes || "").trim(),
      contact: String(body.contact || "").trim()
    });
  } catch (emailError) {
    console.error("[catalog-review] notify email failed:", emailError?.message || emailError);
  }

  return updated.rows[0];
}
