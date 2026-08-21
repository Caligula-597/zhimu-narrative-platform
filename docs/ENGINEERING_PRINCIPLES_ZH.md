# 织幕 · 工程核心原则

> **状态**：当前团队/AI 协作的**最高优先级约定**（暂时生效，后续可修订）。
> **更新**：2026-07-02
> **关联**：[SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) · [LAUNCH_PRIORITIES_ZH.md](./LAUNCH_PRIORITIES_ZH.md) · [DESIGN_ZH.md](./DESIGN_ZH.md)

---

## 总则

织幕是**运行态优先**的垂直平台：创作、主持、玩家链路都依赖稳定的后端与可回滚的增量改动。以下六条原则优先于「快加功能」——任何会话、PR、AI 任务都应先对照本页。

---

## 原则一 · 小步改动（单文件 ≤ 10%）

**每次改动，单个文件的变化量不应超过该文件总行数的大约 10%。**

### 为什么要这样

- 大 diff 难以 review，容易混入无关修改
- 出问题时可快速定位、回滚
- 与「后端为主 + 配套检测」配合，每次只验证一小块

### 怎么做

| 场景 | 做法 |
|------|------|
| 功能跨多文件 | 拆成多次提交：先后端 API + 测试 → 再前端接线 → 再文档 |
| 单文件必须大改 | 先拆函数到新文件，或分 2～3 次 PR，每次仍尽量 ≤10% |
| 新建文件 | 不受 10% 限制；但单文件仍应职责单一 |
| 纯文档/配置 | 可一次更新，但避免无关文件混在同一 commit |

### 自检

```powershell
# 查看某文件本次改动占比（示例）
git diff --stat path/to/file.js
```

若某文件 diff 行数 > 文件总行数 × 0.1，**暂停并拆分**（除非用户明确要求大重构）。

---

## 原则二 · 改动必带配套检测

**改代码的同时，必须跑与改动范围匹配的检测，确认不破坏已有功能。**

### 默认命令（日常）

```powershell
npm run verify:changed
```

根据 `git diff` 自动选择**最小必要**检测（语法、`check:schemas`、对应 `backend/test/*.test.js`、`check:modules` 等）。详见 [scripts/verify-changed.mjs](../scripts/verify-changed.mjs)。

### 改动类型 → 最低要求

| 改动 | 最低检测 |
|------|----------|
| `backend/src/*.js` | 对应单测（无则补最小用例）+ `node --check` |
| 写/SSE 路由 schema | `npm run check:schemas` |
| `src/` 视图/入口 | `npm run check:modules` |
| `play/` | `npm run test:play`（若动到 play 源码） |
| 仅 `docs/`、`.md` | 跳过测试；检查无密钥路径 |

### 发布 / 用户明确要求全量时

```powershell
cd backend && npm test
npm run verify:full:fresh   # 或分项 smoke / E2E
```

**禁止**：在未跑任何检测的情况下声称「应该没问题」。

---

## 原则三 · 后端为主，地基扎稳

**API、数据模型、权限、幂等、测试先落地；前端是消费层，不超前堆 UI。**

### 顺序

1. **数据与迁移** — PostgreSQL migration，jsonb 规则/快照结构
2. **路由 + Schema** — Fastify JSON Schema + 统一 `{ error, code }`
3. **领域逻辑** — `backend/src/*.js`，按域拆分，不单文件堆功能
4. **测试** — `backend/test/*.test.js`，覆盖 happy path + 关键 4xx
5. **前端接线** — 主应用 / play / site 只做真实 API 绑定
6. **文档** — 更新 [PROJECT_STATUS.md](./PROJECT_STATUS.md)、[PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md) 或本任务相关文档

### 不做

- 在后端未稳定时做大量前端交互或视觉
- 前端 mock 假数据冒充已接通（P0-1 数据诚实）
- 跳过 schema 门禁新增写接口

### 参考

- 架构：[DESIGN_ZH.md](./DESIGN_ZH.md)
- 上市任务优先级：[LAUNCH_PRIORITIES_ZH.md](./LAUNCH_PRIORITIES_ZH.md)（P0 后端项优先）

---

## 原则四 · 健壮性：单路径失败不拖垮全局

**任何一条业务路径出错，不应导致整个应用无法启动或全站 500。**

### 设计约定

| 层级 | 要求 |
|------|------|
| **启动** | 缺可选 env（LiveKit、Stripe、DeepSeek）→ 功能降级，进程仍启动 |
| **API** | 业务错误返回 4xx + 明确 `code`；未捕获异常有全局 handler |
| **前端** | `friendlyApiError` / play `errors.js`；SSE 失败回退轮询 |
| **并发** | 幂等键、事务、`FOR UPDATE` 防双写；测试里覆盖 409 |
| **依赖** | R2/OAuth/邮件不可用 → 该功能不可用，其它视图仍可进 |

### 每次改动额外自问

- 新分支有没有 **early return** 而不是 throw 到顶层？
- 新 env 是 **required 还是 optional**？生产缺了会怎样？
- 是否增加了 **至少一条** 失败路径测试（400/403/409/503）？

### 健壮性相关测试入口

- 后端：`robustness-fixes.test.js`、`ops-health.test.js`、`register-ip-limit.test.js` 等
- 健康检查：`GET /api/health/live`、`GET /api/health/ready`
- 内测前全量：`SECURITY_AND_TESTING.md` §整体验收

---

## 原则五 · 检测通过后自动 commit 与 push

**`verify:changed`（或约定的全量检测）通过后，默认立即 commit + push，不再反复询问。**

### 流程

1. `git status` / `git diff` — 不得含 `.env`、密钥、大二进制
2. `npm run verify:changed` — 必须通过
3. `git add` — **仅**本次相关文件
4. `git commit` — 1～2 句，说明 **why**
5. `npm run git:push` — 经 Clash 代理推送（见 [git-clash-proxy.mdc](../.cursor/rules/git-clash-proxy.mdc)）

### 禁止自动提交的情况

- 检测失败
- 含疑似密钥或 `.env`
- 用户本轮明确说「先别提交 / 不要 push」
- **禁止** `git push --force` 到 `main`/`master`

### Cursor 规则

与 [.cursor/rules/auto-commit-push-after-checks.mdc](../.cursor/rules/auto-commit-push-after-checks.mdc) 一致。

---

## 原则六 · 工作区整洁，无残留垃圾

**每次任务结束，工作区应干净、可交接，不留下无用或误导性文件。**

### 结束前检查清单

- [ ] `git status` — 无未跟踪的临时文件、截图、debug 脚本
- [ ] 无 `_backup`、`.tmp`、`test-output`、误提交的 `dist/`
- [ ] 文档数字与 [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) 一致（若改了验收相关）
- [ ] 未改动的文件不要出现在 `git add` 里
- [ ] 新建文件有明确用途；实验性代码不入 `main` 或须标注删除计划

### 不要留下

- 注释掉的大段 dead code「以后 maybe 用」
- 与任务无关的格式化整个仓库
- 未使用的 import / 半成品 feature flag 默认开启

---

## 单次任务标准流程（摘要）

```
1. 读相关代码与文档，明确最小改动面
2. 单文件 diff 控制在 ~10% 以内；后端先于前端
3. 实现 + 补/改配套测试
4. npm run verify:changed（必要时加健壮性用例）
5. git status 确认文件集干净且必要
6. commit + npm run git:push
7. 回复：commit hash、跑了哪些检测、工作区是否 clean
```

---

## 与其它文档的关系

| 文档 | 关系 |
|------|------|
| [LAUNCH_PRIORITIES_ZH.md](./LAUNCH_PRIORITIES_ZH.md) | **做什么**（P0–P3 产品任务） |
| **本文** | **怎么做**（工程纪律） |
| [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) | **怎么验**（验收数字与命令） |
| [ROADMAP_LAUNCH_ZH.md](./ROADMAP_LAUNCH_ZH.md) | Part 分期与 API 清单 |

---

*织幕 · 工程核心原则 · 团队与 AI 协作共同遵守*
