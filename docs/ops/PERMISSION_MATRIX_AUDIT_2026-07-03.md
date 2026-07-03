# 权限矩阵抽查记录 · L1-05 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 日期 | 2026-07-03 |
| 范围 | world · room · role · catalog · ops · asset |
| 自动化 | `permissions-matrix.test.js` + `runtime-permissions.test.js` + ops/catalog/feedback 专项测试 |
| 结论 | **通过** — 关键越权路径均被拒绝，主持/玩家/协作者边界符合文档矩阵 |

## 矩阵对照（文档 §3 → 实测）

### 世界 / 协作（world）

| 能力 | 预期 | 测试 / 证据 | 结果 |
|---|---|---|---|
| 游客创世界 | 403 `GUEST_ACCOUNT_RESTRICTED` | `permissions-matrix` · guest cannot create world | ✓ |
| 非成员读 studio | 403 `WORLD_ACCESS_DENIED` | L1-05 · non-member cannot read studio | ✓ |
| viewer 读 studio 脱敏 | 200，无草稿正文/私密字段 | viewer studio read is redacted | ✓ |
| viewer 写规则/上传 | 403 `WORLD_EDITOR_REQUIRED` | L1-05 · viewer cannot create rule / upload-url | ✓ |
| player 删世界 / 邀成员 | 403 | player cannot delete world / invite | ✓ |
| owner 列成员 | 200 | owner can list members | ✓ |

### 公开库（catalog）

| 能力 | 预期 | 测试 / 证据 | 结果 |
|---|---|---|---|
| owner 自上架 | 403 `CATALOG_SELF_PUBLISH_DISABLED` | `world-catalog.test.js` | ✓ |
| 非 owner 改 catalog | 403 `WORLD_OWNER_REQUIRED` | player cannot patch catalog visibility | ✓ |
| 非 owner 提交审核 | 403 `WORLD_OWNER_REQUIRED` | L1-05 · viewer cannot submit catalog review | ✓ |
| Ops 审阅列表 | 401 无 token | `ops-catalog.test.js` | ✓ |

### 运行房（room / role）

| 能力 | 预期 | 测试 / 证据 | 结果 |
|---|---|---|---|
| 玩家读 host-progress | 403 `HOST_ROLE_REQUIRED` | `runtime-permissions` · player cannot read host progress | ✓ |
| 主持读 host-progress | 200 | L1-05 · host progress allowed | ✓ |
| 玩家手动发线索 | 403 `HOST_ROLE_REQUIRED` | L1-05 · player cannot grant clue | ✓ |
| 玩家完成他人分幕 | 404 locked | player cannot complete another role's section | ✓ |
| 玩家完成本分幕 | 200 | player can complete own section | ✓ |
| 私密语音房隔离 | 403 | private voice rooms isolated | ✓ |

### 资产（asset）

| 能力 | 预期 | 测试 / 证据 | 结果 |
|---|---|---|---|
| 非成员列资产 | 403 `WORLD_ACCESS_DENIED` | L1-05 · non-member cannot list assets | ✓ |
| editor+ 签名上传 | 需 `requireWorldRole` | `asset-routes.js` + viewer blocked | ✓ |
| 存储用量 | 登录可读 | `GET /api/storage/usage` · requireActor | ✓（路由守卫） |

### 运维（ops）

| 能力 | 预期 | 测试 / 证据 | 结果 |
|---|---|---|---|
| Ops 无 token | 401 `OPS_TOKEN_REQUIRED` / `OPS_NOT_CONFIGURED` | ops-audit / L1-05 feedback list | ✓ |
| Ops 错误 token | 401 | L1-05 · wrong token | ✓ |
| Ops 正确 token | 200 | L1-05 · feedback stats ok | ✓ |
| Metrics 生产未配置 | 503 | `ops-metrics.test.js` | ✓ |
| 公开反馈提交 | 201 无需登录 | `feedback.test.js` | ✓（by design） |

## 人工抽查项（API 层已覆盖，UI 未在本轮点击）

| 项 | 说明 | 状态 |
|---|---|---|
| 玩家端只见自己的线索/分幕 | 后端 player-home 推导 + section complete 锁 | 自动化覆盖 |
| 主持台不见其他世界数据 | room_id 作用域 + host 路由 | 自动化覆盖 |
| Ops 控制台无 token 不可进 | 前端依赖 ops token；后端 401 | 后端 ✓ |
| 公开库预览不含草稿 | catalog-preview API 仅 approved | 见 `platform-site.test.js` |

## 已知可接受项

- **editor 可读 studio / assets**：符合 `WORLD_READER_ROLES`，只读不脱权写操作。
- **世界 owner/editor 可 heal 为 room host**：`requireRoomRole` 允许创作侧进房主持（产品约定）。
- **反馈 API 公开 POST**：Beta 自助闭环；Ops 读列表仍受 token 保护。

## 验收命令

```powershell
cd backend
node --test-concurrency=1 --test-force-exit --import ./test/hooks.mjs --test test/permissions-matrix.test.js test/runtime-permissions.test.js test/ops-catalog.test.js test/ops-audit.test.js test/feedback.test.js
```

或仓库根目录：

```powershell
npm run test:permissions-matrix
```

## 后续

- [ ] 下一版本抽查：Stripe/套餐写接口、play 社交 API（若公开 Beta 扩大）
- [ ] 季度与 L1-04 备份演练一并执行
