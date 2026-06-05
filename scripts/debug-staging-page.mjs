import { chromium } from "@playwright/test";

const url = process.env.STAGING_BASE_URL || "http://localhost:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("requestfailed", (r) => {
  failedRequests.push(`${r.method()} ${r.url()} → ${r.failure()?.errorText || "failed"}`);
});

const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);

const diagnostics = await page.evaluate(() => {
  const cfg = window.zhimuConfig;
  const rt = window.zhimuRuntime;
  const views = window.zhimuViews;
  const dom = window.zhimuDom;
  const content = document.querySelector("#content");
  const shell = document.querySelector(".app-shell");
  const styles = shell ? getComputedStyle(shell) : null;
  return {
    zhimuConfig: cfg ? { apiBase: cfg.apiBase, requireAuth: cfg.requireAuth, demoMode: cfg.demoMode } : null,
    hasRuntimeRender: typeof rt?.render === "function",
    hasRuntimeGo: typeof rt?.go === "function",
    viewKeys: views ? Object.keys(views) : null,
    overviewFn: typeof views?.overview?.overview === "function",
    contentExists: Boolean(content),
    contentInnerLen: content?.innerHTML?.length ?? 0,
    contentText: (content?.textContent || "").slice(0, 200),
    shellDisplay: styles?.display,
    shellVisible: shell ? shell.offsetWidth > 0 && shell.offsetHeight > 0 : false,
    pageTitle: document.querySelector("#page-title")?.textContent,
    modalOpen: document.querySelector("#modal-backdrop")?.classList.contains("show"),
    localStorageApiBase: localStorage.getItem("zhimuApiBase")
  };
});

let navOk = false;
try {
  const backdrop = page.locator("#modal-backdrop");
  if (await backdrop.evaluate((el) => el.classList.contains("show"))) {
    await page.locator("[data-close]").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.locator('.nav-item[data-view="writer"]').click();
  await page.waitForTimeout(800);
  navOk = (await page.locator("#page-title").textContent()) === "创作者工作台";
} catch {
  navOk = false;
}

const apiProbe = await page.evaluate(async () => {
  try {
    const r = await fetch("/api/health/live");
    const j = await r.json();
    return { ok: true, status: r.status, body: j };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

console.log(
  JSON.stringify(
    {
      url,
      httpStatus: response?.status(),
      diagnostics,
      navOk,
      apiProbe,
      pageErrors,
      consoleErrors,
      failedRequests: failedRequests.slice(0, 20)
    },
    null,
    2
  )
);

await browser.close();
process.exit(pageErrors.length || !diagnostics.contentInnerLen ? 1 : 0);
