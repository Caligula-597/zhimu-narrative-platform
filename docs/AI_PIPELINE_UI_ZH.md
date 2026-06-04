# AI 悬疑创作 · UI 与性能说明

> 更新：2026-06-04 · 代码：`src/views/pipeline-wizard.js` · `styles.css` · `src/components/modal.js`

## 验收位置（创作者）

| 项目 | 说明 |
|------|------|
| **视图** | 进入任意世界 → 侧栏 **剧本杀创作中心** |
| **入口** | Hero 区主按钮 **「AI 悬疑创作」** |
| **弹窗** | 全屏三栏：顶栏 / 左栏深绿导航 / 右栏编辑 / 底栏上传 |
| **Tab** | **分步参与**（人机协作）· **一键串行**（②～⑥ 自动 AI，须先确认规格） |

## 层级流程

| 层 | 名称 | 交互 |
|----|------|------|
| ① | 规格 | **手动填写**（brief 预填），无 AI；点「确认规格并继续」 |
| ② | 总纲 | AI 生成 → 编辑 → 确认 |
| ③ | 编排结构 | 同左（原「结构提案」） |
| ④ | 角色矩阵 | 同左 |
| ⑤ | 私人分幕 | 按角色×章节逐段生成/确认 |
| ⑥ | 短母稿 | 可选 |
| ⑦ | 评判 | 可选；`promptHint` 可追加到 brief「限制」 |

草稿仅存 **localStorage**（`zhimuAiDraft:*:pipeline`），点「上传全部到云端」才写入 PostgreSQL。

## 布局尺寸

- 弹窗宽：`min(1360px, 100vw - 40px)`（须 `.modal.pipeline-wizard-modal` 在 `.modal` 基础规则**之后**）
- 弹窗高：`calc(100vh - 32px)`
- 左栏：固定 **220px**；右栏：剩余宽度
- 打开弹窗时 **锁定页面滚动**；滚轮优先作用于编辑区/左栏列表

## 性能优化（已实现）

| 机制 | 说明 |
|------|------|
| localStorage 防抖 | 450ms；内容未变时跳过 stringify |
| rAF 合并渲染 | 同帧多次 `renderPipelineUi` 只绘一次 |
| 编辑区版本缓存 | 同层同版本不重建 DOM（保存时不闪屏） |
| 左栏增量更新 | 仅状态变时重建；换选中层只改 class |
| 分幕层 patch | 切换角色/章节时只更新字段与 chip 列表 |
| 编排层折叠 | 章节/场景 >4 时默认折叠 `<details>` |
| 事件委托 | 左栏/按钮只绑一次 |
| 遮罩无 blur | 去掉 `backdrop-filter`，减轻 GPU 压力 |
| DeepSeek 超时 | 前端 pipeline 请求 120s/步 |

## 本地验证

```powershell
# 终端 A
cd backend
npm run dev

# 终端 B（项目根）
npm run dev
# 打开 http://localhost:4173 → 创作中心 → AI 悬疑创作
# 硬刷新 Ctrl+F5
```

```bash
cd backend
npm test -- test/deepseek-pipeline.test.js
npm run test:deepseek-pipeline   # 需 DEEPSEEK_API_KEY
```

## 相关文档

- [PROMPT_ENGINEERING.md](./PROMPT_ENGINEERING.md) — API 层级与 prompt
- [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md) — 产品总览
- `.cursor/rules/ui-location-for-testing.mdc` — 新功能须标注 UI 位置
