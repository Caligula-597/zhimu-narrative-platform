# E2E / 浏览器测试

最后更新：2026-07-24

## Playwright 矩阵

默认浏览器：

```text
chromium, firefox, webkit
```

当前项目列表由 `playwright.config.js` 生成：

- `app-chromium`
- `app-firefox`
- `app-webkit`
- `play-chromium`
- `play-firefox`
- `play-webkit`

测试覆盖创作者角色私人档案、向导、Host、玩家进度、全链路、存档复盘、运行主路径、三端 Trusted Types，以及玩家端广场/邀请码/官方体验/Tab。项目和数量以 `npx playwright test --list` 的当前输出为准；列出成功不等于执行通过。

## 运行

```powershell
npm run test:e2e
```

复用已启动服务：

```powershell
$env:PLAYWRIGHT_SKIP_WEBSERVER="true"
$env:PLAYWRIGHT_API_URL="http://localhost:4180"
$env:PLAYWRIGHT_BASE_URL="http://localhost:4173"
$env:PLAYWRIGHT_PLAY_URL="http://localhost:5174"
npm run test:e2e
```

临时只跑 Chromium：

```powershell
$env:PLAYWRIGHT_BROWSERS="chromium"
npm run test:e2e
```

## 服务依赖

| 服务 | URL |
|---|---|
| API | `http://localhost:4180` |
| 主应用 | `http://localhost:4173` |
| 玩家端 | `http://localhost:5174` |

玩家端 E2E 必须使用 Vite dev，因为需要 `/api` proxy。不要用 `vite preview` 替代。

## 主要 spec

| Spec | 覆盖 |
|---|---|
| `creator-wizard-smoke` | 三类产品选择、单次命名、空白桌游组件工坊 |
| `creator-role-archive` | 角色私人档案懒加载、展开、编辑、新增分幕与保存 |
| `host-director-smoke` | 待办、等待提示、nudge 弹窗 |
| `player-host-progress` | 玩家阅读进度同步到主持台 |
| `runtime-main-path` | 主持发线索、开放场景与玩家探索主链路 |
| `full-chain` | fixture 玩家全链路与极简创建到桌游原型 |
| `archive-recap-smoke` | 存档与复盘 |
| `trusted-types-enforce` | Creator、Host、Play 强制模式启动与原始 sink 拒绝 |
| `play-portal-smoke` | 邀请码、移动导航、广场 deep-link |
| `play-official-example` | 官方体验入口 |
| `play-sync-chrome` | 广场非白屏、入房后 tablist；文件名保留历史，测试已跨浏览器 |

## 辅助

- `e2e/helpers/fixture.mjs`
- `backend/scripts/e2e-reset-fixture-room.mjs`
