# 织幕 · 项目现状与休息检查点



> **更新**：2026-06-04  

> **阶段**：Alpha → Beta 过渡（可内测，非生产 SaaS）  

> **策略**：**后端与运维优先**；前端功能与 UI 在 backend Beta 门禁达标后再排期。



本文档是团队休息/交接时的**单一入口**，详细内容仍分散在各专题文档。



---



## 1. 本阶段已完成（按时间线）



### 前端 ↔ 后端对齐（用户可见层）

- Restore scoped UI、设置 PATCH、资产筛选/搜索、规则预览/手动触发

- `friendlyApiError` + [USER_ERROR_GUIDE.md](./USER_ERROR_GUIDE.md)

- 向导规则模板自动创建 + [CREATOR_GUIDE.md](./CREATOR_GUIDE.md)

- 内测 UI：Session 默认路径、`VITE_REQUIRE_AUTH` 构建、登录条、占位文案清理

- **前后端缺口补齐**：`getHostPlayerDetail`、附件下载、DeepSeek 整本悬疑 UI、顶栏全局搜索（`GET /worlds/:id/search`）

- **预发栈**：Docker Compose + [ops/STAGING.md](./ops/STAGING.md)（Docker 可选，本地 dev 不受影响）

- **E2E**：Playwright 雾港全链路 + 平行房 `FOG-E2E-AUTO`；`npm run verify:full:fresh`

- API 客户端统一为 **`src/api/client.js`**（已移除根目录 `api-client.js` 副本）



### 前端工程（Vite）

- `npm run dev` / `build` / `start:dist`

- 入口：`frontend/main.js` + `window.*` 全局（ES module 去全局化留 Beta 后）

- CI：`npm run build` + `check:modules` + `server.js --dist`

- 详见 [FRONTEND_MODULE_PLAN.md](../FRONTEND_MODULE_PLAN.md)



### 安全与运维基线

- 生产禁止 `ALLOW_DEMO_USER_HEADER` 启动

- HTTP 安全头、上传 MIME + 扩展名黑名单

- **P0/P1 运维**：`/metrics`、JSON 日志、OpenAPI、`db:backup`、ops API、告警文档

- [OPS.md](./OPS.md)、[ops/REMOTE_TESTING.md](./ops/REMOTE_TESTING.md)



### 后端质量提升（Beta 门禁）

- **`GET /api/health/ready`** — DB + 连接池就绪（503 = 勿引流）

- **多实例 SSE**：`ROOM_EVENTS_BUS=postgres`（PostgreSQL NOTIFY）

- **Schema 门禁**：**54** 条写/SSE 路由（含 share-roles、host-event delay、assets restore）

- **Beta-1 产品体验**：LiveKit 语音流、线索私享、主持延迟 UI、搜索高亮、独立线索页、**主持审计 UI**

- **Beta-2 后端加固**：upload/AI 限流分桶、上传扫描 stub/quarantine、主持延迟 audit、`/api/ops/status` telemetry

- **规则 POST/PUT** 入库前 **`validateRuleBody`**（422 `RULE_BODY_INVALID`）

- **成功路径测试**：`beta-gates.test.js`（建世界/成员/规则）

- 详见 [BACKEND_OPS.md](./BACKEND_OPS.md)、[BACKEND_OPS_BENCHMARK.md](./BACKEND_OPS_BENCHMARK.md)



### 问题排查记录

| 现象 | 根因 | 处理 |

|------|------|------|

| checkpoint 测试 500 | 快照并行占满 PG 连接池 | 单 client 查询 |

| dist 启动 EADDRINUSE | 4173 已被占用 | 停旧进程再 `start:dist` |

| 云端连接失败 | 后端未启动或 Vite 代理 ECONNREFUSED | 双终端 dev + 硬刷新 |

| 规则 E2E 不触发 | `actions` schema 误为 object，规则创建 400 | 改 array + 断言 201 |

| config 错误 worldId | demoWorld UUID 与 seed 不一致 | 对齐 `08646748-…` |



---



## 2. 当前数字（验收基准）



| 门禁 | 结果 |

|------|------|

| `backend npm test` | **170** |

| `npm run check:schemas` | **54** 条路由 |

| `npm run check:tests` | ≥100 |

| API smoke | **18** 项 |

| UI smoke | **34** 项 |

| Playwright E2E | 1 项（雾港 Acts 1–5） |

| `npm run check:modules` | **29** 脚本链 |

| `node scripts/verify-dist-host.mjs` | dist 托管探活 |



---



## 3. 文档索引



| 文档 | 用途 |

|------|------|

| [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md) | **产品功能与工程现状（中文总览，推荐先读）** |
| [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) | 功能实现总览、未接通、风险 |

| [FEATURE_CATALOG.md](../FEATURE_CATALOG.md) | 逐项功能说明与变更历史 |

| [ALPHA_FEATURE_MATRIX.md](../ALPHA_FEATURE_MATRIX.md) | 真实/演示/待接入速查 |

| [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) | 安全项 + 测试矩阵 |

| [OPS.md](./OPS.md) | 部署与故障排查 |

| [ops/STAGING.md](./ops/STAGING.md) | Docker 预发栈与 smoke |

| [ops/REMOTE_TESTING.md](./ops/REMOTE_TESTING.md) | 远程联调与内测构建 |

| [BACKEND_OPS.md](./BACKEND_OPS.md) | **后端路线图** |

| [FRONTEND_MODULE_PLAN.md](../FRONTEND_MODULE_PLAN.md) | Vite + 模块边界 |

| [DEMO_ROUTE.md](../DEMO_ROUTE.md) | 雾港 12 分钟 Demo |



---



## 4. 本地启动



```powershell

# 终端 1 — 后端

cd backend

npm run dev                 # :4180



# 终端 2 — 前端

cd ..

npm run dev                 # :4173，/api 代理到 4180

```



环境：复制 `backend/.env.example` → `backend/.env`；本地 Demo 需 `ALLOW_DEMO_USER_HEADER=true`。



---



## 5. 下一阶段

1. ~~**预发环境第一次部署**~~ — ✅ [ops/STAGING.md](./ops/STAGING.md)（2026-06-03）

2. ~~**正式登录为默认路径**~~ — ✅ 内测构建 + 登录条（2026-06-03）

3. ~~**全文搜索 API + 顶栏 UI**~~ — ✅ `GET /worlds/:id/search` + 全局搜索弹窗（2026-06-03）

4. **Docker 预发在本机/VPS 跑通**（需 VT-x / WSL2；见 STAGING.md）

5. **实体卡 / NFC**、上传安全扫描强化、OpenTelemetry SDK 接入（P2/P3）



~~创作 API schema 全覆盖~~ — ✅（含 world 成员，2026-06-04）  

~~规则 validateRuleBody 挂 POST/PUT~~ — ✅



---



## 6. 收工前自检



```powershell
# 一键全链路（DB 测试 + API/UI smoke + Demo Act2）
npm run verify:full:fresh

# 或分步
cd backend && npm run check:schemas && npm test && npm run test:smoke
cd .. && npm run check:modules && npm run build
```

手动双浏览器 SSE / 主持确认：见 [DEMO_ROUTE.md](../DEMO_ROUTE.md) Act 3–4。



---



## 7. 已知文档滞后项



`FEATURE_CATALOG.md` **变更历史章节**（§12 起）可能保留当时验收数字；**当前数字**以 **本文 §2**、**[PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md)**、**IMPLEMENTATION_STATUS**、**ALPHA_FEATURE_MATRIX** 为准。

