# 域名安全扫描处理清单

> 目标域名：`getzhimu.com`。用于处理安全扫描中的 DMARC、security.txt、AI crawler、Bot Fight Mode 等域名级项目。

## 已纳入仓库发布的项目

| 项目 | 文件 | 生效方式 |
| --- | --- | --- |
| security.txt | `site/public/.well-known/security.txt` | 官网 Cloudflare Pages 发布后，访问 `https://getzhimu.com/.well-known/security.txt` |
| robots.txt / AI crawler 策略 | `site/public/robots.txt` | 官网 Cloudflare Pages 发布后，阻止常见 AI 训练/抓取 crawler |
| sitemap | `site/public/sitemap.xml` | 官网 Cloudflare Pages 发布后供搜索引擎发现公开页 |
| 玩家端 robots | `play/public/robots.txt` | 玩家端是运行入口，不进入搜索索引 |
| 主持端 robots | `host/public/robots.txt` | 主持端是运行入口，不进入搜索索引 |

## DNS / Cloudflare 项目

DMARC 当前必须是可执行策略，扫描器通常不接受 `p=none`：

```txt
_dmarc.getzhimu.com TXT "v=DMARC1; p=quarantine; pct=100; adkim=s; aspf=s; rua=mailto:support@getzhimu.com; fo=1"
_dmarc.mail.getzhimu.com TXT "v=DMARC1; p=quarantine; pct=100; adkim=s; aspf=s; rua=mailto:support@getzhimu.com; fo=1"
```

可用脚本同步：

```powershell
npm run cloudflare:sync-security -- --bot-fight
```

`--bot-fight` 会尝试通过 Cloudflare API 开启 Bot Fight Mode；如果当前套餐或 token 权限不支持，需要在 Cloudflare 控制台手动进入 **Security -> Bots** 开启。

## 自检命令

本地文件 + DNS：

```powershell
npm run domain:security
```

线上发布后再跑：

```powershell
npm run domain:security -- --live
```

线上检查依赖 Cloudflare Pages 已完成发布；刚提交代码但 GitHub Actions 尚未部署完成时，`--live` 可能仍会看到旧版本。
