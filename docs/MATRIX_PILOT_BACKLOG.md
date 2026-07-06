# 矩阵瀑布流示例剧本 · 进行中（Gen5.1 / Matrix 2.0）

> **状态**：🟡 **内容 backlog**（2026-07-06）— 不阻塞 Beta 主线；工程与机械门禁已进 main。  
> **测试计划**：[MATRIX_PROMPT_TEST_PLAN_ZH.md](./MATRIX_PROMPT_TEST_PLAN_ZH.md)  
> **promptVersion**：`matrix-v5.1-structured-log` / `matrix-2.0`

---

## 当前事实（2026-07-06）

| 剧本 | 机械门禁 | LLM 文学分 | 备注 |
|---|---|---|---|
| 雾港回声 | 12/12 · 100% | Gen5 基线 overall **6.5** · spoiler/fairness **5**；Matrix 2.0 后 **未复评** | 工程修正已落地 |
| 停雪公馆 | 18/18 · 100% | evaluation **7.8** | import 试点；内容未 push |

**结论**：6.5/5/5 为 **历史 LLM 基线**，不代表当前 mechanical 状态；文学质量需 LLM 复评后再作对外示例。

---

## 暂停原因（历史 · Gen5）

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
