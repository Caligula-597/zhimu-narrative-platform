# P10.0 — Generated Script Quality Audit

> 基线：P9 Content Factory Foundation ✅ CLOSED @ `a78d8fd`  
> 原则：**只读体检。** 不改 P9 合同、不自动重写、不扩机制库、不预锁 P10.1。

## 时代位置

```text
P8 Infrastructure Era                ✅ CLOSED
P9 Content Factory Foundation        ✅ CLOSED

Semantic Fidelity                    ✅
Context Instantiation                ✅
GAME Narrative Binding               ✅
Real Writer                          ✅
Content Quality Protocol             ✅

P10.0 Generated Script Quality Audit ← NOW
P10.1                                → 由本刀报告决定（不提前命名）
P11 Creator Productization           → 另线，不与本刀混做
```

## 问题换轨

```text
“系统缺什么能力？”     ← P9 已答完
“自动稿最常差在哪里？” ← P10.0
```

区分：

| 已证明 | 尚未证明 |
|---|---|
| 有能力生产并评价完整剧本 | 自动稿商品级通过率已经足够高 |

## 链（只读）

```text
GEN fixture (CreationSpec 等价)
  → Integrator → PMD
  → Production Gate
       BLOCKED → 记入 Production 债（不算七维）
       READY   → Real Writer → CompleteScriptPackage → P9.4 Gate
  → Aggregate Quality Audit Report
```

## 边界

| 可以 | 禁止 |
|---|---|
| 跑 GEN-01..08 全链路 | 新增 GEN-09 |
| 用已冻结 P9.4 评分 | 改 Hard/Rubric 合同“刷分” |
| literary-mock Real Writer（CI 稳定） | 自动 Critic→Rewrite |
| 诚实记录 OWNER_UNRESOLVED 等阻断 | 用 carrier PMD 偷跑 BLOCKED case 当主结论 |
| 产出 failure distribution | 预锁 P10.1 Character/Clue/Writer V2 |

## 样本焦点

| Case | 特别观察 |
|---|---|
| GEN-01 雨夜公寓 | 推理公平性 / M01 |
| GEN-02 长安夜宴 | 古风 Context / 阵营 |
| GEN-03 赫利俄斯站 | 科幻世界专属性 |
| GEN-04 毕业照之后 | 无凶手群像 / 终局兑现 |
| GEN-05 零点拍卖会 | GAME 参与欲 |
| GEN-06 两封信 | 情感 / 平行结构 |
| GEN-07 王座之下 | 高交织 / 角色负载 |
| GEN-08 停电之前 | 公共任务 / success-failure |

## 交付

| 文件 | 作用 |
|---|---|
| `shared/generated-script-quality-audit.js` | 单案审计 + 聚合 + Markdown |
| `scripts/generated-script-quality-audit.mjs` | CLI 写 captures + docs 报告 |
| `scripts/generated-script-quality-audit.test.mjs` | 形状 / 诚实阻断 / 全库聚合 |
| `docs/P10_0_QUALITY_AUDIT_REPORT_ZH.md` | **主产物：体检报告** |

## 运行

```bash
node scripts/generated-script-quality-audit.mjs
node --test scripts/generated-script-quality-audit.test.mjs
```

## PASS Gate

```text
✅ 不改 P9 合同
✅ GEN-01..08 均有审计行
✅ Production BLOCKED 与 Quality 分数分桶（不混算）
✅ Aggregate 含维度均分 / AI pattern / genre / family
✅ 报告给出「下一刀建议」但不命名 P10.1 特性
✅ verify:changed 相关项绿
```

## 下一刀

**只在报告出来之后决定。** 谁均分最低、谁频次最高，就砍谁。
