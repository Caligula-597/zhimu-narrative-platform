# 第三剧本 Smoke 协议（V1.2 后 · True Recall）

## 原则

1. **先**从 HOST 原文人工选 10 个关键知识点（**compile 前**）
2. **再**跑冻结的 Canon Compiler V1.2（不为过关改规则）
3. Gold **禁止**从本轮 compile stub 反挑（那是 seed presence，不是 true recall）

## 规模（刻意小）

| 集 | 数量 |
|---|---|
| Independent HOST Gold | 10（pre-compile） |
| EVENT 抽样 | 10 |
| Non-event 抽样 | 5 |

## 门槛

| 指标 | 目标 |
|---|---|
| Coverage | 100% |
| **True** Knowledge Recall | ≥90% |
| EVENT VALID | ≥80% |
| Non-event VALID | ≥80% |
| WRONG_FACT | ≈0 |
| Fact corruption | 0 |

## Gold 写法（compile 前）

每个 Gold：

```json
{
  "id": "T01",
  "title": "…",
  "nodeType": "EVENT|REVEAL|FACT|PROCESS|…",
  "requiredClaims": [
    { "id": "c1", "label": "…", "anyOf": [["关键词A","关键词B"], ["备选组"]] }
  ],
  "sourceHints": "原文段落定位说明（人工）",
  "notes": ""
}
```

跑完后用 Gold Scorer V2（claim + source overlap）算 HIT，**不要**用 seed eventId presence。

## 若不过

- 不要立刻调第三剧本
- 先看是否出现**第四种**通用错误类型
- 有通用缺口再开 V1.3

## 状态链

```
长生叹     = development + first frozen benchmark
青楼       = first cross-script diagnostic (V1.2 三缺口)
第三剧本   = first true post-fix generalization smoke
```
