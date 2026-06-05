import { chromium } from "@playwright/test";

const url = process.env.STAGING_BASE_URL || "http://localhost:8080";
const email = `staging-new-${Date.now()}@example.test`;
const password = "staging-new-pass-8";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(url, { waitUntil: "networkidle" });
await page.locator("#auth-banner-login, [data-auth-login], .primary-btn").first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(500);

// Use auth modal if open
const registerName = page.locator('[data-studio-field="registerName"]');
if (await registerName.isVisible().catch(() => false)) {
  await page.locator('[data-studio-field="registerName"]').fill("测试用户");
  await page.locator('[data-studio-field="registerEmail"]').fill(email);
  await page.locator('[data-studio-field="registerPassword"]').fill(password);
  await page.click("[data-auth-register]");
  await page.waitForTimeout(3000);
} else {
  await page.evaluate(async ({ email, password }) => {
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, displayName: "测试用户" })
    });
    const j = await r.json();
    localStorage.setItem("zhimuSessionToken", j.token);
  }, { email, password });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
}

const text = await page.locator("main.main-area").innerText();
const hasEnglish = /params\/worldId|must NOT have fewer|FST_ERR/i.test(text);
const hasFailCloud = text.includes("云端连接失败");
const hasWelcome = /欢迎|尚无剧本|创建新世界|还没有剧本/.test(text);

console.log(
  JSON.stringify(
    {
      email,
      hasEnglish,
      hasFailCloud,
      hasWelcome,
      snippet: text.slice(0, 400),
      pageErrors: errors
    },
    null,
    2
  )
);

await browser.close();
process.exit(hasEnglish || hasFailCloud ? 1 : 0);
