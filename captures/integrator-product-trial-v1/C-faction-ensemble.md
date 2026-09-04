# Case C：群像阵营

> 双 M08 + M07 → 多角色负载与阵营是否爆炸

- Case id: `C-faction-ensemble`
- sourceStoryStateRevision: 3
- accepted blocks: M08-1(固定公开阵营｜双公开阵营对峙) · M08-6(临时联盟｜危机临时结盟) · M07-2(条件触发开放｜结算码触发)

## 自动结构统计（非人工分）

| 项 | 值 |
|---|---|
| stages | 5 |
| beats | 12 |
| 跨家族同阶段 (COLOCATED 候选) | 4 |
| 单家族阶段 | 0 |
| INTERWOVEN 边 (STRONG/SHARED_SCENE/CAUSAL) | 12 |
| SHARED_CHARACTER | 9 |
| WEAVE_WEAK (同阶段弱连) | 0 |
| KEEP_PARALLEL | 0 |
| weave by kind | {"WEAVE_SHARED_SCENE":12,"WEAVE_SHARED_CHARACTER":9} |
| conflictReport | 6 |
| 目标驱动措辞 hits | 0 |
| 容器式措辞 hits | 0 |

## 阶段骨架（人工审阅主视图）

### 第一幕 (`act1`)

家族覆盖：M08, M07 · **COLOCATED**

- **[M08] 固定公开阵营｜双公开阵营对峙** — 阵营关系进入可观察状态；焦点：白斋子。
  - chars: A/B · band=0 · stageKey=LATENT
- **[M08] 临时联盟｜危机临时结盟** — 阵营关系进入可观察状态；焦点：莫玄宗。
  - chars: F/B · band=0 · stageKey=LATENT
- **[M07] 条件触发开放｜结算码触发** — 登记结算码条件；焦点：沈孤鸿。
  - chars: B/C · band=0 · stageKey=HIDDEN

### 第二幕 (`act2`)

家族覆盖：M08, M07 · **COLOCATED**

- **[M08] 固定公开阵营｜双公开阵营对峙** — 压力与信息差推动成员选择 维护秩序
  - chars: A/B/C/D/E · band=1 · stageKey=CONTACT
- **[M08] 临时联盟｜危机临时结盟** — 压力与信息差推动成员选择 维护秩序
  - chars: F/B/C/D/A/E · band=1 · stageKey=CONTACT
- **[M07] 条件触发开放｜结算码触发** — 等待正式结算
  - chars: B/C/F/A/NPC_LU · band=1 · stageKey=FIRST_ANOMALY

### 第三幕 (`act3`)

_（空）_

### 第四幕 (`act4`)

家族覆盖：M08, M07 · **COLOCATED**

- **[M08] 固定公开阵营｜双公开阵营对峙** — 归属或目标变化产生剧情后果
  - chars: A/B/C/D/E · band=2 · stageKey=CONSEQUENCE
- **[M08] 临时联盟｜危机临时结盟** — 归属或目标变化产生剧情后果
  - chars: F/B/C/D/A/E · band=2 · stageKey=CONSEQUENCE
- **[M07] 条件触发开放｜结算码触发** — 码命中则发放
  - chars: B/C/F/A/NPC_LU · band=2 · stageKey=CONSEQUENCE

### 终局 (`act5`)

家族覆盖：M08, M07 · **COLOCATED**

- **[M08] 固定公开阵营｜双公开阵营对峙** — 固定公开阵营阶段完成。
  - chars: A/B/C/D/E · band=3 · stageKey=CONSEQUENCE
- **[M08] 临时联盟｜危机临时结盟** — 临时联盟阶段完成。
  - chars: F/B/C/D/A/E · band=3 · stageKey=CONSEQUENCE
- **[M07] 条件触发开放｜结算码触发** — 条件触发开放阶段完成。
  - chars: B/C/F/A/NPC_LU · band=3 · stageKey=CONSEQUENCE

## 交织边

- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B，适合合并为同一场景推进。
  - shared: B
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B，可弱交织。
  - shared: A, B
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B，适合合并为同一场景推进。
  - shared: B
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B，可弱交织。
  - shared: A, B
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E，适合合并为同一场景推进。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C、D、E，可弱交织。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C，适合合并为同一场景推进。
  - shared: A, B, C
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C，可弱交织。
  - shared: A, B, C
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E，适合合并为同一场景推进。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C、D、E，可弱交织。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C，适合合并为同一场景推进。
  - shared: A, B, C
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C，可弱交织。
  - shared: A, B, C
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E，适合合并为同一场景推进。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C，适合合并为同一场景推进。
  - shared: A, B, C
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B，适合合并为同一场景推进。
  - shared: B
- **WEAVE_SHARED_CHARACTER** — 共享角色 F、B，可弱交织。
  - shared: F, B
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、A，适合合并为同一场景推进。
  - shared: F, B, C, A
- **WEAVE_SHARED_CHARACTER** — 共享角色 F、B、C、A，可弱交织。
  - shared: F, B, C, A
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、A，适合合并为同一场景推进。
  - shared: F, B, C, A
- **WEAVE_SHARED_CHARACTER** — 共享角色 F、B、C、A，可弱交织。
  - shared: F, B, C, A

## 冲突报告

- ⚠ [ROLE_OVERLOAD/warn] 白斋子 当前承担：faction_lead HIGH、mediator、discoverer（负载 4）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 沈孤鸿 当前承担：member、member、identity_bearer HIGH（负载 4）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 顾清商 当前承担：member、member、witness（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 杜霄元 当前承担：outsider、rival_lead HIGH（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 叶晚晴 当前承担：rival_lead HIGH、outsider（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 莫玄宗 当前承担：faction_lead HIGH、misled（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠

## 角色负载 Top

- **白斋子** load=4 — faction_lead@smb-mtmy, mediator@smb-mtmy, discoverer@smb-mtmy
- **沈孤鸿** load=4 — member@smb-mtmy, member@smb-mtmy, identity_bearer@smb-mtmy
- **顾清商** load=3 — member@smb-mtmy, member@smb-mtmy, witness@smb-mtmy
- **杜霄元** load=3 — outsider@smb-mtmy, rival_lead@smb-mtmy
- **叶晚晴** load=3 — rival_lead@smb-mtmy, outsider@smb-mtmy
- **莫玄宗** load=3 — faction_lead@smb-mtmy, misled@smb-mtmy
- **陆老爷** load=1 — support@smb-mtmy

## 人工评分表（本文件下方由审阅填写）

| 指标 | 1–5 | 笔记 |
|---|---:|---|
| Whole-story clarity |  |  |
| Weave quality (INTERWOVEN≠COLOCATED) |  |  |
| Character agency |  |  |
| Stage rhythm |  |  |
| Conflict honesty |  |  |
| Editability (推断：局部 API 存在；本轮脚本未交互验证) |  |  |

### 一句话主线（新人应能复述）

> （审阅填写）

### 是否值得继续写详细母稿？

> （是 / 否 / 有条件）
