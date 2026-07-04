# 雾港回声（待审核示例）

> **状态**：`pending_review` — 仅供团队本地审核，**未**进入公开剧本库（`OFFICIAL_EXAMPLE_WORLD_ID`）。

## 文件说明

| 文件 | 用途 |
|------|------|
| `manifest.json` | 元数据与审核状态 |
| `session.json` | 完整矩阵瀑布流 session（可回填 AI 向导草稿） |
| `import-package.json` | `buildPipelineImportPackage` 输出，审核通过后用于 `importDeepseekPipeline` |
| `truth/TRUTH-god-view.md` | **上帝视角**真相总览（时间线/凶手/误导/剧透门禁） |
| `truth/HOST-runbook.md` | 主持分幕流程 + 每幕 hostTruth |
| `tasks/TASKS-all-roles.md` | 全员分幕任务一览 |
| `layers/02-truth-bible.json` | 真相 Bible 结构化源数据 |
| `layers/05-host-runbooks.json` | 主持手册 JSON 源数据 |
| `scripts-by-role/*-连贯本.md` | **同角色 ch1→ch3 串联**（demo 连续阅读） |
| `scripts/*.md` | 单幕私人本（正文 + 末尾任务） |

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
