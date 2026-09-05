# P8.0B — Representative Corpus（GEN-01～GEN-08）

> Matrix：`docs/P8_0A_GENERALIZATION_TEST_MATRIX_ZH.md`  
> 本刀：**正式定稿 8 本输入 fixture + runner + Machine Gate 接线**；不改 Expander / Integrator 生产逻辑。  
> A–H：仅 regression；**不得**冒充本 corpus。

## 状态

```text
P8.0A Matrix                         ✅ FROZEN
P8.0B Representative Corpus          ✅
P8.0C Machine Gate Wiring            ✅（含假绿/假红修补）
P8.0D Editorial Audit                ✅ 完成
P8.0 Final Verdict                   ✅ 见 docs/P8_0_GENERALIZATION_AUDIT_VERDICT_ZH.md
                                     Universal Pipeline ❌ 未通过
```

## 代表案

| ID | 样本 | 人数 | 幕 | 结构核心 | GAME | 主要 Gate |
|---|---|---:|---:|---|---|---|
| GEN-01 | 《雨夜公寓》 | 5 | 3 | 现代封闭推凶 · 单中心 | 无 | 少人短幕 |
| GEN-02 | 《长安夜宴》 | 6 | 5 | 古风双阵营 · 临时联盟 | 单 M09 | 五幕非废幕 |
| GEN-03 | 《赫利俄斯站》 | 7 | 4 | 科幻身份权限 · 双中心 | 单 M03 | 非古风 |
| GEN-04 | 《毕业照之后》 | 8 | 5 | 校园群像 · 无主凶案 | 无 | 无 killer 也成立 |
| GEN-05 | 《零点拍卖会》 | 6 | 4 | 强玩法弱推理 | M03×2+M09 | 多 placement |
| GEN-06 | 《两封没有寄出的信》 | 5 | 4 | 双线低亲和 | 无 | KEEP_PARALLEL |
| GEN-07 | 《王座之下》 | 7 | 5 | 高交织 · 高负载 | M03+M09 | Projection V2 |
| GEN-08 | 《停电之前》 | 6 | 3 | 公共任务 + 条件开放 | 单 M03 | 同场不伪因果 |

## 路径

```text
shared/p8-generalization-cases/GEN-0x-*.json   ← 输入（ProjectStoryState / storyPlan）
captures/p8-generalization/GEN-0x/            ← 生成物
docs/P8_0_MULTI_SCRIPT_GENERALIZATION_REPORT_ZH.md
scripts/p8-generalization-audit.mjs
scripts/p8-generalization.test.mjs
shared/p8-generalization-runner.js
```

## 流水线

```text
fixture (accepted STORY plan)
→ ProjectStoryState
→ Integrator → MasterOutlineDraft
→ ProductionMasterDraft V2
→ G1/G2/G3 Machine Gates
```

**禁止**把 PMD V2 写死成测试输入。  
**禁止**为过 Gate 偷偷生成 CompleteScriptPackage。

## 命令

```bash
npm run test:p8-generalization
npm run audit:p8-generalization
```

与 `npm run verify:playable` **分离**（P7 Runtime vs P8 泛化）。

## Editorial 失败分类

| class | 含义 | 解冻？ |
|---|---|---|
| CONTRACT_FAILURE | 合同装不下 | 可触发 Expander 解冻 |
| GENERATION_FAILURE | 合同能装，生成差 | 修生成规则 |
| CONTENT_QUALITY_FAILURE | 结构对但不好看 | 不解冻；留给 Full Script |
