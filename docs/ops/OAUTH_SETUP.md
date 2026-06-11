# 织幕 · OAuth 登录配置（Google / GitHub）

> 代码与 UI 已实现；**缺的是 OAuth 控制台凭证 + Railway 环境变量**。  
> 生产诊断：`GET https://getzhimu.com/api/auth/config` → `oauthDiagnostics.ready === true`

## 回调 URL（必须一字不差）

域名：**getzhimu.com**（与 `APP_PUBLIC_URL` 一致）

| Provider | 在 OAuth 控制台填写的回调 / Redirect URI |
|----------|----------------------------------------|
| **Google** | `https://getzhimu.com/api/auth/oauth/google/callback` |
| **GitHub** | `https://getzhimu.com/api/auth/oauth/github/callback` |

Google 还需在 **Authorized JavaScript origins** 添加：`https://getzhimu.com`

---

## 1. Google Cloud

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → 创建或选择项目  
2. **APIs & Services → OAuth consent screen**  
   - User type：External（或 Internal 若仅 Workspace）  
   - 填应用名「织幕」、用户支持邮箱  
   - Authorized domains：`getzhimu.com`  
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**  
   - Application type：**Web application**  
   - Authorized JavaScript origins：`https://getzhimu.com`  
   - Authorized redirect URIs：`https://getzhimu.com/api/auth/oauth/google/callback`  
4. 复制 **Client ID**、**Client Secret**

---

## 2. GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**  
2. 填写：  
   - **Application name**：织幕  
   - **Homepage URL**：`https://getzhimu.com`  
   - **Authorization callback URL**：`https://getzhimu.com/api/auth/oauth/github/callback`  
3. 创建后复制 **Client ID**；**Generate a new client secret** 复制 Secret  
4. 若组织仓库：Organization → Settings → Third-party access 允许该 App

---

## 3. 写入环境变量

### 本地 `backend/.env`

```env
APP_PUBLIC_URL=https://getzhimu.com
CORS_ORIGIN=https://getzhimu.com

GOOGLE_CLIENT_ID=你的-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=你的-google-secret

GITHUB_CLIENT_ID=你的-github-client-id
GITHUB_CLIENT_SECRET=你的-github-secret

# 一般不用改，默认与 APP_PUBLIC_URL 相同
# OAUTH_CALLBACK_ORIGIN=https://getzhimu.com

# 至少配好一个 provider 后再开；未配凭证时设为 true 会导致服务启动失败
REQUIRE_OAUTH_IN_PRODUCTION=false
```

### 推到 Railway

```powershell
# 填好 backend/.env 后
npm run railway:sync-env
npm run railway:push-env
```

或在 Railway → Variables 手动添加以上 4 个 `*_CLIENT_*` 键。

---

## 4. 验收

1. 部署/重启后访问：  
   `https://getzhimu.com/api/auth/config`  
   - `oauth` 数组非空（如 `[{id:"google",label:"Google"},…]`）  
   - `oauthDiagnostics.ready: true`  
   - 各 provider `enabled: true`，`callbackUrl` 为上方 HTTPS 地址  

2. 打开织幕 → **登录 / 注册** → 应出现 **Google / GitHub 登录** 按钮  

3. 完整走一遍 OAuth → 回到首页带 `?oauth_code=` → 自动登录  

4. **账号设置** → OAuth 状态区显示「已启用」

本地检查：

```powershell
npm run oauth:check
```

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 登录弹窗无 OAuth 按钮 | Railway 未配 `GOOGLE_*` / `GITHUB_*` 或未 Redeploy |
| Google `redirect_uri_mismatch` | 控制台 Redirect URI 必须与上表完全一致 |
| GitHub 无邮箱 | GitHub 账号需有公开或 primary email；App 需 `user:email` scope（代码已含） |
| 回调后 `oauth_error` | 看 Railway 日志；多为 Secret 错误或 callback 不一致 |
| 启动 FATAL OAuth | `REQUIRE_OAUTH_IN_PRODUCTION=true` 但未配任何 provider → 改 false 或补凭证 |

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `backend/src/oauth-providers.js` | Provider 与回调 URL 构建 |
| `backend/src/oauth-diagnostics.js` | 启动 WARN/FATAL、`/auth/config` 诊断 |
| `scripts/sync-railway-env.mjs` | 同步 OAuth 变量到 `.env.railway` |
| `scripts/check-oauth-config.mjs` | 本地检查凭证与回调 URL |
