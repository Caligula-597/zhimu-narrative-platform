// State shards have moved to real ES module imports.
// The window.zhimuState proxy is exposed only for explicit test/demo diagnostics.
import { getRuntimeConfig } from "../config.js";
import { activateShardBridge } from "./state/index.js";

const config = getRuntimeConfig();
const localHost = ["localhost", "127.0.0.1"].includes(window.location?.hostname);
const exposeTestStateBridge =
  Boolean(window.__ZHIMU_ENABLE_TEST_STATE__) ||
  Boolean(config.exposeStateBridge) ||
  (localHost && Boolean(config.demoMode) && localStorage.getItem("zhimuDisableStateBridge") !== "true");

if (exposeTestStateBridge) {
  window.zhimuState = {};
  activateShardBridge();
}

export {};
