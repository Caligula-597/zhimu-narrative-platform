# 矩阵瀑布流示例剧本 · 进行中（Gen5.1）

> **状态**：🟡 **整理中**（2026-07-04）— 剧情产物已清空，仅保留提示词/打分文档；暂停继续改 prompt 与全量生成。  
> **测试计划**：[MATRIX_PROMPT_TEST_PLAN_ZH.md](./MATRIX_PROMPT_TEST_PLAN_ZH.md)  
> **promptVersion**：`matrix-v5.1-structured-log`

---

## 暂停原因（历史）

五代生成（v1→v5）overall 均 **6.5**，spoilerSafety / fairness 未突破 **5**。Beta-0 运营线 A 完成后恢复 Gen5.1 工程。

---

## Gen5 基线（对比用）

| 项 | 值 |
|---|---|
| promptVersion | `matrix-v5-structured-log` |
| 评分 | overall 6.5 · spoiler 5 · fairness 5 |
| 产出目录 | `examples/pending-review/雾港回声/` |

---

## Gen5.1 已落地（2026-07-04）

1. ✅ `fillFeelingPack` 凶手位 neutral 模板 + leak 过滤  
2. ✅ `scanActionCrimeTokens` + `stripCrimeTokensFromAction`  
3. ✅ dialogue 通道 `stripPsychologyFromAction`  
4. ✅ `sanitizeMatrixRowForStructured` 凶手 tasks  
5. ✅ `validateMatrixPlayerScript` 保留 `structured`  
6. ✅ evaluate corpus 含 structured 摘要  
7. ✅ 通道 minWords 门禁（applyStructuredGates.channelLength）  

---

## 验收目标

spoilerSafety ≥ 8 · fairness ≥ 7 · overall ≥ 7.5 · `readyForSync: true`

```bash
npm run test:matrix-structured --prefix backend
npm run test:matrix-prompts --prefix backend
npm run smoke:matrix-layer -- --layer script --role role-3 --act ch2
npm run generate:matrix-pilot
```

---

## 相关代码

| 模块 | 说明 |
|------|------|
| `backend/src/pipeline-matrix-structured-script.js` | Gen5.1 三通道主逻辑 |
| `backend/src/prompts/matrix-structured-script.js` | action / dialogue prompt |
| `backend/test/pipeline-matrix-structured-script.test.js` | 门禁单测 |
