// A2 状态分片聚合器
// 8 个领域 shard：user / world / room / studio / asset / voice / wizard / ui
// Phase 4 已完成消费者迁移；src/state.js 激活 Proxy 仅保留给 E2E 读取 window.zhimuState。
// 新代码应直接 import 对应 shard，不再通过 window.zhimuState 读写。

import { userStore } from "./user-store.js";
import { worldStore } from "./world-store.js";
import { roomStore } from "./room-store.js";
import { studioStore } from "./studio-store.js";
import { assetStore } from "./asset-store.js";
import { voiceStore } from "./voice-store.js";
import { wizardStore } from "./wizard-store.js";
import { uiStore } from "./ui-store.js";

export { userStore, worldStore, roomStore, studioStore, assetStore, voiceStore, wizardStore, uiStore };

const shards = [userStore, worldStore, roomStore, studioStore, assetStore, voiceStore, wizardStore, uiStore];

/**
 * 激活 Proxy 兼容桥：将 window.zhimuState 替换为 Proxy，
 * 读/写按字段路由到对应 shard；未在 shard 中的字段 fallback 到 legacy 字面量对象。
 *
 * 注意：只能调用一次。调用后所有 `window.zhimuState.xxx = ...` 的旧式写入
 * 会同步进入对应 shard（如果字段属于 shard），未声明的字段进入 legacy 容器。
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
