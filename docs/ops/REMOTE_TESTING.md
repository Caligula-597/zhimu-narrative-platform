# 远程与局域网测试

织幕**不限于 localhost**。后端默认监听 `0.0.0.0:4180`，前端 Vite 开发服默认 `--host`（局域网可访问）。

## 本机浏览器（最常见）

```powershell
# 终端 A
cd backend
npm run dev

# 终端 B（项目根目录）
npm run dev
```

打开：**http://localhost:4173**

API 由 Vite 代理到 `http://localhost:4180`（`VITE_API_PROXY_TARGET` 可改）。

---

## 同一 Wi‑Fi / 局域网（手机、另一台电脑）

1. 查本机 IP：`ipconfig` → 例如 `192.168.1.100`
2. 确保防火墙放行 **4173**（前端）与 **4180**（若直连 API）
3. 启动方式同上（Vite 会打印 `Network: http://192.168.x.x:4173/`）
4. 手机访问：`http://192.168.1.100:4173`

**注意**：Demo 头 `ALLOW_DEMO_USER_HEADER=true` 仅适合开发；局域网测试勿暴露到公网。

若 API 与前端不同机，在根目录 `.env.development` 设置：

```env
VITE_API_PROXY_TARGET=http://192.168.1.100:4180
```

或构建时指定 API 根：

```env
VITE_API_BASE=http://192.168.1.100:4180/api
```

---

## 临时公网链接（内网穿透）

适合给同事/测试员远程试用，**不要用于生产数据**。

| 工具 | 用法概要 |
|------|----------|
| [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) | `cloudflared tunnel --url http://localhost:4173` |
| [ngrok](https://ngrok.com/) | `ngrok http 4173` |
| [Tailscale Funnel / Serve](https://tailscale.com/kb/1242/tailscale-serve) | 零配置 VPN + HTTPS |

穿透后需配置 **CORS**（后端 `CORS_ORIGIN=https://你的隧道域名`）并关闭 demo header。

---

## 预发 / 生产式部署（非 localhost）

| 方式 | 说明 |
|------|------|
| **单 VPS** | `npm run build` → `node server.js --dist` + 反代 nginx；API 同域 `/api` 或子域 |
| **前后端分离** | 静态站 CDN + API 子域；`VITE_API_BASE=https://api.example.com/api`，`CORS_ORIGIN=https://app.example.com` |
| **托管 Postgres** | Supabase / Neon / RDS；`DATABASE_URL` + `npm run db:migrate` |
| **Docker 预发栈** | [STAGING.md](./STAGING.md) — `npm run staging:up` + `staging:smoke` |

健康检查：`/api/health/ready`；指标：`/metrics`（建议内网 + `METRICS_TOKEN`）。

---

## 环境对照

| 场景 | `NODE_ENV` | Demo 头 | 登录 |
|------|------------|---------|------|
| 本地开发 | development | 可开 | Demo UUID 或注册 |
| 局域网 | development | 可开 | 同上 |
| 预发 | production | **关** | 正式 Session |
| 生产 | production | **关** | 正式 Session + CORS |

---

## 相关

- [OPS.md](../OPS.md) — 部署清单
- [SECURITY_EDGE.md](./SECURITY_EDGE.md) — WAF / 密钥
