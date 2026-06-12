# AI 悬疑创作 · UI 与验收说明

> 更新：2026-06-03 · 叙事优先流水线 · 代码见 `src/views/pipeline-wizard-*.js`

## 验收位置

| 项目 | 说明 |
|------|------|
| **视图** | 任意世界 → 侧栏 **剧本杀创作中心** |
| **入口** | Hero **「AI 悬疑创作」** |
| **弹窗** | 全屏：顶栏 / 左栏层级导航 / 右栏编辑 / 底栏上传 |
| **模式** | **分步参与** · **一键串行**（须先确认①创作设定） |

## 层级流程（与后端一一对应）

| 层 | 名称 | 用户操作 | 前端 API |
|----|------|----------|----------|
| ① | 创作设定 | **仅填 5 项**，无 AI | — |
| ② | 总纲 | AI → 编辑 → 确认 | `deepseekPipelineOutline` |
| ③ | 章节总剧情 | **逐章** AI（第2章读第1章全文） | `deepseekPipelineNarrativeChapter` |
| ④ | 角色矩阵 | AI → 确认 | `deepseekPipelineRoleMatrix` |
| ⑤ | 私人分幕 | **一次** AI 拆分全部角色 | `deepseekPipelineNarrativeRoles` |
| ⑥ | 编排结构 | AI **反推**场景/线索 | `deepseekPipelineNarrativeExtractStructure` |
| ⑦ | 短母稿 | 可选 | `deepseekPipelineManuscriptSynopsis` |
| ⑧ | 评判 | 可选；提示追加到「矛盾冲突」 | `deepseekPipelineEvaluate` |

上传：**仅上传编排** 或 **上传全部到云端** → `importDeepseekProposal` / `importDeepseekPipeline`。

## ① 创作设定（唯一的手动表单）

| 字段 | 校验 |
|------|------|
| 主题 | 必填 |
| 剧情纲要 | 必填 |
| 章节数量 | 3～5 |
| 每章节字数 | 400～2500 |
| 额外的矛盾冲突 | 选填 |

左侧 **不再有** 独立 brief 折叠面板；所有输入集中在①层编辑区。

玩家人数、场景数、线索数等由 `pipeline-wizard-brief.js` 自动推导后写入 `spec` 传给后端。

## Session 数据结构（localStorage 草稿）

| 字段 | 层 |
|------|-----|
| `spec` | ① |
| `outline` | ② |
| `narrativeChapters` | ③ |
| `roleMatrix` | ④ |
| `sections` | ⑤ |
| `proposal` | ⑥ |
| `synopsis` | ⑦ |
| `evaluation` | ⑧ |
| `locks` | 各层确认状态 |

草稿 key：`zhimuAiDraft:{worldId}:pipeline`。

## 前端模块分工

| 文件 | 职责 |
|------|------|
| `pipeline-wizard-session.js` | 层级顺序、依赖、锁定、下游清空 |
| `pipeline-wizard-brief.js` | 五字段 → brief/spec |
| `pipeline-wizard-html.js` | 各层编辑器 HTML |
| `pipeline-wizard-dom.js` | DOM ↔ session |
| `pipeline-wizard-open.js` | 打开向导、调 API、一键串行 |
| `pipeline-wizard.js` | 薄入口 |
| `src/api/client.js` | HTTP 客户端 |

## 布局与性能

- 弹窗：`min(1360px, 100vw - 40px)` × `calc(100vh - 32px)`
- 左栏 220px；localStorage 防抖 450ms；rAF 合并渲染
- ③ 换章 / ⑤ 换角色：patch 更新，不全量重建 DOM
- DeepSeek 请求超时：**180s**（客户端）

## 本地验证

```powershell
# 终端 A
cd backend
npm run dev

# 终端 B（项目根）
npm run dev
# http://localhost:4173 → 创作中心 → AI 悬疑创作 → Ctrl+F5
```

```bash
cd backend
npm test -- test/deepseek-pipeline.test.js
node --test scripts/pipeline-wizard-session.test.mjs
```

## 相关文档

- [PROMPT_ENGINEERING.md](./PROMPT_ENGINEERING.md) — API 与 brief/spec 映射
- [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md) — 产品总览
