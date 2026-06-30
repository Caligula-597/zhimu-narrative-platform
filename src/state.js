// A2 状态分片 —— 8 个 shard 全部迁移完成
// 所有 runtime/view/component 消费者已改为直接 import shard（Phase 4.2a-c 完成）
// app.js 已改为直接 import shard（Phase 4.3 完成）
// Proxy 兼容桥保留仅供 E2E 测试通过 window.zhimuState 读取状态
import { activateShardBridge } from "./state/index.js";

window.zhimuState = {};
activateShardBridge();

export {};
