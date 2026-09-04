# Case C：群像阵营

> 双 M08 + M07 → 人物目标应可读，不单是机制容器

- Case id: `C-faction-ensemble` · set: **DEV**
- sourceStoryStateRevision: 3
- accepted blocks: M08-1(固定公开阵营｜双公开阵营对峙) · M08-6(临时联盟｜危机临时结盟) · M07-2(条件触发开放｜结算码触发)

## 程序指标（P5.2）

| 项 | 值 |
|---|---|
| stages | 4 |
| beats | 12 |
| empty middle stages | 0 |
| INTERWOVEN (relationQuality) | 7 |
| COLOCATED | 14 |
| PARALLEL / KEEP_PARALLEL | 2 |
| fake INTERWOVEN (scene/char only) | 0 |
| goal-driven beats | 12 |
| 跨家族同阶段 | 1 |
| weave by kind | {"WEAVE_STRONG":1,"WEAVE_CAUSAL":3,"WEAVE_SHARED_SCENE":8,"WEAVE_SHARED_CHARACTER":6,"WEAVE_SHARED_ACTION":3,"KEEP_PARALLEL":2} |
| conflictReport | 6 |
| 目标驱动措辞 hits | 12 |

## 阶段骨架

### 铺垫 (`act1`)

家族覆盖：M08, M07 · 跨家族

- **[M08] 固定公开阵营｜双公开阵营对峙** — 白斋子为了公开亮明阵营归属与目标，确认成员知情范围与联络方式（目标：阵营名单/暗号）
  - chars: A/B · 交织组 · band=0 · goal=公开亮明阵营归属与目标 / action=确认成员知情范围与联络方式
- **[M08] 临时联盟｜危机临时结盟** — 莫玄宗为了巩固或潜伏阵营结构，确认成员知情范围与联络方式（目标：阵营名单/暗号）
  - chars: F/B · band=0 · goal=巩固或潜伏阵营结构 / action=确认成员知情范围与联络方式
- **[M07] 条件触发开放｜结算码触发** — 沈孤鸿为了隐藏或维持当前身份表象，按伪装/未知状态行动，避免过早暴露（目标：身份表象）
  - chars: B/C · band=0 · goal=隐藏或维持当前身份表象 / action=按伪装/未知状态行动，避免过早暴露
- **[M08] 临时联盟｜危机临时结盟** — 白斋子为了促成有时限的临时同盟，推动双方确认共享范围与退出成本（目标：关键账册或信物）
  - chars: A/F/B/C/D/E · 交织组 · band=1 · goal=促成有时限的临时同盟 / action=推动双方确认共享范围与退出成本
- **[M08] 固定公开阵营｜双公开阵营对峙** — 白斋子为了夺取关键资源，组织成员夺取或销毁关键物证/资源（目标：关键账册或信物）
  - chars: A/B/C/D/E · 交织组 · band=1 · goal=夺取关键资源 / action=组织成员夺取或销毁关键物证/资源
- **[M08] 临时联盟｜危机临时结盟** — defector为了在暴露风险下改归属或保住秘密，在关键选择点背叛、退出或清洗异己（目标：归属状态）
  - chars: F/B/C/D/A/E · 交织组 · band=2 · goal=在暴露风险下改归属或保住秘密 / action=在关键选择点背叛、退出或清洗异己
- **[M08] 固定公开阵营｜双公开阵营对峙** — defector为了在暴露风险下改归属或保住秘密，在关键选择点背叛、退出或清洗异己（目标：归属状态）
  - chars: A/B/C/D/E · 交织组 · band=2 · goal=在暴露风险下改归属或保住秘密 / action=在关键选择点背叛、退出或清洗异己
- **[M08] 临时联盟｜危机临时结盟** — 莫玄宗为了结算阵营目标并承受公开后果，公开站队或接受阵营败露后的关系重排（目标：阵营胜负条件）
  - chars: F/B/C/D/A/E · 交织组 · band=3 · goal=结算阵营目标并承受公开后果 / action=公开站队或接受阵营败露后的关系重排
- **[M08] 固定公开阵营｜双公开阵营对峙** — 白斋子为了结算阵营目标并承受公开后果，公开站队或接受阵营败露后的关系重排（目标：阵营胜负条件）
  - chars: A/B/C/D/E · 交织组 · band=3 · goal=结算阵营目标并承受公开后果 / action=公开站队或接受阵营败露后的关系重排

### 加压 (`act2`)

家族覆盖：M07

- **[M07] 条件触发开放｜结算码触发** — 沈孤鸿为了用正式动作换取被条件锁住的信息，完成登记条件以触发内容开放（目标：身份记录）
  - chars: B/C/F/A/NPC_LU · band=1 · goal=用正式动作换取被条件锁住的信息 / action=完成登记条件以触发内容开放

### 升级 (`act3`)

家族覆盖：M07

- **[M07] 条件触发开放｜结算码触发** — 沈孤鸿为了确认真实身份并决定是否公开，核对身份线索并作出公开或隐瞒选择（目标：真实身份）
  - chars: B/C/F/A/NPC_LU · band=2 · goal=确认真实身份并决定是否公开 / action=核对身份线索并作出公开或隐瞒选择

### 收束 (`act4`)

家族覆盖：M07

- **[M07] 条件触发开放｜结算码触发** — 沈孤鸿为了承受身份公开后的关系后果，面对知情者与阵营/调查方的反应（目标：关系重组）
  - chars: B/C/F/A/NPC_LU · band=3 · goal=承受身份公开后的关系后果 / action=面对知情者与阵营/调查方的反应

## 交织边（含 relationQuality + WHY）

- **[INTERWOVEN] WEAVE_STRONG** — 共享行动目标「阵营名单/暗号」，且目标方向可对齐或对撞
- **[INTERWOVEN] WEAVE_CAUSAL** — 固定公开阵营｜双公开阵营对峙 的结果（faction_latent）满足 临时联盟｜危机临时结盟 的前置条件
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 A、B——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「关键场所」执行相近行动（SECURE），可共享一次行动
- **[INTERWOVEN] WEAVE_CAUSAL** — 固定公开阵营｜双公开阵营对峙 的结果（faction_pressure）满足 临时联盟｜危机临时结盟 的前置条件
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「阵营关键据点」执行相近行动（SHIFT），可共享一次行动
- **[INTERWOVEN] WEAVE_CAUSAL** — 固定公开阵营｜双公开阵营对峙 的结果（allegiance_changed）满足 临时联盟｜危机临时结盟 的前置条件
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 A、B、C——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「阵营关键据点」执行相近行动（SETTLE），可共享一次行动
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 A、B、C——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 F、B——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 A、F、B、C——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 A、F、B、C——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、A——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 F、B、C、A——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 F、B、C、A——可同场并列，不算真正交织
- **[PARALLEL] KEEP_PARALLEL** — 固定公开阵营｜双公开阵营对峙 与 条件触发开放｜结算码触发 无线索级交织证据，叙事线保持平行（同场/同角不算交织）
- **[PARALLEL] KEEP_PARALLEL** — 临时联盟｜危机临时结盟 与 条件触发开放｜结算码触发 无线索级交织证据，叙事线保持平行（同场/同角不算交织）

## 冲突报告

- ⚠ [ROLE_OVERLOAD/warn] 白斋子 当前承担：faction_lead HIGH、mediator、discoverer（负载 4）
- ⚠ [ROLE_OVERLOAD/warn] 沈孤鸿 当前承担：member、member、identity_bearer HIGH（负载 4）
- ⚠ [ROLE_OVERLOAD/warn] 顾清商 当前承担：member、member、witness（负载 3）
- ⚠ [ROLE_OVERLOAD/warn] 杜霄元 当前承担：outsider、rival_lead HIGH（负载 3）
- ⚠ [ROLE_OVERLOAD/warn] 叶晚晴 当前承担：rival_lead HIGH、outsider（负载 3）
- ⚠ [ROLE_OVERLOAD/warn] 莫玄宗 当前承担：faction_lead HIGH、misled（负载 3）

## 人工评分表

| 指标 | 1–5 | 笔记 |
|---|---:|---|
| Whole-story clarity |  |  |
| Weave quality (INTERWOVEN≠COLOCATED) |  |  |
| Character agency |  |  |
| Stage rhythm |  |  |
| Conflict honesty |  |  |
| Editability |  |  |
