# 下一刀方向 — Creation Intent Fidelity / Experience Preservation

> 来源：Real Production Trial #1 人工结案（[`RPT1_HUMAN_ADJUDICATION_ZH.md`](./RPT1_HUMAN_ADJUDICATION_ZH.md)）  
> **不开 Writer V2 作为下一刀。** 不预锁具体 ticket 编号以外的实现清单；本稿只锁问题与验收直觉。

## 一句话

```text
作者创作意图（体验）在 STORY / Context 选择之后仍被保留，
而不是被模板族语义吞成另一本剧本类型。
```

## 必须保住的体验（以《闭馆之后》为探针）

```text
美术馆私人预展夜
关系博弈（试探 / 隐瞒 / 交换 / 怀疑 / 一次公开抉择）
前 20 分钟玩家有事做
中途至少一次真实的资源/信息所有权变化（可玩，非旁白）
不强制唯一凶手
GAME 可选，不为塞而塞
```

## Trial #1 已证明的失败翻译

| 意图信号 | 被吞成 |
|---|---|
| 关系博弈 / NEGOTIATION | M08 秘密阵营（候选理由甚至是 ROLEPLAY） |
| 推理权重 | M01 嫁祸推凶主轴 |
| 美术馆 explicit Context | 与 CONTEMPORARY_URBAN 物业/住户键并存 |
| 目录册 / 腕带 / 门禁 | 未成为玩家可操作中心物 |

## 明确不在下一刀优先做的事

- 把现稿「凶案 + 阵营 + 物业档案室」润色得更漂亮  
- 单独升级 DeepSeek literary prompt  
- 为刷分放宽 P9.4 Hard Blocker  

## 连带校准（第二梯队，可并行记录）

| 项 | 为何 |
|---|---|
| Context Domain Coherence | Explicit 键未覆盖 Preset 同域字段 |
| Gate：`hasGame=false` → D=N/A | 空证据不应给 3 |
| Gate：Hard HOST 与 G 分自洽 | Hard 成立时 G 不可≈可跑场 |
| Gate：跨 section Canon | 公共稿自相矛盾须可检出 |
| Writer：责任串线 | OWNER 已绑 ≠ 只写给正确角色 |
| Writer：名字≠物件 | 「白绫」不自动生成白绫布 |

## 何时算下一刀开刀成功（草案）

同一 CreationSpec（或等价新题）再跑一刀后：

1. STORY 候选/接受理由能追溯到体验标签，而非过宽 ROLEPLAY  
2. 成品主轴仍可读作「预展夜关系博弈」，而非默认唯一凶手本  
3. Explicit venue/object 语义压过无关 Preset 键  
4. 人工五项中至少「前 20 分钟欲望」或「互动语法换挡」有一项明显抬升  

正式 ticket：**P10.2 Creation Intent Fidelity V1** — 见 [`P10_2_CREATION_INTENT_FIDELITY_ZH.md`](./P10_2_CREATION_INTENT_FIDELITY_ZH.md)。
