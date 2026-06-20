# 剧本导入服务 SOP（运营 / 试点支持）

> **用途**：把客户提供的 Word / Markdown 剧本，在 **1 个工作日内** 导入织幕并开好首场测试房。  
> **受众**：运营、试点支持、人工托底商业试点（见 [LAUNCH_PRIORITIES_ZH.md](../LAUNCH_PRIORITIES_ZH.md) P1-09）。

---

## 0. 前置条件

- 客户已登记于 [PILOT_TRACKER.md](./PILOT_TRACKER.md)（**当前表格为空模板，须运营填写真实团队后再引用**）
- 支持邮箱已验证的创作者账号（或 ops 代建世界后移交 owner）
- 本地/预发环境：`DATABASE_URL` + `npm run bootstrap:local`（见 [REMOTE_TESTING.md](./REMOTE_TESTING.md)）

### 0.1 客户从哪来（已实现的入口）

| 来源 | 路径 | 说明 |
|------|------|------|
| 官网导入 CTA | `getzhimu.com#import` | 邮件 `support@getzhimu.com` 或 `#beta-import` 表单 |
| 内测申请 | `POST /api/platform/beta/apply` | 通用内测，非专用导入工单 |
| 套餐升级 | `POST /api/account/plan-upgrade-request` | 已登录创作者扩容；见 [PLAN_UPGRADE_SOP_ZH.md](./PLAN_UPGRADE_SOP_ZH.md) |

**尚无**独立「导入工单」API；收到邮件/表单后人工在 PILOT_TRACKER 登记并走下文流程。

---

## 1. 收稿与格式

| 输入 | 要求 |
|------|------|
| **Markdown**（推荐） | 按角色分文件或单文件 + 明确 `# 角色名` 标题 |
| **Word (.docx)** | 先导出为 MD，或走主应用「内容包导入」预览 |
| **必含** | 角色列表、分幕/章节划分、公开场景与线索清单（可后补） |

**禁止**：在 seed / 测试桩中硬编码客户剧本 ID；每个客户独立 `world_id`。

---

## 2. 导入路径（三选一）

### A. 向导从零创建（小本 / 试点）

1. 登录 **app.getzhimu.com**（或预发 URL）
2. 首屏 **创建新世界** → 走完 5 步向导（世界名、角色数、首章）
3. **剧本创作 writer** 视图：逐角色粘贴分幕 Markdown
4. **剧情编排 studio**：补场景、调查点、线索（可先最小集）
5. **自动化规则 rules**：首段读完解锁等（可用模板）
6. 创建 **测试房** → 复制邀请码 → 发给客户 play 端试跑

### B. 内容包导入（已有结构化导出）

1. 主应用 → 世界设置 / 内容包 → **导出** 参考格式
2. 按格式整理客户 MD/JSON → **预览** → **导入为新世界** 或 **合并到草稿世界**
3. 复核 `GET /api/worlds/:id/publish-readiness`（创作者检查清单）
4. 开测试房并记录 `invite_code` 到 PILOT_TRACKER

### C. AI 辅助（整本悬疑 pipeline，可选）

1. 主应用 writer → **AI 剧本创作** 五步向导
2. 人工审校生成结果后再发布分幕（`publication_status: testing`）
3. 禁止未经审校直接对玩家房发布

---

## 3. 开房与交付

| 步骤 | 操作 |
|------|------|
| 1 | 主持监控台 → 创建运行房 / 测试房 |
| 2 | 复制 **邀请码** 与 `https://play.getzhimu.com/?join=CODE` |
| 3 | 客户 play 端选角 → 读第一幕 → 主持台确认进度可见 |
| 4 | 存档页创建 **checkpoint**（首场结束前） |
| 5 | 首场结束后 **生成复盘** 并脱敏存档（案例素材） |

交付清单邮件模板见 [BETA_APPLICATIONS.md](./BETA_APPLICATIONS.md)。

---

## 4. 验收（支持侧自检）

```powershell
cd backend && npm run test:smoke    # 需 :4180
node scripts/ui-smoke.js            # 需 :4173 + :4180
npm run test:e2e                    # 可选，15 项 Playwright
```

客户场验收以 [FIRST_SESSION_GUIDE_ZH.md](../FIRST_SESSION_GUIDE_ZH.md) 为准。

---

## 5. 常见问题

| 现象 | 处理 |
|------|------|
| 玩家看不到分幕 | 检查 `publication_status`、规则解锁、主持待确认事件 |
| 邀请码无效 | 确认 room `status`、invite_code 与世界 membership |
| 官方示例混淆 | 客户应使用 **专属邀请码**，非 `TEST-FIXTURE-DEMO`（仅 CI） |

---

## 6. 关联文档

- [CREATOR_GUIDE.md](../CREATOR_GUIDE.md) — 创作者功能说明  
- [WORLDS_AND_FIXTURES_ZH.md](../WORLDS_AND_FIXTURES_ZH.md) — 测试桩 vs 真实剧本  
- [SECURITY_AND_TESTING.md](../../SECURITY_AND_TESTING.md) — 门禁数字
