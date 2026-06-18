# 织幕 · 玩家端 (`play/`)

纯玩家视角的独立前端，部署在 **`play.getzhimu.com`**（Cloudflare Pages）。API 仍走 **`app.getzhimu.com/api`**。

架构说明：[docs/DESIGN_ZH.md](../docs/DESIGN_ZH.md) · API 对照：[docs/PLATFORM_MAP_ZH.md](../docs/PLATFORM_MAP_ZH.md) §3.9

## 功能

- 邀请码加入平行房、选择角色（`?join=` 深链）
- 分幕阅读、高亮、笔记本 API
- 探索场景与调查点
- 线索列表、已读、私享
- 背包展示
- **局内复盘 Tab**（`latestRecap` + 玩家视角详情）
- **等待主持确认**横幅（`player-home.hostConfirm` + SSE）
- 访客 / 邮箱登录 / OAuth / **找回密码** / **邮箱验证**
- 广场、好友、私信（需验证邮箱）
- 移动端底部导航（≤720px）
- SSE **局部刷新**（tab/侧栏/横幅，不整页重绘）

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

## 玩家旅程

1. **首页** — 四步流程说明 + 两条入口：
   - **我有邀请码**：输入码 → 选角色 → 进入房间
   - **官方示例**：无需邀请码，自动创建体验房（需登录且验证邮箱）
2. **加入向导** — 三步进度条（邀请码 → 选角色 → 进入），展示世界/房间信息与可选席位
3. **房间内概览** — 当前场景、分幕/线索/背包统计、「继续阅读」建议下一步
4. **分幕 / 探索 / 线索 / 背包 / 复盘** — 完整玩家功能，侧边栏显示房间成员

URL 参数：

| 参数 | 说明 |
|------|------|
| `?join=邀请码` | 预填并进入加入向导 |
| `?view=game&tab=sections` | 局内直达分幕 |
| `?view=plaza` | 广场 |
| `?post=帖子ID` | 广场帖子 |
| `?experience=official` | 官方示例 |
| `?auth=login` | 打开登录页 |
| `?reset=token` | 密码重置 |
| `?verify=token` | 邮箱验证 |

## 与主应用的关系

| 域名 | 用途 |
|------|------|
| `getzhimu.com` | 营销官网 (`site/`) |
| `app.getzhimu.com` | 创作者 / 主持 / API |
| `play.getzhimu.com` | 玩家端 (`play/`) |

页头「创作者入口」链到 `app.getzhimu.com`。主持操作仅在主应用 `director` 视图；玩家两端（主应用 `player` 与 play）共享同一套 player-home / SSE API。

## 测试

```powershell
npm run test:play          # 构建 + 单元
npm run test:e2e           # 含 play-portal-smoke（需 :5174 :4173 :4180）
```
