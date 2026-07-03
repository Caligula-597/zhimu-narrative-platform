# 待审核示例剧本（本地）

本目录存放**尚未进入公开剧本库**的矩阵瀑布流示例，供产品/文学审核后再导入世界或替换官方示例。

| 目录 | 状态 | 说明 |
|------|------|------|
| [雾港回声](./雾港回声/) | `pending_review` | 4 人 · 3 幕 · demo 档；DeepSeek 矩阵流水线生成 |

**不会**自动写入 `OFFICIAL_EXAMPLE_WORLD_ID` 或平台公开目录。

重新生成：

```bash
node backend/scripts/generate-matrix-pilot-example.mjs
```

离线 curated 版本（无 API）：

```bash
node backend/scripts/generate-matrix-pilot-example.mjs --offline
```
