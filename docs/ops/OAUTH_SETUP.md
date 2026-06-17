# 织幕 · OAuth 登录配置（Google / GitHub）

> 代码与 UI 已实现。**分域后应用域名为 `app.getzhimu.com`**（非根域 `getzhimu.com`）。  
> 生产诊断：`GET https://app.getzhimu.com/api/auth/config` → `oauthDiagnostics.ready === true`

## 回调 URL（必须一字不差）

域名：**app.getzhimu.com**（与 Railway `APP_PUBLIC_URL` 一致）

| Provider | 在 OAuth 控制台填写的回调 / Redirect URI |
|----------|----------------------------------------|
| **Google** | `https://app.getzhimu.com/api/auth/oauth/google/callback` |
| **GitHub** | `https://app.getzhimu.com/api/auth/oauth/github/callback` |

Google 还需在 **Authorized JavaScript origins** 添加：`https://app.getzhimu.com`

> 若控制台仍保留旧条目 `https://getzhimu.com/api/auth/oauth/...` 可暂时并存；**必须新增 app 子域**，否则 `redirect_uri_mismatch`。

---

## 1. Google Cloud

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → 选择项目  
2. **APIs & Services → OAuth consent screen**  
   - Authorized domains：`getzhimu.com`（根域即可覆盖子域）  
3. **Credentials → OAuth client ID（Web application）**  
   - Authorized JavaScript origins：`https://app.getzhimu.com`  
   - Authorized redirect URIs：`https://app.getzhimu.com/api/auth/oauth/google/callback`  
4. 复制 **Client ID**、**Client Secret** → 写入 `backend/.env`

---

## 2. GitHub

控制台：<https://github.com/settings/developers> → **OAuth Apps** → 选择织幕应用 → **Update application**

| 字段 | 生产环境填写（一字不差） |
|------|--------------------------|
| **Application name** | 织幕（或现有名称，可不改） |
| **Homepage URL** | `https://app.getzhimu.com` |
| **Application description** | 可选 |
| **Authorization callback URL** | `https://app.getzhimu.com/api/auth/oauth/github/callback` |
| **Enable Device Flow** | 保持关闭（默认） |

操作步骤：

1. 打开 [Developer settings → OAuth Apps](https://github.com/settings/developers)  
2. 点击你的 OAuth App（Client ID 与 `backend/.env` 中 `GITHUB_CLIENT_ID` 一致）  
3. 将 **Homepage URL** 从 `https://getzhimu.com` 改为 **`https://app.getzhimu.com`**  
4. 将 **Authorization callback URL** 从 `https://getzhimu.com/api/auth/oauth/github/callback` 改为 **`https://app.getzhimu.com/api/auth/oauth/github/callback`**  
5. 点击 **Update application**  
6. **不要**点击 *Regenerate client secret*（除非 Secret 已泄露）；若重新生成，须同步更新 `backend/.env` 并 `npm run railway:push-env`

凭证：`Client ID` / `Client secrets` → 写入 `backend/.env` 的 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`（通常已有，分域只改 URL 即可）

---

## 3. 环境变量

### 本地 `backend/.env`

```env
APP_PUBLIC_URL=http://localhost:4173
CORS_ORIGIN=http://localhost:4173

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

REQUIRE_OAUTH_IN_PRODUCTION=false
```

### Railway（生产）

```env
APP_PUBLIC_URL=https://app.getzhimu.com
CORS_ORIGIN=https://app.getzhimu.com
# 同上 GOOGLE_* / GITHUB_*
```

推送：

```powershell
# backend/.env 已填 OAuth 凭证后
npm run oauth:check          # 核对本地 + 生产回调 URL
npm run railway:sync-env
npm run railway:push-env     # 需 .env.railway.setup 中 RAILWAY_TOKEN
```

---

## 4. 验收

1. `https://app.getzhimu.com/api/auth/config`  
   - `oauth` 数组非空  
   - `oauthDiagnostics.ready: true`  
   - 各 provider `callbackUrl` 为 `https://app.getzhimu.com/api/auth/oauth/.../callback`  

2. 登录弹窗出现 **Google / GitHub** 按钮  

3. 授权后回到 `https://app.getzhimu.com/?oauth_code=...` 并自动登录  

本地：

```powershell
npm run oauth:check
```

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 无 OAuth 按钮 | Railway 未配 `GOOGLE_*` / `GITHUB_*` → `railway:push-env` 后 Redeploy |
| `redirect_uri_mismatch` | Google/GitHub 控制台回调必须是 **app.getzhimu.com**，不是 getzhimu.com |
| 回调后 `oauth_error` | Railway 日志；多为 Secret 错误或 state 过期 |
| 在 getzhimu.com 营销页点登录 | 应跳转 **app.getzhimu.com** 再登录（营销站无 `/api`） |

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `backend/src/oauth-providers.js` | 回调 URL = `APP_PUBLIC_URL` + `/api/auth/oauth/:provider/callback` |
| `scripts/check-oauth-config.mjs` | `npm run oauth:check` |
| `scripts/sync-railway-env.mjs` | 同步 OAuth 变量到 `.env.railway` |
