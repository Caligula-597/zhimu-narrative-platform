/**
 * getzhimu.com 三企业邮箱分工
 *
 * | 邮箱 | 用途 |
 * |------|------|
 * | support@getzhimu.com | 用户 Support / Reply-To / 邮件模板页脚 |
 * | hello@getzhimu.com | 官网对外联络 / 商务与一般咨询 |
 * | admin@getzhimu.com | 运营收件（内测审核、公开库、套餐升级、告警邮件） |
 *
 * 系统发信仍用 MAIL_FROM（默认 noreply@mail.getzhimu.com），不属于上述三收件箱。
 */
const DEFAULTS = {
  mailFrom: "织幕 <noreply@mail.getzhimu.com>",
  support: "support@getzhimu.com",
  hello: "hello@getzhimu.com",
  admin: "admin@getzhimu.com"
};

export function enterpriseEmails() {
  const support = process.env.SUPPORT_EMAIL?.trim() || DEFAULTS.support;
  const hello = process.env.HELLO_EMAIL?.trim() || DEFAULTS.hello;
  const admin = process.env.ADMIN_EMAIL?.trim() || DEFAULTS.admin;
  const mailFrom = process.env.MAIL_FROM?.trim() || DEFAULTS.mailFrom;
  const mailReplyTo = process.env.MAIL_REPLY_TO?.trim() || support;
  const opsNotify =
    process.env.OPS_NOTIFY_EMAIL?.trim()
    || process.env.BETA_REVIEW_NOTIFY_EMAIL?.trim()
    || process.env.CATALOG_REVIEW_NOTIFY_EMAIL?.trim()
    || process.env.PLAN_UPGRADE_NOTIFY_EMAIL?.trim()
    || process.env.ALERT_EMAIL?.trim()
    || admin;

  return {
    mailFrom,
    support,
    hello,
    admin,
    mailReplyTo,
    betaReviewNotify: process.env.BETA_REVIEW_NOTIFY_EMAIL?.trim() || opsNotify,
    catalogReviewNotify: process.env.CATALOG_REVIEW_NOTIFY_EMAIL?.trim() || opsNotify,
    planUpgradeNotify: process.env.PLAN_UPGRADE_NOTIFY_EMAIL?.trim() || opsNotify,
    alertEmail: process.env.ALERT_EMAIL?.trim() || opsNotify,
    opsNotify
  };
}

export function enterpriseEmailSummary() {
  const e = enterpriseEmails();
  return {
    transactionalFrom: e.mailFrom,
    userSupport: e.support,
    hello: e.hello,
    admin: e.admin,
    replyTo: e.mailReplyTo,
    opsNotify: e.opsNotify
  };
}
