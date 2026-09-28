# 青楼跨剧本诊断（V1.2 输入 · 禁止用本集磨指标）

## 结论

冻结版 Canon Compiler V1 **未通过**《青楼》Host-only Precision 门槛。  
但 **WRONG_FACT = 0**（EVENT / non-EVENT），说明问题主要是 **分类边界 / 粒度**，不是换剧本后幻觉。

| 层 | 判定 |
|---|---|
| Read / Coverage / Cache | ✅ 85/85 |
| 事实 grounding | ✅ WRONG_FACT 0 · Fact validator 0 |
| Knowledge presence（15 Gold） | ✅ 15/15 |
| 跨剧本 Promotion | ❌ EVENT 55% · non-EVENT 66.7% |
| Event granularity | ⚠️ OVER_MERGED 4/20 |

## 三类通用缺口（仅这些进 V1.2）

1. **STATIC_FACT / CLUE_REVEAL ↛ EVENT**  
   例：尸体身份确认 → REVEAL；素颜无法分辨 → 静态事实，勿升 EVENT。

2. **META / INTRO / OUTRO ↛ BRANCH**  
   例：剧本简介、开本规则介绍、结局彩蛋/续作预告 → META，勿升 BRANCH。

3. **EventBoundary 多行动中心**  
   例：姜红儿下毒 + 追问身世 + 杀人藏尸 仍被压成一条。

## 明确不做

- 不把这 29 条标到 29/29  
- 不改《长生叹》已冻结规则去「救」青楼单点  
- 确认通用后再 V1.2，然后第三剧本 smoke

## 产物

- 分数：`captures/compiler-v2-trial/qinglou-host-canon-v1/score/`
- 冻结标签：`backend/src/compiler-v2/benchmarks/qinglou-host-cross-script-v1/`
- 复算：`node backend/scripts/compiler-v2-qinglou-host-canon-score.mjs`
