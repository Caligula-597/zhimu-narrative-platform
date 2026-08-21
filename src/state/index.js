// State shard aggregator.
// New code imports shard stores directly; src/state.js may expose a test-only
// window.zhimuState proxy when demo/test diagnostics explicitly opt in.

import { userStore } from "./user-store.js";
import { worldStore } from "./world-store.js";
import { roomStore } from "./room-store.js";
import { studioStore } from "./studio-store.js";
import { assetStore } from "./asset-store.js";
import { wizardStore } from "./wizard-store.js";
import { uiStore } from "./ui-store.js";

export { userStore, worldStore, roomStore, studioStore, assetStore, wizardStore, uiStore };

const shards = [userStore, worldStore, roomStore, studioStore, assetStore, wizardStore, uiStore];

/**
 * Activates the test-only Proxy compatibility bridge. Reads and writes route
 * by field name into the owning shard; unknown fields stay in a legacy bucket.
 */
export function activateShardBridge() {
  if (typeof window === "undefined") return;
  const legacyState = window.zhimuState || {};

  window.zhimuState = new Proxy({}, {
    get(_target, key) {
      for (const s of shards) {
        const cur = s.get();
        if (key in cur) return cur[key];
      }
      return legacyState[key];
    },
    set(_target, key, value) {
      for (const s of shards) {
        const cur = s.get();
        if (key in cur) {
          s.set({ [key]: value });
          return true;
        }
      }
      legacyState[key] = value;
      return true;
    },
    has(_target, key) {
      for (const s of shards) {
        if (key in s.get()) return true;
      }
      return key in legacyState;
    },
    ownKeys() {
      const keys = new Set();
      for (const s of shards) {
        for (const k of Object.keys(s.get())) keys.add(k);
      }
      for (const k of Object.keys(legacyState)) keys.add(k);
      return [...keys];
    },
    getOwnPropertyDescriptor(_target, key) {
      for (const s of shards) {
        const cur = s.get();
        if (key in cur) {
          return { configurable: true, enumerable: true, value: cur[key], writable: true };
        }
      }
      if (key in legacyState) {
        return { configurable: true, enumerable: true, value: legacyState[key], writable: true };
      }
      return undefined;
    }
  });
}
