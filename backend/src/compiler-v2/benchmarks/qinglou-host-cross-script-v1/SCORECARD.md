# 《青楼》Host-only Cross-Script Score

基线：长生叹 Stage 2.5 **FROZEN** · 原样跑 · **不为过关改规则**

## Gate

| 项目 | 结果 | 目标 | 判定 |
|---|---:|---:|---|
| Coverage | **85/85** | 100% | ✅ |
| Knowledge Recall (seed presence) | **15/15** (100%) | ≥90% | ✅ |
| Soft-claim HIT (diagnostic) | **4/15** (27%) | — | NL claims ≠ anyOf |
| Soft-claim HIT+PARTIAL | **15/15** | — | — |
| EVENT VALID | **11/20** (55.0%) | ≥80% | ❌ |
| EVENT OVER_MERGED | **4** | — | — |
| EVENT NOT_EVENT | **5** | — | — |
| EVENT WRONG_FACT | **0** | ≈0 | ✅ |
| 非 EVENT VALID | **6/9** (66.7%) | ≥80% | ❌ |
| 非 EVENT WRONG_TYPE | **3** | — | — |
| 非 EVENT WRONG_FACT | **0** | ≈0 | ✅ |
| Fact validator corruption | **0** | 0 | ✅ |

## Verdict

```json
{
  "crossScriptPromotion": "FAIL",
  "factGrounding": "PASS",
  "coverage": "PASS",
  "next": "V1.2 generic gaps only — not 青楼 overfitting"
}
```

## Generic gaps → V1.2 (do not overfit 青楼 labels)

1. **STATIC_FACT / CLUE_REVEAL ↛ EVENT** (5 examples)
2. **META / INTRO / OUTRO ↛ BRANCH** (3 examples)
3. **EventBoundary multi-center** (4 examples)

## Knowledge detail

| ID | Status | Title |
|---|---|---|
| Q01 | PARTIAL | 莫怀身上发现血迹匕首和泥土 |
| Q03 | PRESENT_WEAK_CLAIMS | 陈一兔的身世与暗恋 |
| Q04 | HIT | 刘青龙威胁柳诗诗 |
| Q09 | PRESENT_WEAK_CLAIMS | 发现三具尸体 |
| Q11 | PRESENT_WEAK_CLAIMS | 莫玄宗遗书揭示身世与秘密 |
| Q12 | PARTIAL | 杜霄元夜潜莫府杀莫寒 |
| Q13 | HIT | 董小婉自杀 |
| Q14 | PARTIAL | 灵石传送至树林 |
| Q18 | HIT | 齐剑心杀害莫玄宗 |
| Q19 | PARTIAL | 众人齐聚玉满楼 |
| Q20 | PRESENT_WEAK_CLAIMS | 姜红儿下毒与刘青龙之死 |
| Q29 | PRESENT_WEAK_CLAIMS | 陈一兔暗算莫寒并得知身世 |
| Q31 | PRESENT_WEAK_CLAIMS | 白斋子夜探莫府目睹莫寒与董小婉 |
| Q32 | PRESENT_WEAK_CLAIMS | 白斋子发现尸体并处理 |
| Q35 | HIT | 尸体身份确认 |
