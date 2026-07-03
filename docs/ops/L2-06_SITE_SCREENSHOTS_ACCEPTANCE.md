# L2-06 官网真实三端截图验收 · 2026-07-03

## 摘要

| 项 | 结果 |
|---|---|
| 路线图 | L2-06 真实官网资产 |
| 范围 | 官网 hero + showcase 四端截图；Playwright 采集脚本 |
| 结论 | **通过**（截图资产；pilot 案例文案仍为后续 L2 可选项） |

## 交付资产

| 文件 | 来源页面 |
|------|----------|
| `site/public/assets/zhimu-screenshot-creator.png` | 主应用 · 线索管理流程图 |
| `site/public/assets/zhimu-screenshot-host.png` | 主持端 · 控制台 |
| `site/public/assets/zhimu-screenshot-play.png` | 玩家端 · 分屏游戏 |
| `site/public/assets/zhimu-screenshot-archive.png` | 主应用 · 复盘/存档 |
| `site/public/assets/zhimu-product-hero.png` | 与 creator 截图同源（hero 区） |

官网 `site/index.html` showcase 与 og:image 已引用上述 PNG，不再使用 `site-preview.svg` 占位。

## 采集与回归

| 命令 | 说明 |
|------|------|
| `npm run capture:site-screenshots` | Playwright 串行截四端 + 复制 hero（需 Chromium；自动 db:migrate/seed + webServers） |
| `npm run test:site-screenshots` | 断言 5 张 PNG 存在且 HTML 无占位 SVG |
| `npm run build --prefix site` | 静态站构建含真实资产 |

## 附带修复（P1-07 回归）

- `host/src/api.js`、`play/src/api.js`：`streamRoomEvents` / `streamPlatformEvents` 改用 `bearerHeaders()`，修复 `authHeaders is not defined`。
- `src/api/client.js`：demo 模式 `/auth/me` 与默认 `x-user-id` 头，保障 E2E/capture 下 `waitForCloudReady`。
- `playwright.config.js`：主应用 webServer 改 `npm run dev`（同源 `/api` 代理）。

## 验收命令（2026-07-03 实测）

```powershell
npm run capture:site-screenshots   # 1 passed (~50s)
npm run test:site-screenshots        # 6/6
npm run verify:changed               # 含 site build + test:play + test:host
```

## 相关

- [PRODUCTION_SAAS_ASSESSMENT_ZH.md](../PRODUCTION_SAAS_ASSESSMENT_ZH.md)
- [06-上市与运维准备路线图.md](../../优化计划/06-上市与运维准备路线图.md)
