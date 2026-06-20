/**
 * Support / ops manual email HTML — same visual language as transactional mail.
 * Generate via: node backend/scripts/render-support-email.mjs
 */
import { brandedEmailHtml } from "./templates.js";

const BRAND = {
  brass: "#a7783d",
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

function nl2br(text = "") {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

function appUrl() {
  return (process.env.APP_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");
}

function playUrl() {
  return (process.env.PLAY_SITE_URL || process.env.PLAY_SITE_ORIGIN || "https://play.getzhimu.com").replace(/\/$/, "");
}

function calloutHtml(text) {
  return `<p style="margin:16px 0;padding:12px 14px;background:#f8f5ee;border-left:3px solid ${BRAND.brass};border-radius:0 6px 6px 0;font-size:14px;color:${BRAND.ink}">${nl2br(text)}</p>`;
}

function stepsHtml(items) {
  const lis = items.map((item) => `<li style="margin:0 0 8px">${item}</li>`).join("");
  return `<ol style="margin:12px 0 0;padding-left:20px;color:${BRAND.ink}">${lis}</ol>`;
}

/** 内测拒审（Ops reject 也会自动发送同一 HTML） */
export function betaRejectEmailHtml({ displayName, note }) {
  const registerUrl = `${appUrl()}/?auth=register`;
  const bodyHtml = `<p style="margin:0 0 12px">你好，${escapeHtml(displayName)}，</p>
<p style="margin:0 0 12px">感谢关注织幕。我们暂时无法通过本次内测申请，原因如下：</p>
${calloutHtml(note)}
<p style="margin:0 0 12px">你仍可自行注册，免费体验基础创作配额。</p>
<p style="margin:0;color:${BRAND.muted};font-size:14px">若情况有变，欢迎补充说明后再次通过官网内测表单申请。</p>`;
  return {
    subject: "织幕 · 关于你的内测申请",
    html: brandedEmailHtml({
      title: "内测申请暂未通过",
      preview: "感谢关注织幕，请查看说明",
      bodyHtml,
      ctaUrl: registerUrl,
      ctaLabel: "免费注册体验",
      replyFriendly: true
    })
  };
}

/** approve 后可选跟进 */
export function betaOnboardingFollowupEmailHtml({ displayName, email }) {
  const registerUrl = `${appUrl()}/?auth=register`;
  const officialUrl = `${playUrl()}/?experience=official`;
  const bodyHtml = `<p style="margin:0 0 12px">你好，${escapeHtml(displayName)}，</p>
<p style="margin:0 0 12px">内测账号已开通。建议按下面顺序试跑（约 30 分钟）：</p>
${stepsHtml([
  `注册/登录（邮箱须与申请一致：<strong>${escapeHtml(email)}</strong>）`,
  "验证邮箱后，首屏选「创建新世界」或「体验官方示例」",
  "开测试房 → 复制邀请码 → 玩家在 play 端输入邀请码加入",
  "主持在「主持台」查看玩家进度"
])}
<p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">玩家端官方示例（需登录）：<a href="${escapeHtml(officialUrl)}" style="color:#2b6b61">${escapeHtml(officialUrl)}</a></p>
<p style="margin:12px 0 0;font-size:14px">遇到问题请附上截图与邀请码（勿发密码）。</p>`;
  return {
    subject: "织幕 · 内测上手指引",
    html: brandedEmailHtml({
      title: "内测上手指引",
      preview: "约 30 分钟跑通第一场",
      bodyHtml,
      ctaUrl: registerUrl,
      ctaLabel: "进入创作者应用",
      replyFriendly: true
    })
  };
}

/** 收到「预约导入」意向（无 API，运营从邮箱发出） */
export function importRequestAckEmailHtml({ displayName }) {
  const bodyHtml = `<p style="margin:0 0 12px">你好，${escapeHtml(displayName)}，</p>
<p style="margin:0 0 12px">我们已收到你的<strong>「预约导入剧本」</strong>意向。</p>
<p style="margin:0 0 8px">请在本邮件回复中补充（若尚未提供）：</p>
<ul style="margin:0;padding-left:20px;line-height:1.8">
  <li>团队 / 工作室名称</li>
  <li>现有素材格式（Word / PDF / Markdown 等）</li>
  <li>大致角色数、分幕体量</li>
  <li>期望首场试跑时间</li>
</ul>
<p style="margin:16px 0 0;color:${BRAND.muted};font-size:14px">运营会在 <strong>2～5 个工作日</strong>内评估并回复导入时间线。内测期导入由人工协助，不另收系统订阅费。</p>`;
  return {
    subject: "织幕 · 已收到导入预约",
    html: brandedEmailHtml({
      title: "导入预约已收到",
      preview: "请补充剧本素材信息",
      bodyHtml,
      replyFriendly: true
    })
  };
}

/** 导入完成交付（运营手工填写 worldName / inviteCode） */
export function importDeliveryEmailHtml({ displayName, worldName, inviteCode }) {
  const joinUrl = `${playUrl()}/?join=${encodeURIComponent(inviteCode)}`;
  const bodyHtml = `<p style="margin:0 0 12px">你好，${escapeHtml(displayName)}，</p>
<p style="margin:0 0 12px">你的剧本已导入织幕，测试房已开好。</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
  <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:${BRAND.muted};white-space:nowrap">世界名称</td><td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${escapeHtml(worldName)}</strong></td></tr>
  <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:${BRAND.muted}">测试房邀请码</td><td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${escapeHtml(inviteCode)}</strong></td></tr>
</table>
<p style="margin:0;font-size:14px">建议你先以<strong>主持</strong>身份登录，确认分幕/线索无误后再发给玩家。</p>
<p style="margin:12px 0 0;font-size:14px;color:${BRAND.muted}">如需调整结构，请回复本邮件；重大修改可能需另排导入时间。</p>`;
  return {
    subject: "织幕 · 剧本已导入，测试房邀请码",
    html: brandedEmailHtml({
      title: "导入完成 · 测试房已就绪",
      preview: `邀请码 ${inviteCode}`,
      bodyHtml,
      ctaUrl: joinUrl,
      ctaLabel: "玩家加入链接（play）",
      replyFriendly: true
    })
  };
}

export function planUpgradedEmailHtml({ displayName, email, planLabel }) {
  const bodyHtml = `<p style="margin:0 0 12px">你好，${escapeHtml(displayName)}，</p>
<p style="margin:0 0 12px">你的账号（<strong>${escapeHtml(email)}</strong>）已升级为 <strong>${escapeHtml(planLabel)}</strong> 套餐。</p>
<p style="margin:0 0 12px">请刷新浏览器，打开 <strong>账号设置 → 套餐与配额</strong> 查看新额度。若页面未更新，请退出重新登录。</p>
<p style="margin:0;color:${BRAND.muted};font-size:14px">内测期仍无在线支付入口；后续账单事宜我们会单独联系。</p>`;
  return {
    subject: "织幕 · 套餐已升级",
    html: brandedEmailHtml({
      title: "套餐已升级",
      preview: planLabel,
      bodyHtml,
      ctaUrl: appUrl(),
      ctaLabel: "打开织幕",
      replyFriendly: true
    })
  };
}

export function quotaAdjustedEmailHtml({ displayName, email, note }) {
  const bodyHtml = `<p style="margin:0 0 12px">你好，${escapeHtml(displayName)}，</p>
<p style="margin:0 0 12px">我们已为你的账号（<strong>${escapeHtml(email)}</strong>）调整配额：</p>
${calloutHtml(note)}
<p style="margin:0;font-size:14px">请先刷新账号设置查看用量。也可在 <strong>内容资产 → 回收站</strong> 清理附件以释放空间。</p>`;
  return {
    subject: "织幕 · 配额已调整",
    html: brandedEmailHtml({
      title: "配额已调整",
      preview: note.slice(0, 40),
      bodyHtml,
      ctaUrl: appUrl(),
      ctaLabel: "查看账号设置",
      replyFriendly: true
    })
  };
}

export function pilotFollowupEmailHtml({ displayName }) {
  const bodyHtml = `<p style="margin:0 0 12px">你好，${escapeHtml(displayName)}，</p>
<p style="margin:0 0 12px">想跟进一下你们用织幕跑第一场的情况：</p>
<ol style="margin:0;padding-left:20px;line-height:1.9">
  <li>创作者/主持是否独立完成开测试房？</li>
  <li>主持台能否看到玩家阅读进度？</li>
  <li>玩家端（邀请码入房）是否顺畅？</li>
  <li>是否有计划第二场，或需要导入/配额支持？</li>
</ol>
<p style="margin:16px 0 0">任意回复即可，也可约 15 分钟语音同步。</p>`;
  return {
    subject: "织幕 · 首场试跑反馈",
    html: brandedEmailHtml({
      title: "首场试跑跟进",
      preview: "想听听你们的试跑体验",
      bodyHtml,
      replyFriendly: true
    })
  };
}

export const SUPPORT_EMAIL_TEMPLATES = {
  "beta-reject": {
    label: "内测拒审",
    required: ["displayName", "note"],
    build: betaRejectEmailHtml
  },
  "beta-onboarding": {
    label: "内测上手指引（可选跟进）",
    required: ["displayName", "email"],
    build: betaOnboardingFollowupEmailHtml
  },
  "import-ack": {
    label: "导入预约确认",
    required: ["displayName"],
    build: importRequestAckEmailHtml
  },
  "import-delivery": {
    label: "导入完成交付",
    required: ["displayName", "worldName", "inviteCode"],
    build: importDeliveryEmailHtml
  },
  "plan-upgraded": {
    label: "套餐已升级",
    required: ["displayName", "email", "planLabel"],
    build: planUpgradedEmailHtml
  },
  "quota-adjusted": {
    label: "配额已调整",
    required: ["displayName", "email", "note"],
    build: quotaAdjustedEmailHtml
  },
  "pilot-followup": {
    label: "首场试跑跟进",
    required: ["displayName"],
    build: pilotFollowupEmailHtml
  }
};
