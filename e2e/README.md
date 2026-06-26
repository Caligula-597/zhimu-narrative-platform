# E2E / 浏览器测试

最后更新：2026-06-26

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

当前 `npx playwright test --list` 显示 45 个用例，覆盖创作者向导、主持台、玩家进度、存档复盘、玩家端广场/邀请码/官方体验/Tab。

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
| `creator-wizard-smoke` | 五步向导、测试房、邀请码 |
| `host-director-smoke` | 待办、等待提示、nudge 弹窗 |
| `player-host-progress` | 玩家阅读进度同步到主持台 |
| `archive-recap-smoke` | 存档与复盘 |
| `play-portal-smoke` | 邀请码、移动导航、广场 deep-link |
| `play-official-example` | 官方体验入口 |
| `play-sync-chrome` | 广场非白屏、入房后 tablist；文件名保留历史，测试已跨浏览器 |

## 辅助

- `e2e/helpers/fixture.mjs`
- `backend/scripts/e2e-reset-fixture-room.mjs`
