# P10.0 Generated Script Quality Audit Report

> evaluatedAt: `2026-09-06T12:00:00.000Z`
> writerMode: RealScriptWriter + literary-mock-v1 (CI-stable generated path)
> scope: GEN-01..GEN-08 only; no GEN-09; no P9 contract changes

## 时代位置

```text
P8 Infrastructure Era                ✅ CLOSED
P9 Content Factory Foundation        ✅ CLOSED
P10.0 Generated Script Quality Audit ← 本报告（含 P10.1 后 Re-audit）
P10.1 Owner Binding Closure          ✅（清 OWNER 吞吐量债）
★ Real Production Trial #1           → 下一阶段（真模型 + 新题目）
```

> Re-audit 注：P10.1 后 Production BLOCKED 已清除或接近清除；下方分数仍来自 `literary-mock-v1`，**不能**当作真模型商品级证明。

## 先看结论（不是平均分）

| 桶 | 数量 |
|---|---:|
| Production Gate BLOCKED（未写成） | 0 |
| QUALITY_BLOCKED | 0 |
| 总分 < 65 | 0 |
| 65–74 | 8 |
| 75–79 | 0 |
| 80+ | 0 |
| 进入质量评分的样本 | 8 / 8 |

## Quality Failure Distribution（仅 scored 样本）

| 维度 | 均分 (1–5) | n |
|---|---:|---:|
| CHARACTER_AGENCY 人物成立与玩家能动性 | 3.9 | 8 |
| INFORMATION_FAIRNESS 信息设计、线索与公平推理 | 4.2 | 8 |
| STAGE_PROGRESSION 剧情推进与幕间节奏 | 4 | 8 |
| GAME_NARRATIVE_FUSION GAME 与剧情融合 | 3.6 | 8 |
| AESTHETIC_VOICE 文本审美、人物声音与世界质感 | 1.4 | 8 |
| ENDING_PAYOFF 终局兑现与主题收束 | 2.7 | 8 |
| HOST_RUNNABILITY 主持可运行性与成品效率 | 3.5 | 8 |

最低三维：
1. **文本审美、人物声音与世界质感** = 1.4
2. **终局兑现与主题收束** = 2.7
3. **主持可运行性与成品效率** = 3.5

## Top recurring problems

### AI patterns

- `ABSTRACT_STAKES` — 8/8 scored
- `SAME_VOICE` — 8/8 scored

### Dimension weaknesses

- 人物声音区分不足 — 8
- ABSTRACT_STAKES: 抽象 stake 词密度过高 — 8
- SAME_VOICE: 多角色句式/措辞高度雷同 — 8

## By genre / story family

### Genre（scored）

- **现代封闭推理** — n=1, avgTotal=71
- **古风阵营** — n=1, avgTotal=66
- **科幻身份权限** — n=1, avgTotal=68.5
- **校园现实群像** — n=1, avgTotal=66
- **利益竞价悬疑** — n=1, avgTotal=69.5
- **双线低亲和平行** — n=1, avgTotal=68.5
- **古风高交织** — n=1, avgTotal=66
- **现实公共任务** — n=1, avgTotal=71

### Story family（scored）

- **M01** — n=3, avgTotal=69.3, weakest=E_AESTHETIC_VOICE=1.7
- **M07** — n=8, avgTotal=68.3, weakest=E_AESTHETIC_VOICE=1.4
- **M08** — n=7, avgTotal=67.9, weakest=E_AESTHETIC_VOICE=1.4

## Per-case detail

| Case | Focus | Gate | Quality | Total | 最低维 |
|---|---|---|---|---:|---|
| GEN-01 | 推理公平性 / M01 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 71 | E_AESTHETIC_VOICE=2 |
| GEN-02 | 古风 Context / 阵营 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 66 | E_AESTHETIC_VOICE=1 |
| GEN-03 | 科幻世界专属性 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 68.5 | E_AESTHETIC_VOICE=1.5 |
| GEN-04 | 无凶手群像 / 终局兑现 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 66 | E_AESTHETIC_VOICE=1 |
| GEN-05 | GAME 参与欲 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 69.5 | E_AESTHETIC_VOICE=1.5 |
| GEN-06 | 情感 / 平行结构 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 68.5 | E_AESTHETIC_VOICE=1.5 |
| GEN-07 | 高交织 / 角色负载 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 66 | E_AESTHETIC_VOICE=1 |
| GEN-08 | 公共任务 / success-failure | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 71 | E_AESTHETIC_VOICE=2 |

## 下一刀建议（不预锁 P10.1 名称）

1. **吞吐量债已清（8/8 可评分）**。下一刀不要继续猜 P10.2 合同；应进入 **Real Production Trial #1**（真模型、真正新题目、全链路、不手修），用五件事验收：完整生成 / 前 20 分钟欲望 / 幕间变化 / 六人声音 / 终局兑现。
2. **在已写出的 8 本上，最低维是 文本审美、人物声音与世界质感（1.4）**；A/B 相对 3.9/4.2。
3. **E 维偏低的解读需带 writerMode 注脚**：本报告使用 `literary-mock-v1`（CI 稳定渲染），会放大 SAME_VOICE / ABSTRACT_STAKES。在清完 Production 债、并有真实模型抽检之前，**不要把「开 Writer V2」当成唯一答案**；但 mock 路径已证明：当前渲染层尚未达到 QUALITY_PASS。

> 本报告只读。不自动重写、不改 P9 合同、不扩机制库。
