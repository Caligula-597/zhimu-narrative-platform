# E2E / 浏览器测试

## Playwright 冒烟（CI + 本地）

**15** 项，覆盖创作者向导、主持台（含 nudge）、玩家进度、存档/复盘、play 邀请码/广场/官方示例/tablist。

```powershell
# 前置：Postgres + migrate/seed（global-setup 会自动跑）
cd backend && npm run bootstrap:local

# 一键（自动起 4180 + 4173 + play 5174）
npm run test:e2e

# 复用已启动服务
$env:PLAYWRIGHT_SKIP_WEBSERVER="true"
npm run test:e2e
```

| 环境变量 | 默认 |
|----------|------|
| `PLAYWRIGHT_INVITE_CODE` | `TEST-FIXTURE-DEMO`（global-setup 注入） |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:4173` |
| `PLAYWRIGHT_PLAY_URL` | `http://localhost:5174` |
| `PLAYWRIGHT_API_URL` | `http://localhost:4180` |

**注意**：play 端 E2E 必须用 `npm run dev`（带 `/api` 代理），不要用 `preview`。

| Spec | 覆盖 |
|------|------|
| `creator-wizard-smoke` | 演示用户 → 五 step 向导 → 邀请码 |
| `host-director-smoke` | 待办、wait strip、**nudge 弹窗** |
| `player-host-progress` | play 读分幕 → 主持台进度 |
| `archive-recap-smoke` | 存档与复盘（折叠导航「更多创作工具」） |
| `play-portal-smoke` | 邀请码、移动导航、广场 deep-link |
| `play-official-example` | 官方示例卡片与 `?experience=official` |
| `play-sync-chrome` | 广场非白屏、入房后 `role=tablist` |

辅助：`e2e/helpers/fixture.mjs` · 重置脚本 `backend/scripts/e2e-reset-fixture-room.mjs`

---

## AI 探索（非 CI 门禁）

| 脚本 | 说明 |
|------|------|
| `e2e/ai-explore.mjs` | 启发式或 LLM 驱动玩家在 UI 中探索（需 :4173 + :4180） |

```powershell
node e2e/ai-explore.mjs --headed
```

不绑定任何具体剧情剧本；与 [WORLDS_AND_FIXTURES_ZH.md](../docs/WORLDS_AND_FIXTURES_ZH.md) 中的 CI 测试桩一致。
