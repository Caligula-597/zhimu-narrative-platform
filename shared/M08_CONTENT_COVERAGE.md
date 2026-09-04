# M08 阵营 Content Pack V1

> 架构冻结：只填 TemplateDefinition，不改 Engine / 不写专用 producer / 无 Workbench `if (familyId === "M08")`。

## Coverage Matrix

| ID | 名称 | Variants | 核心角色结构 | 信息结构 | 核心 plot | 阶段模式 | 推荐交织 | 风险 / 不适用 |
|---|---|---:|---|---|---|---|---|---|
| M08-1 | 固定公开阵营 | 10 | Lead + members + outsider/rival | PUBLIC / PARTIAL | identity, goals, formation, consequence | LATENT→FORMATION→PRESSURE→EXPOSURE→… | M01 可见对立面 | 做成静态派系标签 |
| M08-2 | 固定隐藏阵营 | 11 | Lead + members + hidden/witness | PRIVATE / ASYMMETRIC；互认/只认领袖/直联 | secrecy, exposure, betrayal | LATENT→CONTACT→…→EXPOSURE | M07 身份打乱隐营 | 只能猜身份无行动差 |
| M08-3 | 非对称阵营 | 10 | Lead + rivalLead + members | 接口不对称 | rivalGoal, asymmetricInterface | FORMATION→PRESSURE→RESOLUTION | 公共状态争夺 | 人数与信息双碾压 |
| M08-4 | 动态阵营 | 10 | Lead + defector + rival | 改属知情分层 | changeNode, historyRule | FORMATION→SPLIT/BETRAYAL→… | M07 身份恢复改属 | 追溯重算旧贡献 |
| M08-5 | 个人目标叠加阵营目标 | 10 | Lead + members + defector | 个人/阵营双结算 | personalGoal, settleRule | PRESSURE→BETRAYAL→… | M10 结局条件 | 个人目标强制全员叛变 |
| M08-6 | 临时联盟 | 10 | Lead + rivalLead + mediator | 共享范围受限 | duration, shareScope, exitCost | CONTACT→FORMATION→SPLIT | 危机合作 | 零成本反复进出 |
| M08-7 | 阵营影响公共任务 | 10 | Lead + rival + defector | 公共先结算 | publicTask, stance, sabotage | PRESSURE→RESOLUTION | M11 地点权限 | 拒绝参与成必胜 |
| M08-8 | 多阵营并存 | 12 | Lead + rival + thirdLead + members | 三营条件表 | conditionTable, campCountRule | FORMATION→SPLIT→CONSEQUENCE | M10/M11 | 阵营数接近玩家数 |

**合计 Variants：83**（均 ≥8；结构差异，非世界观换皮）。

## 每个子型要点

### M08-1 固定公开阵营
- **体验**：开场可见归属与目标，围绕公共任务/对峙做选择。
- **标准结构**：公开成形 → 压力/手段冲突 → 暴露或洗牌 → 后果。
- **不适用**：只贴阵营名而不产生行动差异。

### M08-2 固定隐藏阵营
- **体验**：秘密归属 + 可观察行动差；信息差驱动怀疑。
- **标准结构**：潜伏 → 接触/成形 → 压力 → 暴露。
- **不适用**：纯身份赌博、无结果可观察。

### M08-3 非对称阵营
- **体验**：不同接口/成功条件；可同成同败。
- **标准结构**：双线目标 → 共享状态争夺 → 条件表结算。
- **不适用**：一边人数一边信息双重碾压。

### M08-4 动态阵营
- **体验**：预设节点改归属；历史双轨不可追溯重算。
- **标准结构**：成形 → 节点触发 → 改属知情分层 → 后果。
- **不适用**：随时随意改属且重算旧贡献。

### M08-5 个人目标叠加阵营
- **体验**：阵营线与个人线独立结算。
- **标准结构**：双目标并行 → 忠诚冲突可选 → 双仪表结算。
- **不适用**：完成个人必须背叛阵营。

### M08-6 临时联盟
- **体验**：双确认短盟；有共享范围与退出成本。
- **标准结构**：接触 → 契约 → 共享 → 到期/退出。
- **不适用**：零成本刷盟、自动共享私人本。

### M08-7 阵营影响公共任务
- **体验**：公共任务可独立运行，阵营希望成/败/延迟/换方案。
- **标准结构**：定义公共任务 → 立场偏好 → 有配额破坏 → 先公共后阵营结算。
- **不适用**：拒绝参与即稳定通关。

### M08-8 多阵营并存
- **体验**：三营非对称条件表；防双盟永久压制第三方。
- **标准结构**：多营成形 → 短盟轮换 → 多档并存结算。
- **不适用**：阵营数接近玩家数。

## membership / information pattern

模板与 Variant 使用：

- **membershipVisibility / membershipPattern**：`PUBLIC` | `PRIVATE` | `PARTIAL` | `UNKNOWN_TO_MEMBER` | `ASYMMETRIC`
- **informationPattern**：`MEMBERS_MUTUAL` | `LEAD_ONLY` | `LEAD_ONLY_FULL_LIST` | `DIRECT_CONTACT_ONLY` | `ASYMMETRIC`
- **goalVisibility**（plot presets）：公开目标 / 成员共享秘密目标 / 每人理解不同 / 领导层隐藏真正目标

均为 Narrative Contract 数据，**不**实现 runtime 权限系统。

## 形式候选池

见 `M08_FORM_PRESETS`：成形原因、招募方式、背叛触发、暴露方式、保密规则、目标可见性。

## 与 ProjectStoryState

- 职责只写入 `roleAssignments[]`（`factionLead` / `memberA` / `memberB` / `hiddenMember` / `rivalLead` 等）
- **无** `factionLeaderCharacterIds` / `spyCharacterIds` 等专用全局字段
- 多人用多个命名 role key，由通用 Engine 绑定

## 推荐交织（integrationHints only）

| 交织 | 提示 |
|---|---|
| M08 × M01 | 真凶属某营、阵营掩护、嫁祸来自敌营、调查改站队 |
| M08 × M07 | 身份揭示改归属、记忆恢复暴露秘密、身份成加入资格 |
| M08 × M10 | 阵营存亡/选择成结局条件 |
| M08 × M11 | 地点权限阵营化、世界变化逼站队 |
