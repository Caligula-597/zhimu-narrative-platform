#!/usr/bin/env node
/** Print /api/health/ready + optionalServices for deploy checks. */
const base = (process.env.CHECK_BASE_URL || process.env.APP_PUBLIC_URL || "http://127.0.0.1:4180").replace(
  /\/$/,
  ""
);

const LABELS = {
  oauthGoogle: "Google OAuth",
  oauthGithub: "GitHub OAuth",
  email: "邮件 (Resend/Mailgun)",
  r2: "R2 附件",
  livekit: "LiveKit 语音",
  stripe: "Stripe",
  officialExample: "官方示例 env",
  deepseek: "DeepSeek AI"
};

async function main() {
  const url = `${base}/api/health/ready`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    console.error(`✗ 无法请求 ${url}: ${error.message}`);
    process.exit(1);
  }
  const body = await res.json().catch(() => ({}));
  console.log(`GET ${url} → ${res.status}`);
  console.log(`ready: ${body.ready ?? body.ok ?? false}`);
  if (body.database?.migrationsApplied != null) {
    console.log(`migrationsApplied: ${body.database.migrationsApplied}`);
  }
  const opt = body.optionalServices;
  if (opt && typeof opt === "object") {
    console.log("\noptionalServices（未配置 = 功能降级，不阻止 ready）：");
    for (const [key, ok] of Object.entries(opt)) {
      const label = LABELS[key] || key;
      console.log(`  ${ok ? "✓" : "○"} ${label}`);
    }
  }
  if (!res.ok || body.ready === false) {
    console.error("\n✗ 服务未就绪");
    process.exit(1);
  }
  console.log("\n✓ 生产就绪检查通过");
}

main();
