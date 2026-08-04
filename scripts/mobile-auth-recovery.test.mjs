import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const authWorldSource = fs.readFileSync(
  new URL("../src/runtime/auth-world.js", import.meta.url),
  "utf8"
);
const accountSource = fs.readFileSync(
  new URL("../src/views/account.js", import.meta.url),
  "utf8"
);
const accountHubSource = fs.readFileSync(
  new URL("../src/views/account-hub.js", import.meta.url),
  "utf8"
);
const accountQuotaSource = fs.readFileSync(
  new URL("../src/runtime/account-quota.js", import.meta.url),
  "utf8"
);
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const stylesSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

async function evaluateConfig({
  hostname,
  port = "",
  storedApiBase = "",
  storedDemoMode = null
}) {
  const removed = [];
  const storage = {
    getItem(key) {
      if (key === "zhimuApiBase") return storedApiBase || null;
      if (key === "zhimuDemoMode") return storedDemoMode;
      return null;
    },
    removeItem(key) {
      removed.push(key);
    }
  };
  globalThis.window = {
    location: { hostname, port },
    localStorage: storage
  };
  try {
    const url = new URL("../config.js", import.meta.url);
    url.searchParams.set("case", `${hostname}-${Date.now()}-${Math.random()}`);
    await import(url.href);
    return {
      config: globalThis.window.zhimuConfig,
      removed
    };
  } finally {
    delete globalThis.window;
  }
}

test("public site ignores and clears a stale browser-local API endpoint", async () => {
  const result = await evaluateConfig({
    hostname: "app.getzhimu.com",
    storedApiBase: "http://127.0.0.1:4180/api"
  });
  assert.equal(result.config.apiBase, "/api");
  assert.deepEqual(result.removed, ["zhimuApiBase"]);
});

test("localhost may still use an explicit developer API endpoint", async () => {
  const result = await evaluateConfig({
    hostname: "127.0.0.1",
    port: "4173",
    storedApiBase: "http://127.0.0.1:4180/api"
  });
  assert.equal(result.config.apiBase, "http://127.0.0.1:4180/api");
  assert.deepEqual(result.removed, []);
});

test("public site ignores and clears stale browser demo mode", async () => {
  const result = await evaluateConfig({
    hostname: "app.getzhimu.com",
    storedDemoMode: "true"
  });
  assert.equal(result.config.demoMode, false);
  assert.deepEqual(result.removed, ["zhimuDemoMode"]);
});

test("no-world navigation does not enter the Studio hydration render loop", () => {
  assert.match(appSource, /R\.viewRequiresStudio\?\.\(currentView\)[\s\S]*R\.hasActiveWorld\?\.\(\)/);
  assert.doesNotMatch(
    authWorldSource,
    /setTimeout\(\(\)=>hasWorlds\?openWorldLibrary/
  );
});

test("verification transport failures expose a direct retry", () => {
  assert.match(authWorldSource, /data-auth-retry-verify/);
  assert.match(authWorldSource, /openVerifyEmail\(verifyToken\)/);
});

test("account loading failures become recoverable instead of spinning forever", () => {
  assert.match(accountSource, /accountViewError:/);
  assert.match(accountHubSource, /retry-account-view/);
  assert.match(accountHubSource, /账号信息暂时未加载/);
  assert.match(accountQuotaSource, /配额信息暂时不可用/);
  assert.doesNotMatch(accountQuotaSource, /配额信息加载中/);
});

test("account remains usable when a workspace request reports an outage", () => {
  assert.match(
    appSource,
    /!\["creatorCockpit", "account"\]\.includes\(currentView\)/
  );
});

test("mobile navigation keeps account and profile access visible", () => {
  assert.match(
    indexSource,
    /class="mobile-account-nav nav-item muted" data-view="account"/
  );
  assert.match(
    stylesSource,
    /\.mobile-account-nav,\s*\.mobile-account-nav:not\(\.active\)\s*\{\s*display:flex/
  );
});
