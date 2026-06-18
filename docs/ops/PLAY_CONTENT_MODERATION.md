# 玩家广场 / 私信内容审核

广场发帖、评论与好友私信在写入数据库前会经过 **内容审核**（剧本内分幕、线索等游戏内容 **不在此范围**）。

## 拦截规则

1. **违禁词**：`backend/config/play-content-blocklist.json` → `forbiddenTerms`
2. **广告词**：同文件 → `adTerms`
3. **广告形态**（内置正则，无需配置）：
   - HTTP/HTTPS、常见域名后缀
   - 手机号、QQ、邮箱、微信号引流写法
   - 「加微信 / 扫码 / 微商 / 兼职日结」等拆字规避

命中广告规则返回 `PLAY_CONTENT_AD`（422）；命中违禁词返回 `PLAY_CONTENT_FORBIDDEN`（422）。

## 运维追加词条

Railway / 生产环境可通过环境变量追加，无需改代码：

```bash
PLAY_CONTENT_EXTRA_BLOCK_TERMS=词条甲,词条乙,词条丙
```

自定义词库文件路径（可选）：

```bash
PLAY_CONTENT_BLOCKLIST_PATH=/path/to/blocklist.json
```

JSON 格式与仓库内默认文件相同，需包含 `forbiddenTerms` 与 `adTerms` 数组。

## 修改默认词库

1. 编辑 `backend/config/play-content-blocklist.json`
2. 部署后端
3. 本地可跑 `node --test backend/test/play-content-moderation.test.js` 验证

## 相关代码

- `backend/src/play-content-moderation.js` — 归一化 + 扫描
- `backend/src/play-plaza-service.js` — 帖子 / 评论
- `backend/src/play-social-service.js` — 私信
