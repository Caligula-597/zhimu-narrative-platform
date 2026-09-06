# P10.0 Generated Script Quality Audit Report

> evaluatedAt: `2026-09-06T12:00:00.000Z`
> writerMode: RealScriptWriter + literary-mock-v1 (CI-stable generated path)
> scope: GEN-01..GEN-08 only; no GEN-09; no P9 contract changes

## 时代位置

```text
P8 Infrastructure Era                ✅ CLOSED
P9 Content Factory Foundation        ✅ CLOSED
P10.0 Generated Script Quality Audit ← 本报告
P10.1                                → 待本报告决定下一刀
```

## 先看结论（不是平均分）

| 桶 | 数量 |
|---|---:|
| Production Gate BLOCKED（未写成） | 5 |
| QUALITY_BLOCKED | 0 |
| 总分 < 65 | 0 |
| 65–74 | 3 |
| 75–79 | 0 |
| 80+ | 0 |
| 进入质量评分的样本 | 3 / 8 |

### Production 阻断（内容工厂上游债）

以下 case **从未进入 Real Writer 成品**，因此不算进七维平均——否则会把「写不好」和「写不出来」混在一起：

- **GEN-02 长安夜宴** — OWNER_UNRESOLVED, OWNER_UNRESOLVED
- **GEN-04 毕业照之后** — OWNER_UNRESOLVED
- **GEN-05 零点拍卖会** — OWNER_UNRESOLVED
- **GEN-06 两封没有寄出的信** — OWNER_UNRESOLVED
- **GEN-07 王座之下** — UNRESOLVED_CONFLICT, OWNER_UNRESOLVED

Production blocker 频次：

- `OWNER_UNRESOLVED` × 6
- `UNRESOLVED_CONFLICT` × 1

## Quality Failure Distribution（仅 scored 样本）

| 维度 | 均分 (1–5) | n |
|---|---:|---:|
| CHARACTER_AGENCY 人物成立与玩家能动性 | 4 | 3 |
| INFORMATION_FAIRNESS 信息设计、线索与公平推理 | 4.3 | 3 |
| STAGE_PROGRESSION 剧情推进与幕间节奏 | 4 | 3 |
| GAME_NARRATIVE_FUSION GAME 与剧情融合 | 3.5 | 3 |
| AESTHETIC_VOICE 文本审美、人物声音与世界质感 | 1.8 | 3 |
| ENDING_PAYOFF 终局兑现与主题收束 | 2.7 | 3 |
| HOST_RUNNABILITY 主持可运行性与成品效率 | 3.5 | 3 |

最低三维：
1. **文本审美、人物声音与世界质感** = 1.8
2. **终局兑现与主题收束** = 2.7
3. **GAME 与剧情融合** = 3.5

## Top recurring problems

### AI patterns

- `ABSTRACT_STAKES` — 3/3 scored
- `SAME_VOICE` — 3/3 scored

### Dimension weaknesses

- 人物声音区分不足 — 3
- ABSTRACT_STAKES: 抽象 stake 词密度过高 — 3
- SAME_VOICE: 多角色句式/措辞高度雷同 — 3

## By genre / story family

### Genre（scored）

- **现代封闭推理** — n=1, avgTotal=71
- **科幻身份权限** — n=1, avgTotal=68.5
- **现实公共任务** — n=1, avgTotal=71

### Story family（scored）

- **M01** — n=2, avgTotal=71, weakest=E_AESTHETIC_VOICE=2
- **M07** — n=3, avgTotal=70.2, weakest=E_AESTHETIC_VOICE=1.8
- **M08** — n=2, avgTotal=69.8, weakest=E_AESTHETIC_VOICE=1.8

## Per-case detail

| Case | Focus | Gate | Quality | Total | 最低维 |
|---|---|---|---|---:|---|
| GEN-01 | 推理公平性 / M01 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 71 | E_AESTHETIC_VOICE=2 |
| GEN-02 | 古风 Context / 阵营 | BLOCKED | — | — | — |
| GEN-03 | 科幻世界专属性 | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 68.5 | E_AESTHETIC_VOICE=1.5 |
| GEN-04 | 无凶手群像 / 终局兑现 | BLOCKED | — | — | — |
| GEN-05 | GAME 参与欲 | BLOCKED | — | — | — |
| GEN-06 | 情感 / 平行结构 | BLOCKED | — | — | — |
| GEN-07 | 高交织 / 角色负载 | BLOCKED | — | — | — |
| GEN-08 | 公共任务 / success-failure | READY_WITH_WARNINGS | QUALITY_REVIEW_REQUIRED | 71 | E_AESTHETIC_VOICE=2 |

## 下一刀建议（不预锁 P10.1 名称）

1. **主瓶颈是「写不出来」不是「写不好」**：5/8 因 `OWNER_UNRESOLVED/UNRESOLVED_CONFLICT` 卡在 Production Gate。下一刀若只改 Writer/文风，对多数 GEN 零收益。优先清 OWNER/冲突债，扩大可评分样本。
2. **在已写出的 3 本上，最低维是 文本审美、人物声音与世界质感（1.8）**；A/B 相对 4/4.3。
3. **E 维偏低的解读需带 writerMode 注脚**：本报告使用 `literary-mock-v1`（CI 稳定渲染），会放大 SAME_VOICE / ABSTRACT_STAKES。在清完 Production 债、并有真实模型抽检之前，**不要把「开 Writer V2」当成唯一答案**；但 mock 路径已证明：当前渲染层尚未达到 QUALITY_PASS。

> 本报告只读。不自动重写、不改 P9 合同、不扩机制库。
