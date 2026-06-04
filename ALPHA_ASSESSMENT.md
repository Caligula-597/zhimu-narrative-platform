# 织幕 Alpha · 客观评估（2026-06-03）

> 本文档记录 Alpha 阶段的能力边界、测试现状、架构风险与下一阶段建议。  
> 功能清单仍以 [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) 为准；本文侧重**工程质量判断**。

---

## 1. 总评

| 维度 | 评级 | 说明 |
|------|------|------|
| 后端数据模型 | **良好** | 世界/房间分离清晰；迁移 001–**013** 覆盖运行态核心表 |
| 测试体系 | **较强（Alpha）** | **101** 单元/集成 + 17 API smoke + 33 UI smoke + 24 脚本加载 |
| 前端架构 | **脆弱但可接受** | 模块化有进步，仍依赖全局脚本顺序 |
| 生产就绪 | **未就绪** | 单节点 SSE、LiveKit 可选；restore UI 已接通，多节点与 schema 仍缺 |

**结论**：作为 Alpha 内测继续推进合理；Beta/生产前需解决前端构建链、多节点事件与 API schema 全覆盖。

---

## 2. 测试与 CI

### 2.1 测试矩阵（当前）

| 命令 | 数量 | 前置条件 |
|------|------|----------|
| `npm run check` | 语法检查全通过 | 无 |
| `npm run check:boot` | 启动链 + schema | PostgreSQL |
| `npm run check:tests` | 测试用例数 ≥100 | 无 |
| `npm test` | **101** 项 / 30 文件 | PostgreSQL + `npm ci` |
| `npm run test:smoke` | **17** 项 | 后端 `4180` 已启动 |
| `npm run test:ui` | **33** 项 | 前端 `4173` + 后端 `4180` |
| `npm run test:ui:load` | **24** 项 | 无（静态解析脚本） |
| `npm run ci` | 组合脚本 | 同 GitHub Actions |

**CI（`.github/workflows/ci.yml`）**：PostgreSQL 17 服务 → `npm ci` → migrate → seed → `check` → `check:boot` → **`check:tests`** → `npm test` → 启动前后端 → API/UI smoke。

**覆盖域**：认证、checkpoint **端到端 restore**、**event journal 一致性**、**幂等覆盖审计**、线索分享、内容包、主持台、物品、LiveKit、复盘、事件总线、规则引擎、权限、studio 编辑、世界/房间 settings、统一错误码、schema 迁移等。

### 2.2 本地常见失败原因（非代码缺陷）

| 现象 | 原因 | 处理 |
|------|------|------|
| `ERR_MODULE_NOT_FOUND: livekit-server-sdk` | 未 `npm ci` | `cd backend && npm ci` |
| 测试连不上 DB | Postgres 未起 / 无 `DATABASE_URL` | Docker Compose 或 Supabase |
| `test:smoke` / `test:ui` 连接拒绝 | 未启动 4173/4180 | 见 `backend/scripts/bootstrap-local.js` |
| npm registry 403 | 网络/镜像 | 临时换国内镜像 |

### 2.3 测试局限

- **UI smoke 为静态检查**：拉取 HTML/JS 字符串匹配，**不执行**浏览器运行时。
- **`verify-script-load.mjs`**：能捕获 SyntaxError 与重复声明，**不能**替代 E2E。
- 真实事故：模块化拆分后 `formatRelativeTime` 重复声明导致整页空白，当时 ui-smoke 未检出。

---

## 3. 架构风险与已知局限

### 3.1 前端：全局命名空间 + 严格脚本顺序

- `index.html` 必须按固定顺序加载模块；任一文件 SyntaxError → 整页空白。
- 不是 ESM bundler / TypeScript / 组件框架那类由构建系统保证依赖的结构。
- **Alpha**：可接受；改 `src/**` 后务必跑 `npm run test:ui:load`。
- **Beta 建议**：ESM + Vite，或 React/Vue/Svelte + TS。

### 3.2 SSE：单节点内存总线 + 持久化日志（012）

- `room-event-bus.js`：进程内订阅，适合单实例 SSE。
- **`room_event_journal`**：commit 后 best-effort 落库；`transactionWithEvents` rollback 不写 journal（见 `event-journal-e2e.test.js`）。
- **仍未实现**：Redis pub/sub、多实例广播、sticky session。
- Release Notes 已披露「无多节点 Redis/WebSocket 集群」。

### 3.3 Checkpoint：快照与 scoped restore 已实现

- **已有**：创建/列表/详情、`POST .../restore` scoped 回滚（含 **`ruleExecutions`**）、幂等、审计、快照 v2（调查记录 · 玩家状态 · 规则执行记录）。
- **端到端测试**：`checkpoint-restore-e2e.test.js`（独立 fixture，不污染 seed 房）。
- **未实现**：跨房间恢复、前端存档页「恢复」按钮、`timeline_logs` 历史回滚（恢复仅追加新日志）。

### 3.4 LiveKit：环境可选

- 需 `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`；未配置时 token **503**。
- smoke 测试将 503 视为通过。
- 依赖声明在 `package.json`；本地需 `npm ci` 装齐。

### 3.5 API 错误码与 Schema

- 所有路由错误返回 `{ error, code, details? }`；注册表见 [`backend/docs/API_ERRORS.md`](./backend/docs/API_ERRORS.md)。
- `schemas.js` 已覆盖运行关键路径；创作/资产入口 schema 化仍在推进。

---

## 4. 数据库结构（012 后）

完整表清单见 [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)。

| 迁移 | 主题 |
|------|------|
| 001–009 | 核心世界/房间/探索/语音/认证 |
| 010 | 线索分享、解读、`clue_read_receipts` |
| 011 | `room_recaps` 复盘 |
| **012** | checkpoint 恢复审计、事件日志、查询索引、快照版本 |
| **013** | `host_audit_log`、`write_idempotency` |

---

## 5. 下一阶段优先级建议

### 短期（1–2 周）

1. 文档与脚本数字对齐（本评估、`DATABASE_SCHEMA.md`、Release Notes）。
2. 前端存档页接入 `POST .../restore` + 按 `code` 展示错误。
3. `host.event_execute` 幂等 E2E（可选补测）。

### 中期（Beta 前）

1. SSE 多节点方案（Redis 或 journal 轮询 + sticky）。
2. 创作/资产路由 Fastify schema 全覆盖。
3. 前端 Vite 迁移 POC。

### 长期（生产）

1. Rate limit、上传扫描、可观测性。
2. LiveKit 生产密钥管理与房间生命周期。
3. 复盘 AI 叙事层（当前为非 AI 结构化版）。

---

## 6. 本地完整验证清单

```powershell
cd backend
npm ci
npm run bootstrap:local    # migrate + seed + exploration
npm run check
npm test

# 终端 A
npm run dev

# 终端 B（项目根）
node server.js

# 终端 C
cd backend
npm run test:smoke
npm run test:ui
npm run test:ui:load
```

---

**维护**：架构或测试矩阵变更时，同步更新本文 §2、§4 与 [FEATURE_CATALOG.md §27](./FEATURE_CATALOG.md#27-alpha-评估与后端基础2026-06-03)。
