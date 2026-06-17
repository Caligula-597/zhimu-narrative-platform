# 云端免费版接入清单

> **注意**：生产部署见 [docs/ops/SPLIT_DOMAINS.md](./docs/ops/SPLIT_DOMAINS.md) · [docs/ops/MANUAL_SETUP_CHECKLIST.md](./docs/ops/MANUAL_SETUP_CHECKLIST.md) · [docs/ops/MONITORING_SETUP.md](./docs/ops/MONITORING_SETUP.md)。

代码端已经完成 PostgreSQL 和 Cloudflare R2 的接口。以下步骤需要由云账号持有人在控制台完成。

## 1. 创建 Supabase 免费项目

1. 注册或登录 Supabase。
2. 创建一个 Free 项目。
3. 选择离主要测试用户较近的区域。
4. 保存数据库密码。
5. 在项目控制台复制 PostgreSQL Connection String。
6. 将连接地址填写到 `backend/.env` 的 `DATABASE_URL`。
7. 如果连接地址要求 TLS，将 `DATABASE_SSL=true`。

需要提供给代码的值：

```text
DATABASE_URL=
DATABASE_SSL=true
```

注意：

- 不要把数据库密码提交到 Git。
- `backend/.env` 已被 `.gitignore` 排除。
- 免费项目可能因长期不活跃暂停，Alpha 阶段需要定期检查。

## 2. 创建 Cloudflare R2 存储桶

1. 注册或登录 Cloudflare。
2. 进入 R2 Object Storage。
3. 创建私有 Bucket，例如 `zhimu-assets-alpha`。
4. 不要启用公开访问。
5. 创建 R2 API Token。
6. Token 权限只授予这个 Bucket 的 Object Read & Write。
7. 保存 Account ID、Access Key ID 和 Secret Access Key。
8. 将这些值填写到 `backend/.env`。

需要提供给代码的值：

```text
OBJECT_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=zhimu-assets-alpha
```

注意：

- Secret Access Key 只会存在于后端环境变量。
- 不要把永久密钥交给浏览器。
- 不要把 Bucket 改成公开桶。
- 当前下载 URL 默认 5 分钟有效，上传 URL 默认 10 分钟有效。

## 3. 创建本地环境文件

在 `backend/` 中运行：

```powershell
Copy-Item .env.example .env
```

然后只编辑 `.env`，不要编辑 `.env.example` 中的空值为真实密钥。

## 4. 初始化云数据库

填写 `.env` 后运行：

```powershell
cd D:\长剧情\backend
npm run db:migrate
npm run db:seed
npm run start
```

检查：

```text
http://localhost:4180/api/health
```

## 5. 设置定时清理任务

软删除附件会进入 14 天回收站。正式部署后，每天运行一次：

```powershell
npm run assets:purge
npm run assets:cleanup-uploads
```

云服务器上应使用计划任务或 Cron 执行。

## 6. 免费账号默认限制

当前代码默认：

| 项目 | 限制 |
|---|---:|
| 单账号附件总量 | 500 MB |
| 单账号世界数量 | 2 |
| 单图片 | 10 MB |
| 单音频 | 30 MB |
| 单 PDF / Word | 20 MB |
| 上传 URL 有效期 | 10 分钟 |
| 下载 URL 有效期 | 5 分钟 |
| 回收站保留期 | 14 天 |

## 7. 上线前仍需完成

- 正式登录和 Session，替换开发阶段的 `x-user-id`。
- 对上传对象执行病毒扫描或安全扫描。
- 为上传 API 增加 IP 和账号频率限制。
- 增加每日数据库备份任务。
- 将数据库备份加密后保存到独立 Bucket 或其他云。
- 记录管理员访问和素材下载审计。
- 配置费用与容量告警。
- 根据中国大陆访问测试决定是否增加腾讯云 COS 适配器。
