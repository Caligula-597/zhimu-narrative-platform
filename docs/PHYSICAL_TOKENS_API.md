# 实体卡（Physical Token）后端 API

> 用于线下卡 / QR / 第三方虚拟代币（如 **tump**）联动。宣发与印刷由外部系统负责；织幕负责**码的发行、校验与游戏内发放**。

## 数据模型

表 `physical_tokens`（迁移 `001` + `027`）：

| 字段 | 说明 |
|------|------|
| `token_code` | 唯一码，默认 `ZHM-` + 12 位 |
| `content_type` | `clue` · `item` · `script_section` · `event` |
| `content_id` | 绑定世界内实体 |
| `status` | `issued` → `activated` / `revoked` |
| `activation_rule` | 角色限制、tump 门控、事件文案等 |
| `metadata.integration` | `{ provider: "tump", campaignId, sku, costAmount, externalId }` |

## API

### 创作者（需世界 editor）

```
GET  /api/worlds/:worldId/physical-tokens?status=issued&contentType=clue
POST /api/worlds/:worldId/physical-tokens
POST /api/worlds/:worldId/physical-tokens/:tokenId/revoke
```

**批量发行示例**

```json
POST /api/worlds/{worldId}/physical-tokens
{
  "contentType": "clue",
  "contentId": "uuid",
  "count": 100,
  "label": "2026展会卡",
  "activationRule": {
    "oneTime": true,
    "externalGate": { "provider": "tump", "required": true, "minAmount": 10 }
  },
  "metadata": {
    "integration": {
      "provider": "tump",
      "campaignId": "spring-2026",
      "sku": "fog-clue-card",
      "costAmount": 10,
      "externalId": "tump-product-id-optional"
    }
  }
}
```

### 玩家激活（需入房且已选角色）

```
GET  /api/physical-tokens/:tokenCode/preview
POST /api/rooms/:roomId/physical-tokens/activate
```

**带 tump 凭证激活**

```json
{
  "tokenCode": "ZHM-ABCDEFGHJKLM",
  "externalProof": {
    "provider": "tump",
    "transactionId": "your-ledger-tx-id",
    "amount": 10
  }
}
```

激活成功后：按 `content_type` 发放线索/物品、解锁分幕或写入时间线；触发 SSE `room.physical_token_activated`；跑一遍房间规则。

## tump 联动（当前阶段）

- **默认关闭**：未设置 `TUMP_ACTIVATION_ENABLED=true` 时，带 tump 门控的实体卡**不可激活**（503 `TUMP_INTEGRATION_DISABLED`），避免仅凭 `transactionId` 字符串绕过。
- 开发/联调：在环境变量显式开启后，`integrations/tump-gate.js` 才接受 stub 凭证；**尚未**对接链上/账本 API。
- 下一步：在 tump 侧扣款成功后回调或签名验证，替换 stub 校验；可在 `metadata.integration.externalId` 存 tump 商品 ID。

## 前端

创作者主应用 `src/api` 未封装上述端点；主持/玩家激活走 `POST /api/rooms/:roomId/physical-tokens/activate`。UI 待做时可直连后端 API。
