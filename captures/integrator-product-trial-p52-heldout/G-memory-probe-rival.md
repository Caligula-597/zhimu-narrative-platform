# Case G：记忆恢复 + 探测 + 对立营

> 未见组合：M07-4 + M07-8 + M08-8

- Case id: `G-memory-probe-rival` · set: **HELD_OUT**
- sourceStoryStateRevision: 3
- accepted blocks: M07-4(个人记忆分层｜两层：保底+终局) · M07-8(集合属性探测｜多数表决式聚合) · M08-8(多阵营并存｜三营条件表)

## 程序指标（P5.2）

| 项 | 值 |
|---|---|
| stages | 4 |
| beats | 12 |
| empty middle stages | 0 |
| INTERWOVEN (relationQuality) | 8 |
| COLOCATED | 13 |
| PARALLEL / KEEP_PARALLEL | 0 |
| fake INTERWOVEN (scene/char only) | 0 |
| goal-driven beats | 12 |
| 跨家族同阶段 | 2 |
| weave by kind | {"WEAVE_STRONG":1,"WEAVE_SHARED_CHARACTER":7,"WEAVE_SHARED_SCENE":6,"WEAVE_SHARED_ACTION":5,"WEAVE_CAUSAL":2} |
| conflictReport | 6 |
| 目标驱动措辞 hits | 12 |

## 阶段骨架

### 铺垫 (`act1`)

家族覆盖：M07, M08 · 跨家族

- **[M07] 个人记忆分层｜两层：保底+终局** — 白斋子为了隐藏或维持当前身份表象，按伪装/未知状态行动，避免过早暴露（目标：身份表象）
  - chars: A/B · band=0 · goal=隐藏或维持当前身份表象 / action=按伪装/未知状态行动，避免过早暴露
- **[M07] 集合属性探测｜多数表决式聚合** — 莫玄宗为了隐藏或维持当前身份表象，按伪装/未知状态行动，避免过早暴露（目标：身份表象）
  - chars: F/B · band=0 · goal=隐藏或维持当前身份表象 / action=按伪装/未知状态行动，避免过早暴露
- **[M08] 多阵营并存｜三营条件表** — 白斋子为了巩固或潜伏阵营结构，确认成员知情范围与联络方式（目标：阵营名单/暗号）
  - chars: A/B · band=0 · goal=巩固或潜伏阵营结构 / action=确认成员知情范围与联络方式

### 加压 (`act2`)

家族覆盖：M07, M08 · 跨家族

- **[M07] 个人记忆分层｜两层：保底+终局** — 白斋子为了寻找能确认身份的记录或信物，进入藏有记录的场所搜查身份相关物证（目标：身份记录）
  - chars: A/B/C/D/E · 交织组 · band=1 · goal=寻找能确认身份的记录或信物 / action=进入藏有记录的场所搜查身份相关物证
- **[M07] 集合属性探测｜多数表决式聚合** — 叶晚晴为了压缩隐藏身份候选范围，对一组人发起集合属性探测（目标：聚合输出）
  - chars: E/F/B/C/D/NPC_LU · band=1 · goal=压缩隐藏身份候选范围 / action=对一组人发起集合属性探测
- **[M08] 多阵营并存｜三营条件表** — 叶晚晴为了在多营条件表中争取渔利档，利用两营冲突抽取第三方利益（目标：关键账册或信物）
  - chars: E/A/B/C/D/F · band=1 · goal=在多营条件表中争取渔利档 / action=利用两营冲突抽取第三方利益
- **[M07] 集合属性探测｜多数表决式聚合** — 莫玄宗为了确认真实身份并决定是否公开，核对身份线索并作出公开或隐瞒选择（目标：真实身份）
  - chars: F/B/C/D/NPC_LU/E · 交织组 · band=2 · goal=确认真实身份并决定是否公开 / action=核对身份线索并作出公开或隐瞒选择
- **[M07] 个人记忆分层｜两层：保底+终局** — 白斋子为了确认真实身份并决定是否公开，核对身份线索并作出公开或隐瞒选择（目标：真实身份）
  - chars: A/B/C/D/E · 交织组 · band=2 · goal=确认真实身份并决定是否公开 / action=核对身份线索并作出公开或隐瞒选择
- **[M07] 集合属性探测｜多数表决式聚合** — 莫玄宗为了承受身份公开后的关系后果，面对知情者与阵营/调查方的反应（目标：关系重组）
  - chars: F/B/C/D/NPC_LU/E · 交织组 · band=3 · goal=承受身份公开后的关系后果 / action=面对知情者与阵营/调查方的反应
- **[M07] 个人记忆分层｜两层：保底+终局** — 白斋子为了承受身份公开后的关系后果，面对知情者与阵营/调查方的反应（目标：关系重组）
  - chars: A/B/C/D/E · 交织组 · band=3 · goal=承受身份公开后的关系后果 / action=面对知情者与阵营/调查方的反应

### 升级 (`act3`)

家族覆盖：M08

- **[M08] 多阵营并存｜三营条件表** — defector为了在暴露风险下改归属或保住秘密，在关键选择点背叛、退出或清洗异己（目标：归属状态）
  - chars: A/B/C/D/E/F · band=2 · goal=在暴露风险下改归属或保住秘密 / action=在关键选择点背叛、退出或清洗异己

### 收束 (`act4`)

家族覆盖：M08

- **[M08] 多阵营并存｜三营条件表** — 白斋子为了结算阵营目标并承受公开后果，公开站队或接受阵营败露后的关系重排（目标：阵营胜负条件）
  - chars: A/B/C/D/E/F · band=3 · goal=结算阵营目标并承受公开后果 / action=公开站队或接受阵营败露后的关系重排

## 交织边（含 relationQuality + WHY）

- **[INTERWOVEN] WEAVE_STRONG** — 共享行动目标「身份表象」，且目标方向可对齐或对撞
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 A、B——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「藏有记录的场所」执行相近行动（SEARCH/PROBE），可共享一次行动
- **[INTERWOVEN] WEAVE_CAUSAL** — 个人记忆分层｜两层：保底+终局 的结果（identity_clue）满足 集合属性探测｜多数表决式聚合 的前置条件
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「藏有记录的场所」执行相近行动（shared-site-search），可共享一次行动
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C、D、E——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「藏有记录的场所」执行相近行动（CONFIRM），可共享一次行动
- **[INTERWOVEN] WEAVE_CAUSAL** — 个人记忆分层｜两层：保底+终局 的结果（identity_confirmed）满足 集合属性探测｜多数表决式聚合 的前置条件
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C、D、E——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「藏有记录的场所」执行相近行动（CONSEQUENCE），可共享一次行动
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C、D、E——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 F、B——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「藏有记录的场所」执行相近行动（shared-site-search），可共享一次行动
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 E、F、B、C、D——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、D、E——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 F、B、C、D、E——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、D、E——可同场并列，不算真正交织

## 冲突报告

- ⚠ [ROLE_OVERLOAD/warn] 白斋子 当前承担：identity_bearer HIGH、faction_lead HIGH（负载 4）
- ⚠ [ROLE_OVERLOAD/warn] 沈孤鸿 当前承担：witness、witness、member（负载 3）
- ⚠ [ROLE_OVERLOAD/warn] 顾清商 当前承担：misled、misled、member（负载 3）
- ⚠ [ROLE_OVERLOAD/warn] 杜霄元 当前承担：discoverer、discoverer、rival_lead HIGH（负载 4）
- ⚠ [ROLE_OVERLOAD/warn] 叶晚晴 当前承担：support、discoverer、faction_lead HIGH（负载 4）
- ⚠ [ROLE_OVERLOAD/warn] 莫玄宗 当前承担：identity_bearer HIGH、outsider（负载 3）

## 人工评分表

| 指标 | 1–5 | 笔记 |
|---|---:|---|
| Whole-story clarity |  |  |
| Weave quality (INTERWOVEN≠COLOCATED) |  |  |
| Character agency |  |  |
| Stage rhythm |  |  |
| Conflict honesty |  |  |
| Editability |  |  |
