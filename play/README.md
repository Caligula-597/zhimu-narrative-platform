# 织幕 · 玩家端 (`play/`)

纯玩家视角的独立前端，部署在 **`play.getzhimu.com`**（Cloudflare Pages）。API 仍走 **`app.getzhimu.com/api`**。

## 功能（MVP）

- 邀请码加入平行房、选择角色
- 分幕阅读、标记完成
- 探索场景与调查点
- 线索列表与已读标记
- 背包展示
- 访客 / 邮箱登录 / OAuth（回调回跳到玩家域）

## 本地开发

```powershell
# 终端 1：后端（仓库根目录）
npm run dev:backend

# 终端 2：玩家端
cd play
npm install
npm run dev
```

默认打开 `http://localhost:5174`。Vite 会把 `/api` 代理到 `http://127.0.0.1:4180`。

可选环境变量（`play/.env.local`）：

```text
VITE_API_ORIGIN=https://app.getzhimu.com
VITE_APP_ORIGIN=https://app.getzhimu.com
VITE_DEV_API_PROXY=http://127.0.0.1:4180
```

## 构建与部署

| 项 | 值 |
|----|-----|
| Cloudflare Pages 项目 | `zhimu-play`（建议） |
| Root directory | **`play`** |
| Build command | `npm ci && npm run build` |
| Output directory | **`dist`** |
| 自定义域 | `play.getzhimu.com` |

## Railway 环境变量

与主应用同仓库，需增加：

```text
PLAY_SITE_ORIGIN=https://play.getzhimu.com
PLAY_SITE_URL=https://play.getzhimu.com
```

推送：`npm run railway:push-env`

OAuth 从玩家域发起时，后端会把 `oauth_code` 回跳到 `play.getzhimu.com/?oauth_code=...`（需 migration 034）。

## URL 参数

| 参数 | 说明 |
|------|------|
| `?join=邀请码` | 预填并进入加入流程 |
| `?auth=login` | 打开登录页 |
| `?oauth_code=` | OAuth 回调（自动处理） |

## 与主应用的关系

| 域名 | 用途 |
|------|------|
| `getzhimu.com` | 营销官网 (`site/`) |
| `app.getzhimu.com` | 创作者 / 主持 / API |
| `play.getzhimu.com` | 玩家端 (`play/`) |

页头「创作者入口」链到 `app.getzhimu.com`。
