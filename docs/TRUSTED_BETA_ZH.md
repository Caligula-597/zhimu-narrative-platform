# 织幕 · 可信 Beta 收口计划

> **结论**：项目不缺功能数量，缺的是**安全、数据可靠性、协作一致性和质量门禁**。继续横向加功能的收益已经很低，应进入「可信 Beta」收口阶段。  
> **更新**：2026-06-21 · 数字真相源见 [`GENERATED_PROJECT_STATUS.json`](./GENERATED_PROJECT_STATUS.json)（`npm run status:generate`）  
> **关系**：本文件承接 [LAUNCH_PRIORITIES_ZH.md](./LAUNCH_PRIORITIES_ZH.md) 的 P0–P3 商业节奏，但**优先级高于新功能面**。

---

## 阶段定义

| 阶段 | 含义 | 与当前关系 |
|------|------|------------|
| 功能 Beta | 主链路能跑 | ✅ 已基本达到 |
| **可信 Beta** | 安全/恢复/协作/门禁/法务可对外负责 | 🔲 **当前目标** |
| 商业 Beta | 试点团队 + 人工收款 | 依赖可信 Beta |
| 自助 SaaS | Stripe/规模化 | 暂缓 |

**外界实测仍无法替代的五问**（试点结束时必须回答）：

1. 陌生用户能否独立上手？  
2. 主持工作量是否下降？  
3. 玩家端是否顺畅？  
4. 是否愿意第二场？  
5. 是否愿意为「稳定运行 + 多房 + 复盘」付费？

除此之外，工程与内容层面仍有大量工作可在无真实团队前完成。

---

## 建议执行顺序

```
W1–W2  安全会话 / CSP / 依赖与代码扫描
W2–W3  备份恢复演练 + 注销 outbox + R2 策略
W3–W4  协作 revision / 冲突 UI
W4     法务与数据保留（公开 Beta 阻塞项）
W5+    动态门禁、跨浏览器/a11y、性能与故障注入
       标杆剧本、多玩家模拟器、Ops 后台
```

---

## TB-1 · 安全基线

| ID | 事项 | 证据 / 位置 | 状态 |
|----|------|-------------|------|
| TB-1.1 | Session 为 30 天 Bearer + `localStorage` | `src/api/client.js` | 🟡 Cookie 优先；Bearer 仅 E2E 过渡 |
| TB-1.2 | 前端大量 `innerHTML`（~110 处）+ 无 CSP | `backend/src/app.js` 仅有部分安全头 | 🟡 CSP report-only + `/api/csp-report` |
| TB-1.3 | **组合风险**：XSS → 长期 Token 失窃 | 上述叠加 | 🟡 Cookie 已接；观察 CSP 报告后 enforce |
| TB-1.4 | 迁移 HttpOnly/Secure/SameSite Cookie 或严格 CSP + XSS 审计 | 设计决策 | 🟡 Cookie + CSP report-only |
| TB-1.5 | CI：Dependabot | `.github/dependabot.yml` | ✅ 已加配置 |
| TB-1.6 | CI：CodeQL、依赖高危门禁、SBOM | `.github/workflows/` | 🟡 CodeQL + audit + SBOM 已加 |
| TB-1.7 | tump 外部凭证仅验 `transactionId`，**默认禁用** | `integrations/tump-gate.js` · `TUMP_ACTIVATION_ENABLED` | ✅ 默认关 |

**验收**：渗透/XSS 抽检通过；生产 CSP 报告无阻断性误报；高危 CVE CI 失败。

---

## TB-2 · 数据恢复与删除一致性

| ID | 事项 | 证据 | 状态 |
|----|------|------|------|
| TB-2.1 | `pg_dump` + 文档，无自动「备份→新库→校验」演练 | `docs/ops/BACKUP.md` · `npm run db:verify-restore` · CI drill | 🟡 脚本 + CI |
| TB-2.2 | PG 备份不含 R2；需版本控制/复制策略 | `docs/ops/BACKUP.md` R2 节 | 🟡 文档 + 运维清单 |
| TB-2.3 | 注销：先删 R2 再开 DB 事务，可能不一致 | `account-delete.js` | ✅ 已改为 DB 优先 |
| TB-2.4 | 改为删除任务 / outbox + 可重试状态机 | `account-delete-job.js` · 迁移 040 | 🟡 首版 outbox + 存储重试 |
| TB-2.5 | 账号数据导出（GDPR 风格） | `GET /api/account/export` · 账号设置 | 🟡 JSON 元数据导出 |
| TB-2.6 | 数据保留周期 + 过期清理 | `data-retention.js` · `npm run data:purge-expired` | 🟡 脚本 + 文档 |

**验收**：季度恢复演练脚本绿；注销失败可重试且无不一致样本。

---

## TB-3 · 协作编辑保护

| ID | 事项 | 状态 |
|----|------|------|
| TB-3.1 | 协作者权限已有，无乐观锁 / `If-Match` | world/studio/creator/rules 写 API | 🟡 主要写 API 已接（含 POST/DELETE） |
| TB-3.2 | 双编辑者静默覆盖 | 409 + 冲突弹窗 | 🟡 设置/编排/规则 |
| TB-3.3 | 未保存离开提醒 + 本地草稿 | `world-revision.js` beforeunload + localStorage | 🟡 提醒 + 草稿恢复弹窗 |
| TB-3.4 | 冲突对比弹窗 | 🟡 刷新重载弹窗 |

**验收**：并发保存集成测试；UI 冲突可感知。

---

## TB-4 · 测试与质量门禁

| ID | 事项 | 证据 | 状态 |
|----|------|------|------|
| TB-4.1 | Schema 门禁 62 条**手写白名单** | `verify-route-schemas.mjs` | 🟡 白名单 + 动态扫描 |
| TB-4.2 | 新路由易遗漏 → 改为动态发现或 diff | `verify-route-schemas.mjs` 动态段 | 🟡 写路由无 schema 即 FAIL |
| TB-4.3 | CI 仅 fresh DB，缺 N-1→039 升级测试 | `npm run db:verify-migration-upgrade` · CI | 🟡 N-1→latest drill |
| TB-4.4 | Playwright 仅 Chromium | `playwright.config.js` | 🔲 |
| TB-4.5 | 缺 axe、视觉回归、键盘路径 | 🔲 |
| TB-4.6 | 缺性能预算：SSE 多人、大 ZIP/PDF、长剧本 | 🔲 |
| TB-4.7 | 缺故障注入：DB/R2/邮件/SSE/LiveKit 超时 | 🔲 |

**验收**：CI 矩阵含升级迁移；k6/artillery 基线报告；故障演练清单有记录。

---

## TB-5 · 生产功能门禁

| ID | 事项 | 状态 |
|----|------|------|
| TB-5.1 | 上传扫描默认可为 `none`；`strict` 命名易误判 | 🔲 |
| TB-5.2 | tump 假凭证激活 | ✅ 默认禁用 |
| TB-5.3 | 限流单节点内存 + IP；代理后真实 IP | 🔲 |
| TB-5.4 | 用户级 / Redis 共享限流 | 🔲 |

---

## TB-6 · 法务与内容治理（公开 Beta 阻塞）

| 项 | 位置 | 状态 |
|----|------|------|
| 用户协议 | [`docs/legal/USER_TERMS_ZH.md`](./legal/USER_TERMS_ZH.md) · 注册/账号页链接 | 🟡 草案 + 产品内可点 |
| 隐私政策 | [`docs/legal/PRIVACY_ZH.md`](./legal/PRIVACY_ZH.md) · 注册/账号页链接 | 🟡 草案 + 产品内可点 |
| 版权与侵权申诉 | [`docs/legal/COPYRIGHT_APPEAL_ZH.md`](./legal/COPYRIGHT_APPEAL_ZH.md) · 账号页链接 | 🟡 草案 |
| 数据保留与注销（对外） | 隐私政策 §5 | 🟡 |
| 未成年人及敏感内容 | 隐私政策 §6 | 🟡 |
| 社区处罚 / 申诉 / SLA | — | 🔲 |

**验收**：官网与 App 注册前可点击查看；内容与 `account-delete` 行为一致。

---

## TB-7 · 文档真相源

| 问题 | 处理 |
|------|------|
| 文档测试数字易过期 | `npm run status:generate` → `GENERATED_PROJECT_STATUS.json`（当前 **387**） |
| schema 61/62 混用 | 以生成器输出为准（当前 **62**） |
| 迁移文档停在旧版本 | 生成器统计迁移文件数（当前 **41**，latest **041_world_content_revision**） |
| 封面/实体卡等状态矛盾 | 生成器 + 本表维护 |

---

## 不依赖外界实测可补的产品内容

| 项 | 说明 |
|----|------|
| 完整标杆剧本 | 不止「小示例」 |
| 三套合成压力剧本 | 2–3 人短线 / 6 人分支 / 10–12 人长线 |
| 多玩家模拟器 CI | 入房→阅读→调查→主持→复盘 |
| AI 黄金评测集 | 泄密、线索可达、凶手逻辑、戏份、矛盾 |
| 导入样例库 | DOCX、图片 PDF、ZIP、损坏包、旧版内容包 |
| 最小 Ops 后台 | 内测/公开库/举报/套餐/健康集中 |
| 产品内「演练模式」 | 任务清单跑完第一场 |
| 事故演练材料 | DB/R2/邮件/SSE 不可用预案 |

---

## 相关文档

| 文档 | 角色 |
|------|------|
| [GENERATED_PROJECT_STATUS.json](./GENERATED_PROJECT_STATUS.json) | 自动生成数字 |
| [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) | 安全与测试验收 |
| [LAUNCH_PRIORITIES_ZH.md](./LAUNCH_PRIORITIES_ZH.md) | 商业 P0–P3 |
| [ops/BACKUP.md](./ops/BACKUP.md) | 备份恢复 |
| [PHYSICAL_TOKENS_API.md](./PHYSICAL_TOKENS_API.md) | 实体卡 / tump |
