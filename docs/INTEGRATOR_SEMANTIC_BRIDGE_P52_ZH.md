# P5.2 Integrator Semantic Bridge V1

> 修复 P5.1 Product Trial 暴露的缺口：**Block 缺 Goal/Action 语义 + Weave 过松**。  
> 不进入 P6，不新增 STORY 家族，不重构 Integrator 总架构，不引入 LLM。

## 结论（程序 Gate）

| 检查 | DEV A–E |
|---|---|
| 中间空幕 = 0 | PASS |
| INTERWOVEN 不得仅由 shared scene/char 支撑 | PASS |
| 每案 ≥2 goal-driven beats | PASS |
| Case E 出现 KEEP_PARALLEL | PASS |

人工均分仍需审阅填写：`captures/integrator-product-trial-v1/SCORECARD.md`  
Held-out F–H：`captures/integrator-product-trial-p52-heldout/`

## 改了什么

1. **`BeatSemantics`**（`shared/story-beat-semantics.js`）  
   actorRefs / goal / action / target / requires / produces / opposes / protects / actionKind / locationHint / independence

2. **COMPLETE 数据桥**（`shared/complete-beat-semantics-data.js`）  
   仅 M01-FRAMING + M07×8 + M08×8；挂到 template.semanticsBridge

3. **Engine** 生成 beat 时解析语义，用户可见摘要优先「谁为了什么做什么」；禁止「××阶段完成」进母稿

4. **Weave** 默认 `KEEP_PARALLEL`；仅凭语义证据升级：  
   - CAUSAL / STRONG / SHARED_ACTION → `relationQuality: INTERWOVEN`  
   - SHARED_SCENE / SHARED_CHARACTER → `COLOCATED`（不算真正交织）

5. **Stage planner** 压缩空中间阶段；弧线标签 铺垫→加压→升级→收束

6. **UI** 显示真正交织 / 同场并列 / 保持平行 + WHY

## 纪律

- A–E = DEV/regression（禁止 Case ID 特判）
- F–H = held-out（冻结后一次跑）
- 禁止：P6、LLM 整本、M10/M11、STORY runtime、GAME、世界域、Canon

## 跑法

```bash
node --test scripts/master-outline-integrator.test.mjs
node scripts/integrator-product-trial.mjs
```
