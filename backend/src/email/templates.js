/**
 * Branded transactional email HTML for 织幕.
 * Visual language aligned with marketing site (site/styles.css).
 */

const BRAND = {
  green: "#183f3a",
  greenLight: "#2b6b61",
  brass: "#a7783d",
  paper: "#f4f1e9",
  ink: "#142321",
  muted: "#76827f"
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roleCollaborationHint(roleLabel = "") {
  const label = String(roleLabel).toLowerCase();
  if (label.includes("编辑") || label.includes("editor")) {
    return "你将可以修改剧本结构与编排内容。";
  }
  if (label.includes("主持") || label.includes("host")) {
    return "你将可以开团、监控玩家进度并处理主持事件。";
  }
  if (label.includes("查看") || label.includes("viewer")) {
    return "你将可以阅读剧本与运行数据（只读）。";
  }
  return "接受邀请后，可在织幕中访问该剧本的协作能力。";
}

export function brandedEmailHtml({
  title,
  preview,
  bodyHtml,
  ctaUrl,
  ctaLabel = "打开链接",
  footerNote = ""
}) {
  const safeTitle = escapeHtml(title);
  const safePreview = escapeHtml(preview || title);
  const appUrl = escapeHtml(process.env.APP_PUBLIC_URL?.replace(/\/$/, "") || "https://app.getzhimu.com");
  const ctaBlock = ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 0">
<tr><td style="border-radius:8px;background:${BRAND.green}">
<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-weight:700;font-size:15px">${escapeHtml(ctaLabel)}</a>
</td></tr>
</table>
<p style="margin:14px 0 0;font-size:12px;color:${BRAND.muted};word-break:break-all;text-align:center;line-height:1.5">若按钮无法点击，请复制链接到浏览器：<br/><a href="${escapeHtml(ctaUrl)}" style="color:${BRAND.greenLight}">${escapeHtml(ctaUrl)}</a></p>`
    : "";

  const extraFooter = footerNote
    ? `<p style="margin:10px 0 0">${escapeHtml(footerNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper};font-family:'Segoe UI','Microsoft YaHei',system-ui,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${safePreview}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.paper};padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border-radius:10px;overflow:hidden;border:1px solid rgba(20,35,33,.1);box-shadow:0 12px 32px rgba(18,45,41,.08)">
<tr><td style="background:linear-gradient(135deg,${BRAND.green} 0%,${BRAND.greenLight} 100%);padding:22px 28px;color:#fff">
<div style="font-size:11px;font-weight:800;letter-spacing:.12em;opacity:.88">ZHIMU</div>
<div style="font-family:'Songti SC','SimSun',serif;font-size:22px;font-weight:700;margin-top:6px">织幕</div>
<div style="font-size:13px;opacity:.88;margin-top:4px">长线互动叙事引擎</div>
</td></tr>
<tr><td style="padding:28px;color:${BRAND.ink};font-size:15px;line-height:1.7">
<h1 style="margin:0 0 14px;font-family:'Songti SC','SimSun',serif;font-size:20px;font-weight:700;color:${BRAND.ink}">${safeTitle}</h1>
${bodyHtml}
${ctaBlock}
</td></tr>
<tr><td style="padding:18px 28px;background:#f8f5ee;border-top:1px solid rgba(20,35,33,.08);font-size:12px;color:${BRAND.muted};line-height:1.6">
<p style="margin:0">此邮件由织幕系统自动发送，请勿直接回复。</p>
<p style="margin:8px 0 0">应用入口：<a href="${appUrl}" style="color:${BRAND.greenLight};text-decoration:none">${appUrl}</a></p>
${extraFooter}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function worldInviteEmailHtml({ inviterName, worldName, roleLabel, inviteUrl }) {
  const hint = roleCollaborationHint(roleLabel);
  const bodyHtml = `<p style="margin:0 0 12px">你好，</p>
<p style="margin:0 0 12px"><strong>${escapeHtml(inviterName)}</strong> 邀请你以「<span style="color:${BRAND.brass};font-weight:700">${escapeHtml(roleLabel)}</span>」身份加入剧本 <strong>${escapeHtml(worldName)}</strong>。</p>
<p style="margin:0 0 12px;padding:12px 14px;background:#f8f5ee;border-left:3px solid ${BRAND.brass};border-radius:0 6px 6px 0;font-size:14px;color:${BRAND.ink}">${escapeHtml(hint)}</p>
<p style="margin:0">请先注册或登录织幕，再点击下方按钮接受邀请。链接 <strong>7 天内</strong>有效；若已过期，请让邀请人重新发送。</p>`;
  return brandedEmailHtml({
    title: `协作邀请 · ${worldName}`,
    preview: `${inviterName} 邀请你加入「${worldName}」`,
    bodyHtml,
    ctaUrl: inviteUrl,
    ctaLabel: "接受协作邀请"
  });
}

export function passwordResetEmailHtml({ resetUrl }) {
  const bodyHtml = `<p style="margin:0 0 12px">我们收到了重置织幕账号密码的请求。</p>
<p style="margin:0">请点击下方按钮设置新密码（链接 <strong>1 小时内</strong>有效）。若你没有发起此请求，可忽略本邮件。</p>`;
  return brandedEmailHtml({
    title: "重置登录密码",
    preview: "重置织幕账号密码",
    bodyHtml,
    ctaUrl: resetUrl,
    ctaLabel: "设置新密码"
  });
}

export function emailVerificationHtml({ verifyUrl }) {
  const bodyHtml = `<p style="margin:0 0 12px">欢迎注册织幕。</p>
<p style="margin:0">请点击下方按钮验证邮箱（链接 <strong>24 小时内</strong>有效）。验证通过后即可创建与管理剧本。</p>`;
  return brandedEmailHtml({
    title: "验证邮箱",
    preview: "验证织幕账号邮箱",
    bodyHtml,
    ctaUrl: verifyUrl,
    ctaLabel: "验证邮箱"
  });
}
