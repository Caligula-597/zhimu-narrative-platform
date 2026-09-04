# Case D：高交织 / 有意重叠

> 同一角色多重职责 → 冲突诚实 + 语义交织，禁止仅凭同角标 INTERWOVEN

- Case id: `D-high-weave-overlap` · set: **DEV**
- sourceStoryStateRevision: 4
- accepted blocks: M01-FRAMING(嫁祸型追凶｜栽赃物品) · M07-5(身份权限变化｜本人早知，主动伪装到点揭开) · M08-1(固定公开阵营｜开局全员互认公开阵营)

## 程序指标（P5.2）

| 项 | 值 |
|---|---|
| stages | 4 |
| beats | 14 |
| empty middle stages | 0 |
| INTERWOVEN (relationQuality) | 1 |
| COLOCATED | 20 |
| PARALLEL / KEEP_PARALLEL | 2 |
| fake INTERWOVEN (scene/char only) | 0 |
| goal-driven beats | 14 |
| 跨家族同阶段 | 4 |
| weave by kind | {"WEAVE_SHARED_SCENE":11,"WEAVE_SHARED_CHARACTER":9,"WEAVE_SHARED_ACTION":1,"KEEP_PARALLEL":2} |
| conflictReport | 5 |
| 目标驱动措辞 hits | 14 |

## 阶段骨架

### 铺垫 (`act1`)

家族覆盖：M01, M07, M08 · 跨家族

- **[M01] 嫁祸型追凶｜栽赃物品** — 沈孤鸿为了准备可嫁祸的假象，布置与顾清商相关的误导物（目标：被嫁祸者遗失的玉佩）
  - chars: B/C · band=0 · goal=准备可嫁祸的假象 / action=布置与顾清商相关的误导物
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 沈孤鸿为了隐藏或维持当前身份表象，按伪装/未知状态行动，避免过早暴露（目标：身份表象）
  - chars: B/F · band=0 · goal=隐藏或维持当前身份表象 / action=按伪装/未知状态行动，避免过早暴露
- **[M08] 固定公开阵营｜开局全员互认公开阵营** — 沈孤鸿为了公开亮明阵营归属与目标，确认成员知情范围与联络方式（目标：阵营名单/暗号）
  - chars: B/C · band=0 · goal=公开亮明阵营归属与目标 / action=确认成员知情范围与联络方式

### 加压 (`act2`)

家族覆盖：M01, M07, M08 · 跨家族

- **[M01] 嫁祸型追凶｜栽赃物品** — 沈孤鸿为了完成犯行并指向顾清商，实施犯行并留下指向顾清商的痕迹（目标：被嫁祸者遗失的玉佩）
  - chars: B/A/D · band=1 · goal=完成犯行并指向顾清商 / action=实施犯行并留下指向顾清商的痕迹
- **[M01] 嫁祸型追凶｜栽赃物品** — 沈孤鸿为了完成犯行并指向顾清商，实施犯行并留下指向顾清商的痕迹（目标：被嫁祸者遗失的玉佩）
  - chars: B/C · band=1 · goal=完成犯行并指向顾清商 / action=实施犯行并留下指向顾清商的痕迹
- **[M01] 嫁祸型追凶｜栽赃物品** — 杜霄元为了推翻对顾清商的错误判断，对照现场与证物寻找矛盾（目标：被嫁祸者遗失的玉佩）
  - chars: D · band=1 · goal=推翻对顾清商的错误判断 / action=对照现场与证物寻找矛盾
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 沈孤鸿为了寻找能确认身份的记录或信物，进入藏有记录的场所搜查身份相关物证（目标：身份记录）
  - chars: B/F/D/A/NPC_LU · band=1 · goal=寻找能确认身份的记录或信物 / action=进入藏有记录的场所搜查身份相关物证
- **[M08] 固定公开阵营｜开局全员互认公开阵营** — 沈孤鸿为了夺取关键资源，组织成员夺取或销毁关键物证/资源（目标：关键账册或信物）
  - chars: B/C/D/E/A · band=1 · goal=夺取关键资源 / action=组织成员夺取或销毁关键物证/资源

### 升级 (`act3`)

家族覆盖：M01, M07, M08 · 跨家族

- **[M01] 嫁祸型追凶｜栽赃物品** — 杜霄元为了推翻对顾清商的错误判断，对照现场与证物寻找矛盾（目标：被嫁祸者遗失的玉佩）
  - chars: D/B/C · band=2 · goal=推翻对顾清商的错误判断 / action=对照现场与证物寻找矛盾
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 沈孤鸿为了启用真实身份对应的权限，在揭示后启用权限表并验证资格（目标：真实身份）
  - chars: B/F/D/A/NPC_LU · band=2 · goal=启用真实身份对应的权限 / action=在揭示后启用权限表并验证资格
- **[M08] 固定公开阵营｜开局全员互认公开阵营** — defector为了在暴露风险下改归属或保住秘密，在关键选择点背叛、退出或清洗异己（目标：归属状态）
  - chars: B/C/D/E/A · band=2 · goal=在暴露风险下改归属或保住秘密 / action=在关键选择点背叛、退出或清洗异己

### 收束 (`act4`)

家族覆盖：M01, M07, M08 · 跨家族

- **[M01] 嫁祸型追凶｜栽赃物品** — 杜霄元为了锁定真凶沈孤鸿，用决定性证据揭穿嫁祸（目标：决定性证据）
  - chars: D/A/B/C · band=3 · goal=锁定真凶沈孤鸿 / action=用决定性证据揭穿嫁祸
- **[M07] 身份权限变化｜本人早知，主动伪装到点揭开** — 沈孤鸿为了承受身份公开后的关系后果，面对知情者与阵营/调查方的反应（目标：关系重组）
  - chars: B/F/D/A/NPC_LU · band=3 · goal=承受身份公开后的关系后果 / action=面对知情者与阵营/调查方的反应
- **[M08] 固定公开阵营｜开局全员互认公开阵营** — 沈孤鸿为了结算阵营目标并承受公开后果，公开站队或接受阵营败露后的关系重排（目标：阵营胜负条件）
  - chars: B/C/D/E/A · band=3 · goal=结算阵营目标并承受公开后果 / action=公开站队或接受阵营败露后的关系重排

## 交织边（含 relationQuality + WHY）

- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B、C——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B、C——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B、A、D——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B、A、D——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B、A、D——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B、A、D——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 D、B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 D、B——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 D、B、C——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 D、B、C——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 D、A、B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 D、A、B、C——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B——仅角色重合，保持同场并列而非强制合并
- **[INTERWOVEN] WEAVE_SHARED_ACTION** — 两条剧情都需要在「藏有记录的场所」执行相近行动（shared-site-search），可共享一次行动
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B、D、A——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B、D、A——可同场并列，不算真正交织
- **[COLOCATED] WEAVE_SHARED_CHARACTER** — 共享角色 B、D、A——仅角色重合，保持同场并列而非强制合并
- **[COLOCATED] WEAVE_SHARED_SCENE** — 同阶段共享角色 B、D、A——可同场并列，不算真正交织
- **[PARALLEL] KEEP_PARALLEL** — 嫁祸型追凶｜栽赃物品 与 身份权限变化｜本人早知，主动伪装到点揭开 无线索级交织证据，叙事线保持平行（同场/同角不算交织）
- **[PARALLEL] KEEP_PARALLEL** — 嫁祸型追凶｜栽赃物品 与 固定公开阵营｜开局全员互认公开阵营 无线索级交织证据，叙事线保持平行（同场/同角不算交织）

## 冲突报告

- ⚠ [ROLE_OVERLOAD/warn] 白斋子 当前承担：victim HIGH、discoverer、rival_lead HIGH（负载 5）
- ⚠ [ROLE_OVERLOAD/warn] 沈孤鸿 当前承担：killer HIGH、identity_bearer HIGH、faction_lead HIGH（负载 7）
- ⚠ [ROLE_OVERLOAD/warn] 顾清商 当前承担：framed HIGH、member（负载 3）
- ⚠ [ROLE_OVERLOAD/warn] 杜霄元 当前承担：discoverer、misled、member（负载 3）
- ⚠ [INTENTIONAL_OVERLAP_CANDIDATE/info] 沈孤鸿 同时是真凶与阵营领袖——可保留为强交织，或拆开降负载。

## 人工评分表

| 指标 | 1–5 | 笔记 |
|---|---:|---|
| Whole-story clarity |  |  |
| Weave quality (INTERWOVEN≠COLOCATED) |  |  |
| Character agency |  |  |
| Stage rhythm |  |  |
| Conflict honesty |  |  |
| Editability |  |  |
