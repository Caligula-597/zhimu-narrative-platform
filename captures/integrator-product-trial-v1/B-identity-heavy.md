# Case B：身份为主

> 双 M07 + M08 → 警惕「异常→揭示」机械流水线

- Case id: `B-identity-heavy`
- sourceStoryStateRevision: 3
- accepted blocks: M07-1(固定阶段开放｜全体同步到点发放) · M07-5(身份权限变化｜假身份逐层崩解) · M08-4(动态阵营｜节点选择改归属)

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
| weave by kind | {"WEAVE_SHARED_SCENE":11,"WEAVE_SHARED_CHARACTER":9,"WEAVE_CAUSAL":1} |
| conflictReport | 6 |
| 目标驱动措辞 hits | 0 |
| 容器式措辞 hits | 0 |

## 阶段骨架（人工审阅主视图）

### 第一幕 (`act1`)

家族覆盖：M07, M08 · **COLOCATED**

- **[M07] 固定阶段开放｜全体同步到点发放** — 内容处于隐藏态，仅系统登记接收范围=全体；焦点：白斋子。
  - chars: A/B · band=0 · stageKey=HIDDEN
- **[M07] 身份权限变化｜假身份逐层崩解** — 假层1；焦点：莫玄宗。
  - chars: F/B · band=0 · stageKey=HIDDEN
- **[M08] 动态阵营｜节点选择改归属** — 阵营关系进入可观察状态；焦点：叶晚晴。
  - chars: E/A · band=0 · stageKey=LATENT

### 第二幕 (`act2`)

家族覆盖：M07, M08 · **COLOCATED**

- **[M07] 固定阶段开放｜全体同步到点发放** — 到达指定阶段，服务器自动发放
  - chars: A/B/C/D/E · band=1 · stageKey=FIRST_ANOMALY
- **[M07] 身份权限变化｜假身份逐层崩解** — 假层2崩解
  - chars: F/B/C/D/NPC_LU · band=1 · stageKey=FIRST_ANOMALY
- **[M08] 动态阵营｜节点选择改归属** — 压力与信息差推动成员选择 维护秩序
  - chars: E/A/B/C/D/F · band=1 · stageKey=CONTACT

### 第三幕 (`act3`)

_（空）_

### 第四幕 (`act4`)

家族覆盖：M07, M08 · **COLOCATED**

- **[M07] 固定阶段开放｜全体同步到点发放** — 全员持有同一事实片段，后续可公开讨论
  - chars: A/B/C/D/E · band=2 · stageKey=CONSEQUENCE
- **[M07] 身份权限变化｜假身份逐层崩解** — 真身份+受限权限
  - chars: F/B/C/D/NPC_LU · band=2 · stageKey=CONSEQUENCE
- **[M08] 动态阵营｜节点选择改归属** — 归属或目标变化产生剧情后果
  - chars: E/A/B/C/D/F · band=2 · stageKey=CONSEQUENCE

### 终局 (`act5`)

家族覆盖：M07, M08 · **COLOCATED**

- **[M07] 固定阶段开放｜全体同步到点发放** — 固定阶段开放阶段完成。
  - chars: A/B/C/D/E · band=3 · stageKey=CONSEQUENCE
- **[M07] 身份权限变化｜假身份逐层崩解** — 身份权限变化阶段完成。
  - chars: F/B/C/D/NPC_LU · band=3 · stageKey=CONSEQUENCE
- **[M08] 动态阵营｜节点选择改归属** — 动态阵营阶段完成。
  - chars: E/A/B/C/D/F · band=3 · stageKey=CONSEQUENCE

## 交织边

- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B，适合合并为同一场景推进。
  - shared: B
- **WEAVE_SHARED_CHARACTER** — 共享角色 B，可弱交织。
  - shared: B
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A，适合合并为同一场景推进。
  - shared: A
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B，可弱交织。
  - shared: A, B
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B、C、D，适合合并为同一场景推进。
  - shared: B, C, D
- **WEAVE_SHARED_CHARACTER** — 共享角色 B、C、D，可弱交织。
  - shared: B, C, D
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E，适合合并为同一场景推进。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C、D、E，可弱交织。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B、C、D，适合合并为同一场景推进。
  - shared: B, C, D
- **WEAVE_SHARED_CHARACTER** — 共享角色 B、C、D，可弱交织。
  - shared: B, C, D
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E，适合合并为同一场景推进。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C、D、E，可弱交织。
  - shared: A, B, C, D, E
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 B、C、D，适合合并为同一场景推进。
  - shared: B, C, D
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E，适合合并为同一场景推进。
  - shared: A, B, C, D, E
- **WEAVE_CAUSAL** — 身份权限变化｜假身份逐层崩解 的后果可衔接到 动态阵营｜节点选择改归属。
- **WEAVE_SHARED_CHARACTER** — 共享角色 F、B，可弱交织。
  - shared: F, B
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、D，适合合并为同一场景推进。
  - shared: F, B, C, D
- **WEAVE_SHARED_CHARACTER** — 共享角色 F、B、C、D，可弱交织。
  - shared: F, B, C, D
- **WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、D，适合合并为同一场景推进。
  - shared: F, B, C, D
- **WEAVE_SHARED_CHARACTER** — 共享角色 F、B、C、D，可弱交织。
  - shared: F, B, C, D

## 冲突报告

- ⚠ [ROLE_OVERLOAD/warn] 白斋子 当前承担：identity_bearer HIGH、member（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 沈孤鸿 当前承担：witness、witness、member（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 顾清商 当前承担：misled、misled、rival_lead HIGH（负载 4）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 杜霄元 当前承担：discoverer、discoverer、defector HIGH（负载 4）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 叶晚晴 当前承担：support、faction_lead HIGH（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠
- ⚠ [ROLE_OVERLOAD/warn] 莫玄宗 当前承担：identity_bearer HIGH、outsider（负载 3）
  - 建议：保留 / 建议把次要职责换给其他角色 / 标记为有意重叠

## 角色负载 Top

- **顾清商** load=4 — misled@smb-mtmy, misled@smb-mtmy, rival_lead@smb-mtmy
- **杜霄元** load=4 — discoverer@smb-mtmy, discoverer@smb-mtmy, defector@smb-mtmy
- **白斋子** load=3 — identity_bearer@smb-mtmy, member@smb-mtmy
- **沈孤鸿** load=3 — witness@smb-mtmy, witness@smb-mtmy, member@smb-mtmy
- **叶晚晴** load=3 — support@smb-mtmy, faction_lead@smb-mtmy
- **莫玄宗** load=3 — identity_bearer@smb-mtmy, outsider@smb-mtmy
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
