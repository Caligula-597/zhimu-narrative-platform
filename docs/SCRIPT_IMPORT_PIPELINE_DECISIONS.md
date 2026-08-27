# 剧本导入流水线 — 决策记录

本文记录全流程实现中的关键转折点与已选方案。日期：2026-08-22。

## D1 · 来源稿存储

| 选项 | 说明 |
|------|------|
| A. 仅 `story_manuscripts` | 与可编辑母稿混用，易误覆盖 |
| B. `settings.importSource` + 条件更新母稿 | **已选** |

**决策**：结构化导入时写入 `settings.importSource`（不可变快照元数据 + 全文），并仅在母稿未处于 `manual` / `manuscript_to_graph` 时同步 `story_manuscripts`（`last_sync_direction = import_source`）。

**节点**：`upsertImportSourceSnapshot` · `creator-document-structure-service` 导入末尾。

## D2 · 双视图入口

| 选项 | 说明 |
|------|------|
| A. 塞入文档导入弹窗 | 导入后关闭，难持续对照 |
| B. 独立视图 `importSource` | **已选** |

**决策**：新增「来源稿与已拆模块」视图；结构化导入成功后自动跳转；驾驶舱「肌肤的裁剪」提供上传 / 补齐双入口。

## D3 · 主持手册产品位

| 选项 | 说明 |
|------|------|
| A. 仅 Segment 薄 runbook | 主持端信息不足 |
| B. `settings.hostHandbook.manuscript` 全文 + 谜底页 Tab | **已选** |

**决策**：导入时 `extractHostHandbookManuscript` 机械提取；创作者在「谜底与关系 → 主持手册全文」编辑；主持端 `host-layout` 在 runbook 区展示全文（只读）。

Segment 分幕 runbook 保留，后续可再按幕切片。

## D4 · 上传质检

| 环境 | 行为 |
|------|------|
| 本地开发 | `heuristic`：`prose-quality-gate` + 文案「本地通读完成」 |
| 生产 | 配置 DeepSeek 且未 `CREATOR_DOCUMENT_AI_REVIEW=off` 时走 AI；否则回退 heuristic |

**决策**：解析 API 附加 `aiDocumentReview`，与既有 `proseDiagnostics` 并列展示，不阻断导入（与 prose gate 复核勾选独立）。

## D5 · 模块编辑联动

| 选项 | 说明 |
|------|------|
| A. 自动改写关联节点 | 风险高、难审计 |
| B. 影响预览 + 二次确认保存 | **已选** |

**决策**：`GET .../clues/:id/edit-impact` 返回调查点、图谱边、伏笔、剧情段；线索编辑器在正文变更时两次点击保存（armed 确认）。

## D6 · 三端边界（维持）

- 创作者：`4173` · 主持：`5175` · 玩家：`5174`
- 创作者 `director` 仅跳转主持 URL，不在玩家应用内嵌主持台
- `settings.hostRunbooks` / `matrixSync.hostRunbooks` 仅作 Segment runbook 缺失时的 legacy 回退，不删

## D7 · 开本包上传向导（2026-08-22）

| 选项 | 说明 |
|------|------|
| A. 仅单 docx 智能拆稿 | 适合结构规范合稿 |
| B. 分槽位多文件引导 | **已选** |

**决策**：新增 6 步「开本包上传向导」— 主持手册（必传）、角色剧本（多 docx/zip）、线索文字 docx（可选）、线索图片 jpg/png（可选）→ 预览 → 一次性写入。API：`POST .../opening-package/preview` · `POST .../opening-package/commit`。单 docx「文档解析」保留为高级路径。


- 按幕从 `manuscript` 自动切分 host runbook
- 分幕 PATCH 级联与 script_section 影响 API
- 生产环境 E2E：上传 → 质检 → 拆稿 → 主持端读全文
