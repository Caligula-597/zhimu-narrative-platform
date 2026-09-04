# Case A：标准推理

> M01 追凶 + M07 身份 + M08 隐藏阵营 → 应共享行动/线索，而非三条并排

- Case id: `A-standard-mystery`
- sourceStoryStateRevision: 3
- accepted blocks: M01-FRAMING(嫁祸型追凶｜栽赃物品) · M07-5(身份权限变化｜本人早知，主动伪装到点揭开) · M08-2(固定隐藏阵营｜开局秘密成团且互认)

## 自动结构统计（非人工分）

| 项 | 值 |
|---|---|
| stages | 5 |
| beats | 14 |
| 跨家族同阶段 (COLOCATED 候选) | 4 |
| 单家族阶段 | 0 |
| INTERWOVEN 边 (STRONG/SHARED_SCENE/CAUSAL) | 14 |
| SHARED_CHARACTER | 7 |
| WEAVE_WEAK (同阶段弱连) | 0 |
| KEEP_PARALLEL | 0 |
| weave by kind | {"WEAVE_CAUSAL":4,"WEAVE_SHARED_SCENE":10,"WEAVE_SHARED_CHARACTER":7} |
| conflictReport | 6 |
| 目标驱动措辞 hits | 1 |
| 容器式措辞 hits | 0 |

## 阶段骨架（人工审阅主视图）

### 第一幕 (`act1`)

家族覆盖：M01, M07, M08 · **COLOCATED**

- **[M01] 嫁祸型追凶｜栽赃物品** — 真凶取得与被嫁祸者相关的物品。真凶 沈孤鸿 动机：掩盖十年前的私吞行为
  - chars: B/C · band=0 · stageKey=SETUP
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 伪装态；焦点：叶晚晴。
  - chars: E/F · band=0 · stageKey=HIDDEN
- **[M08] 固定隐藏阵营｜开局秘密成团且互认** — 阵营关系进入可观察状态；焦点：莫玄宗。
  - chars: F/C · band=0 · stageKey=LATENT

### 第二幕 (`act2`)

家族覆盖：M01, M07, M08 · **COLOCATED**

- **[M01] 嫁祸型追凶｜栽赃物品** — 实施犯行并将物品放入现场（勒杀）
  - chars: A/D/B · band=1 · stageKey=CRIME_DISCOVERY
- **[M01] 嫁祸型追凶｜栽赃物品** — 玩家第一轮形成对被嫁祸者的错误嫌疑 被嫁祸者进入过现场并与死者起过冲突
  - chars: C · band=1 · stageKey=FALSE_DIRECTION
- **[M01] 嫁祸型追凶｜栽赃物品** — 物品出现方式不合理（红蜡等） 玉佩沾有仅库房存在的红蜡
  - chars: D · band=1 · stageKey=CONTRADICTION
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 异常渗漏
  - chars: E/F/D/A/NPC_LU · band=1 · stageKey=FIRST_ANOMALY
- **[M08] 固定隐藏阵营｜开局秘密成团且互认** — 压力与信息差推动成员选择 维护秩序
  - chars: F/C/D/E/A/B/NPC_LU · band=1 · stageKey=CONTACT

### 第三幕 (`act3`)

_（空）_

### 第四幕 (`act4`)

家族覆盖：M01, M07, M08 · **COLOCATED**

- **[M01] 嫁祸型追凶｜栽赃物品** — 追查物品移动链反向锁定真凶 库房钥匙记录证明真凶曾移动该物
  - chars: B/C · band=2 · stageKey=TRUTH_REVEAL
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 揭示+权限启用
  - chars: E/F/D/A/NPC_LU · band=2 · stageKey=CONSEQUENCE
- **[M08] 固定隐藏阵营｜开局秘密成团且互认** — 归属或目标变化产生剧情后果
  - chars: F/C/D/E/A/B/NPC_LU · band=2 · stageKey=CONSEQUENCE

### 终局 (`act5`)

家族覆盖：M01, M07, M08 · **COLOCATED**

- **[M01] 嫁祸型追凶｜栽赃物品** — 嫁祸型追凶收束。从库房取出遗失物再放入现场
  - chars: A/B/C/D · band=3 · stageKey=TRUTH_REVEAL
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 身份权限变化阶段完成。
  - chars: E/F/D/A/NPC_LU · band=3 · stageKey=CONSEQUENCE
- **[M08] 固定隐藏阵营｜开局秘密成团且互认** — 固定隐藏阵营阶段完成。
  - chars: F/C/D/E/A/B/NPC_LU · band=3 · stageKey=CONSEQUENCE

## 交织边

- **WEAVE_CAUSAL** — 嫁祸型追凶｜栽赃物品 的后果可衔接到 身份权限变化｜本人早知，主动伪装到点揭开。
- **WEAVE_CAUSAL** — 嫁祸型追凶｜栽赃物品 的后果可衔接到 身份权限变化｜本人早知，主动伪装到点揭开。
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 C，适合合并为同一场景推进。
  - shared: C
- **WEAVE_SHARED_CHARACTER** — 共享角色 B、C，可弱交织。
  - shared: B, C
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、D，适合合并为同一场景推进。
  - shared: A, D
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、D，可弱交织。
  - shared: A, D
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、D、B，适合合并为同一场景推进。
  - shared: A, D, B
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、D、B，可弱交织。
  - shared: A, D, B
- **WEAVE_CAUSAL** — 嫁祸型追凶｜栽赃物品 的后果可衔接到 身份权限变化｜本人早知，主动伪装到点揭开。
- **WEAVE_CAUSAL** — 嫁祸型追凶｜栽赃物品 的后果可衔接到 身份权限变化｜本人早知，主动伪装到点揭开。
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B、C，适合合并为同一场景推进。
  - shared: B, C
- **WEAVE_SHARED_CHARACTER** — 共享角色 B、C，可弱交织。
  - shared: B, C
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、D，适合合并为同一场景推进。
  - shared: A, D
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D，适合合并为同一场景推进。
  - shared: A, B, C, D
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 F，适合合并为同一场景推进。
  - shared: F
- **WEAVE_SHARED_CHARACTER** — 共享角色 E、F，可弱交织。
  - shared: E, F
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 E、F、D、A、NPC_LU，适合合并为同一场景推进。
  - shared: E, F, D, A, NPC_LU
- **WEAVE_SHARED_CHARACTER** — 共享角色 E、F、D、A、NPC_LU，可弱交织。
  - shared: E, F, D, A, NPC_LU
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 E、F、D、A、NPC_LU，适合合并为同一场景推进。
  - shared: E, F, D, A, NPC_LU
- **WEAVE_SHARED_CHARACTER** — 共享角色 E、F、D、A、NPC_LU，可弱交织。
  - shared: E, F, D, A, NPC_LU

## 冲突报告

- ⚠ [ROLE_OVERLOAD/warn] 白斋子 当前承担：victim HIGH、discoverer、outsider（负载 4）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 沈孤鸿 当前承担：killer HIGH、rival_lead HIGH（负载 5）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 顾清商 当前承担：framed HIGH、member（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 杜霄元 当前承担：discoverer、misled、member（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 叶晚晴 当前承担：identity_bearer HIGH、hidden_member HIGH（负载 4）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 莫玄宗 当前承担：witness、faction_lead HIGH（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠

## 角色负载 Top

- **沈孤鸿** load=5 — killer@smb-mtmy, rival_lead@smb-mtmy
- **白斋子** load=4 — victim@smb-mtmy, discoverer@smb-mtmy, outsider@smb-mtmy
- **叶晚晴** load=4 — identity_bearer@smb-mtmy, hidden_member@smb-mtmy
- **顾清商** load=3 — framed@smb-mtmy, member@smb-mtmy
- **杜霄元** load=3 — discoverer@smb-mtmy, misled@smb-mtmy, member@smb-mtmy
- **莫玄宗** load=3 — witness@smb-mtmy, faction_lead@smb-mtmy
- **陆老爷** load=2 — support@smb-mtmy, witness@smb-mtmy

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
