# 雾港回声（待审核示例）

> **状态**：`pending_review` — 仅供团队本地审核，**未**进入公开剧本库（`OFFICIAL_EXAMPLE_WORLD_ID`）。

## 文件说明

| 文件 | 用途 |
|------|------|
| `manifest.json` | 元数据与审核状态 |
| `session.json` | 完整矩阵瀑布流 session（可回填 AI 向导草稿） |
| `import-package.json` | `buildPipelineImportPackage` 输出，审核通过后用于 `importDeepseekPipeline` |
| `layers/` | 分层 JSON（真相 / 角色 / 矩阵 / 主持 / 剧本） |
| `scripts/*.md` | 人类可读的逐幕私人本 |

## 审核通过后如何入库

1. 本地启动栈，进入目标世界的「AI 剧本创作」或调用 `POST .../deepseek/pipeline/import`
2. 使用 `import-package.json` 作为请求体（或从 `session.json` 在向导 ⑧ 步确认后上传）
3. **不要**修改 `OFFICIAL_EXAMPLE_WORLD_ID`，除非产品确认替换官方示例

## 生成方式

- 来源：`deepseek-matrix-pipeline`
- 架构：矩阵瀑布流 8 步（见 commit 9b777c9 后 wizard）

生成命令：

```bash
node backend/scripts/generate-matrix-pilot-example.mjs          # DeepSeek 在线
node backend/scripts/generate-matrix-pilot-example.mjs --offline  # 本地 curated fixture
```
