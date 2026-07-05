# 矩阵提示词 · 多方位测试计划（Gen5.1 重启）

> **状态**：🟢 **进行中**（2026-07-04）  
> **示例剧本**：《雾港回声》`examples/pending-review/雾港回声/`  
> **promptVersion**：`matrix-v5.1-structured-log`

---

## 1. 测试分层（四个方向）

| 方向 | 测什么 | 命令 | 通过标准 |
|------|--------|------|----------|
| **A. 机械门禁** | feelings / action / dialogue 纯函数 | `npm run test:matrix-structured --prefix backend` | 全绿 |
| **B. 提示词引擎** | spoilerContract、clueLedger、roster | `npm run test:matrix-prompts --prefix backend` | 全绿 |
| **C. 单层 API** | truth → characters → matrix → 单格 script | `node backend/scripts/matrix-layer-smoke.mjs --layer script --role role-3 --act ch2` | 无 throw；gates.passed |
| **D. 全链路 pilot** | 12 格 + evaluate | `npm run generate:matrix-pilot` | 见 §2 验收 |

**原则**：A/B 每次改 prompt 必跑；C 改单层 prompt 时跑；D 每日/里程碑最多 1 次（DeepSeek 成本）。

---

## 2. Gen5.1 验收目标

| 维度 | Gen5 | Gen5.1 目标 |
|------|------|-------------|
| overallScore | 6.5 | **≥ 7.5** |
| spoilerSafety | 5 | **≥ 8** |
| fairness | 5 | **≥ 7** |
| readyForSync | false | **true**（人工仍须审） |

**硬门禁（机械，不依赖 LLM 评判）**

- 凶手 ch1/ch2 feelings **无** 复仇/恐惧/销毁/细线/门闩
- 凶手 ch1/ch2 action **无** 细线/门闩/钥匙胚/旋转开关/暗格
- dialogue 通道 **无** 心里/感到/清楚
- persona bleed **通过**
- `structured` 字段写入 `06-scripts/*.json`

---

## 3. 改 prompt 时的检查清单

1. 改 `backend/src/prompts/matrix-*.js` 或 `pipeline-matrix-structured-script.js`
2. `npm run test:matrix-structured --prefix backend`
3. 若动 spoilerContract / matrix engine → `npm run test:matrix-prompts --prefix backend`
4. 单层冒烟（可选）→ 全链路 `generate:matrix-pilot`
5. 更新 `examples/pending-review/雾港回声/ISSUES.md` + `雾港回声-三代生成问题反馈.md` §13

---

## 4. 相关文件

| 文件 | 说明 |
|------|------|
| `docs/MATRIX_PILOT_BACKLOG.md` | 暂停/恢复总览 |
| `backend/src/pipeline-matrix-structured-script.js` | Gen5.1 三通道门禁 |
| `backend/scripts/generate-matrix-pilot-example.mjs` | 全链路生成 |
| `backend/scripts/matrix-layer-smoke.mjs` | 单层 API 冒烟 |
