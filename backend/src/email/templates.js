/**
 * Branded transactional email HTML for 织幕.
 */

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function brandedEmailHtml({
  title,
  preview,
  bodyHtml,
  ctaUrl,
  ctaLabel = "打开链接"
}) {
  const safeTitle = escapeHtml(title);
  const safePreview = escapeHtml(preview || title);
  const ctaBlock = ctaUrl
    ? `<p style="margin:28px 0 0;text-align:center">
<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1a5fb4;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">${escapeHtml(ctaLabel)}</a>
</p>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280;word-break:break-all;text-align:center">${escapeHtml(ctaUrl)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${safePreview}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<tr><td style="background:linear-gradient(135deg,#1a5fb4 0%,#3584e4 100%);padding:24px 32px;color:#fff">
<div style="font-size:22px;font-weight:700;letter-spacing:.04em">织幕</div>
<div style="font-size:13px;opacity:.9;margin-top:4px">自动化互动叙事引擎</div>
</td></tr>
<tr><td style="padding:32px;color:#111827;font-size:15px;line-height:1.65">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827">${safeTitle}</h1>
${bodyHtml}
${ctaBlock}
</td></tr>
<tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5">
<p style="margin:0">此邮件由织幕系统自动发送，请勿直接回复。</p>
<p style="margin:8px 0 0">若你没有进行相关操作，可安全忽略本邮件。</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function worldInviteEmailHtml({ inviterName, worldName, roleLabel, inviteUrl }) {
  const bodyHtml = `<p style="margin:0 0 12px">你好，</p>
<p style="margin:0 0 12px"><strong>${escapeHtml(inviterName)}</strong> 邀请你以「${escapeHtml(roleLabel)}」身份加入剧本 <strong>${escapeHtml(worldName)}</strong>。</p>
<p style="margin:0">请先注册或登录织幕，再点击下方按钮接受邀请（链接 7 天内有效）。若链接失效，请让邀请人重新发送邀请邮件。</p>`;
  return brandedEmailHtml({
    title: `协作邀请 · ${worldName}`,
    preview: `${inviterName} 邀请你加入 ${worldName}`,
    bodyHtml,
    ctaUrl: inviteUrl,
    ctaLabel: "接受协作邀请"
  });
}
