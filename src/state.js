// A2 状态分片 —— 8 个 shard 全部迁移完成
// window.zhimuState 通过 Proxy 路由到 8 个领域 shard；legacy 字面量已清空
// Phase 4 删除此 Proxy，所有消费者改直接 import shard
import { activateShardBridge } from "./state/index.js";

window.zhimuState = {};
activateShardBridge();

export {};
