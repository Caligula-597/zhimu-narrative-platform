/**
 * Regression coverage for browser chunk evaluation order.
 *
 * The API client can be emitted as a dependency chunk and therefore execute
 * before the frontend entry module body. Loading a domain API directly must
 * initialize config and attach the local demo identity without relying on the
 * entry module's side-effect import order.
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test("domain API initializes runtime config before its first request", async () => {
  const storage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  const location = { hostname: "localhost", port: "4173" };
  const window = {
    location,
    localStorage: storage,
    sessionStorage,
    zhimuSessionAuth: {}
  };
  const requests = [];

  globalThis.window = window;
  globalThis.location = location;
  globalThis.localStorage = storage;
  globalThis.sessionStorage = sessionStorage;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { userAgent: "node-test" }
  });
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  assert.equal(window.zhimuConfig, undefined, "test must begin before config initialization");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const worldApiUrl = pathToFileURL(path.join(root, "src", "api", "world.js"));
  worldApiUrl.searchParams.set("chunk-order", String(Date.now()));
  const worldApi = await import(worldApiUrl.href);

  await worldApi.getWorlds();

  assert.equal(window.zhimuConfig?.demoMode, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/worlds");
  assert.equal(
    requests[0].headers["x-user-id"],
    "154aa8a9-9cd2-4098-90f4-c75e56c0cc53",
    "the first domain request must carry the configured host demo identity"
  );
});
