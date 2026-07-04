# 待审核示例剧本（本地）

本目录存放**尚未进入公开剧本库**的矩阵瀑布流示例，供产品/文学审核后再导入世界或替换官方示例。

---

## ⏸ 当前状态：暂停迭代

| 项 | 说明 |
|---|---|
| 状态 | **暂停** — 不再跑生成/改 prompt，直至 Beta 主线其它项推进或明确重启 |
| 优先级 | 🔴 **高** — 恢复清单见 [`docs/MATRIX_PILOT_BACKLOG.md`](../../docs/MATRIX_PILOT_BACKLOG.md) |
| 最新代 | Gen5 · `matrix-v5-structured-log` · overall **6.5**（未达进库门槛） |

---

## 目录

| 目录 | 状态 | 说明 |
|------|------|------|
| [雾港回声](./雾港回声/) | `pending_review` · **暂停** | v5 structured-log（三通道默认） |
| [雾港回声/ISSUES.md](./雾港回声/ISSUES.md) | 清单 | Gen5 问题 + Gen5.1 恢复项 |
| [雾港回声-对比基准](./雾港回声-对比基准/) | `archived` | 第一代（初版 prompt），仅供对比 |
| [三代问题反馈](./雾港回声-三代生成问题反馈.md) | 文档 | 跨代评分、根因与架构演进 |

**审核入口**（雾港回声，只读参考）：

- 上帝视角真相 → `雾港回声/truth/TRUTH-god-view.md`
- **连续代入阅读** → `雾港回声/scripts-by-role/*-连贯本.md`
- 主持手册 → `雾港回声/truth/HOST-runbook.md`
- 全员任务 → `雾港回声/tasks/TASKS-all-roles.md`
- 玩家私人本 → `雾港回声/scripts/*.md`（每文件含「本幕任务」）

**不会**自动写入 `OFFICIAL_EXAMPLE_WORLD_ID` 或平台公开目录。

重新生成（**暂停期请勿执行**，恢复见 backlog）：

```bash
node backend/scripts/generate-matrix-pilot-example.mjs
```

离线 curated 版本（无 API）：

```bash
node backend/scripts/generate-matrix-pilot-example.mjs --offline
```
