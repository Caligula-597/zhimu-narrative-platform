# AI 剧本创作 · 生产向导验收（九层合同）

> 更新：2026-08-15。生产入口：`https://app.getzhimu.com`；代码：`src/views/pipeline-wizard-*.js`。

## 三端边界

| 域名 | 本流程负责的内容 |
|---|---|
| `app.getzhimu.com` | 创作、逐层审核、同步入库；API 基址为 `/api` |
| `host.getzhimu.com` | 执行主持手册、逐幕决定、默认推进和结局结算 |
| `play.getzhimu.com` | 阅读私人本、接收角色线索并参与运行时决定 |

向导不是一次性“写全文”按钮。前一层经人工锁定后才可进入下一层。这里的编号是作者确认顺序，不是失败后只能从①重跑的瀑布顺序：后端评判返回 `repairPlan + artifactDependencyManifest`，指出最早失败层以及精确 `targetPaths / invalidatesPaths`；评判页展示局部返工、100 局策略压力测试和六类红队结果。“前往最早返工层”只把真实依赖对象标成“局部过期”，保留其他正文、主持手册与线索。没有评判计划的任意上游重写仍采用保守的下游清理。

## 当前九层

| 层 | 作者确认的合同 | 硬门禁 |
|---|---|---|
| ① 创作立项 | 题材、玩法结构、人数、幕数、素材、禁区、玩家体验承诺、次日复述场面、世界专属动作 | `playStructure` 必须明确；三个概念凭证缺一不可，只有最终决定和通用行政动作时退回灵感层 |
| ② 世界与真相合同 | 玩家体验凭证、共同现实目标、客观事实与可拆分的 `truthNodes` | 至少 4 个真相节点，含主线 critical 与局部关系/支线节点；非推理题材不得强造凶手 |
| ③ 角色档案 | 欲望、私利、底线、失败代价、关系债、主动行动、完整认知、局部误读、人物—真相压力测试与 Agency/Dependency/Exposure | 角色不能成为 HOST 真相缩写；关键行动不符合人物利益时退回②/③；删角后必须损失具体行动、关系或判断路径 |
| ④ 稀疏线索网络 | 玩家可见内容、主持含义、持有人、解释者、误读者、取得方式、干扰与真实连接 | 默认私人/双人/小组线索；critical 双路径还要避免共同角色、解释者、唯一幕触发和同种推理；干扰区分高代价无痕、模糊痕迹与条件归因 |
| ⑤ 公共流程矩阵 | 连续场景、共享可见行为、探索/合作目标、逐幕决定、负向认知边界、角色×幕线索调度 | 不得新增或改写线索；非冲突场景可用误解、错过、克制、合作、假胜利或安静重估推进；正文前须通过静态 dry run |
| ⑥ 主持手册 | 开场、物料摆放、取得路径、决定程序、干扰代价、失败推进 | 私人线索只发给持有人；玩家不行动或一条线索缺失时仍能按独立路径继续 |
| ⑦ 逐幕剧本 | 每位角色在每幕的生活正文、当场行为与术语来源合同 | 只能读取本角色已取得线索与公共锚点，不读取其他玩家私人本；职业与声线不得授权新行话，表外专业词必须改回普通动作；正文通过真人化文本门禁 |
| ⑧ 评判 | 正文门禁、六类红队、100 局策略压力测试、字段级返工计划 | 策略模拟只判结构可达与抗破坏，不把 AI 反应当真人体验 |
| ⑨ 入库 | 机械编排、机制包、字段来源审计 | 预览显示 AI/人工/未知来源数量；入库写入 `pipelineGenerationAudit` 与实体 `generationTrace` |
| ⑧ 矩阵评判 | 真人感、线索拓扑、抗毁性、合作节奏、张力、一致性与六类红队桌测 | 关键项低于 7、high/blocked 红队发现或真人化门禁失败均不得同步；结果附局部返工路由 |
| ⑨ 机械入库 | 章节、场景、局部线索、显式线索边、角色、主持段、机制包 | 不再按数组顺序串联全部线索；先做全路径模拟再入库 |

## 可玩结构的唯一事实源

```text
世界与真相合同
  ├─ playerExperiencePromise：玩家亲自经历什么，而非最后决定什么
  ├─ retellableMoment：不靠中心思想也值得次日复述的具体场面
  ├─ worldSpecificActions：至少两种不能换行业照搬的动作
  ├─ sharedObjective：冲突中仍必须暂时合作完成的现实目标
  ├─ truthNodes：主线、支线、关系与背景事实
  ├─ objectiveFacts：可证实/证伪的客观事实
  ├─ endingAxes：玩家行动改变的数值状态
  └─ endingRoutes：机器可判定的最终后果
          ↓
角色档案（人物处境、主动行动、资源、关系债；权限按需而非每人强配）
  ├─ knownTruthNodeKeys：本人完整知道的节点
  ├─ partialTruths：本人看见的一截与可能坚持的误读
  ├─ truthStressTests：人物利益能否自然产生关键事实
  └─ agencyProfile：Agency / Dependency / Exposure / Removal Impact
          ↓
稀疏线索网络
  ├─ scope：private / pair / group / bridge / public_anchor 等
  ├─ holder / interpreter / misreader：看见、看懂与误读分离
  ├─ truthCoverage：critical 节点的线索、角色、解释者、幕与推理方式独立路径
  └─ links：只记录真实支持、矛盾、重释、解锁或回声关系
          ↓
公共流程矩阵
  ├─ actContracts.sceneSequence.observableBeats：全员共享的可观察现场
  ├─ temporarySharedGoal：探索、合作或恢复阶段
  ├─ rows.newClueIds：只调度线索网中已有线索
  ├─ decisions.options.axisEffects：主动选项如何改变结局轴
  ├─ decisions.defaultAxisEffects：超时/不行动如何改变结局轴
  ├─ endingRoutes：少量主结局
  └─ roleEpilogues：每名角色 2～3 个、读取同一组轴的个人余波
          ↓
主持手册 + 私人本 + Host/Player 运行时机制包
```

私人本不是另一份独立故事。公共地点、时间、在场角色、物料状态、决定和离场状态只能来自 `actContracts`。

逐幕剧本在生产环境默认使用场景化结构链：先从作者素材、当前角色物料与已授权线索形成带 provenance 的术语来源合同，再验收场景中的“原有压力—具体转折—可见差别”，随后分别形成动作事实和人物对白，最后才写正文。冲突场可以使用索取与抵抗，非冲突场禁止硬套该公式。同一术语合同会贯穿场景、动作、对白、成稿和重写，避免后一道“润色”重新发明行话。创作设定中的“玩家本视角”会成为全书人称合同：选择第一人称后，引号外只能用“我”；选择第二人称后，引号外只能用“你”。人称合同同时禁止第一人称角色替作者分析自己的完整动机。生成结果会保存 `prosePolicy` 和 `proseDiagnostics`；正文若混用人称、把矩阵字段压成自述、用连续短问答报数或把任务包装成旁白，会先被定向重写，重写仍失败则拒绝进入工作区。

## 生产 API

全部位于 `https://app.getzhimu.com/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/`：

| 层 | 路由尾部 |
|---|---|
| 真相 | `truth` |
| 角色 | `characters` |
| 线索网络 | `clue-network` |
| 公共流程矩阵 | `info-matrix` |
| 主持手册 | `host-runbook` |
| 私人本 | `player-script` |
| 评判 | `evaluate` |
| 入库预检 | `sync-preview` |

最终写入使用 `/api/worlds/:worldId/story-assistant/deepseek/pipeline/import`。生产请求由 Creator 同源发往 `/api`；Host 与 Player 的生产 API 基址统一为 `https://app.getzhimu.com/api`。

## 入库阻断条件

- 非推理题材出现为了补 schema 而虚构的凶手、死者或作案手法。
- AI 自主真相层把养老退休、人员失踪失联、旧单位改制或福利补偿分配写成核心题材。
- 缺少玩家体验承诺、次日复述场面或至少两种世界专属动作；题材只剩开会、签署、投票、选择版本与责任分配。
- 先给每名角色配发一项不可替代权限，再为权限粘贴职业与小传，形成表面对称的否决票角色。
- 所有机制选项都没有明确受益者、受损者和反制窗口，或合作选项没有写清代价；`dramaticTension < 7`。
- 将普通线索强行关联全员；公共锚点多于幕数；critical 真相的两条路径仍共同依赖同一角色、解释者、唯一幕或同种推理；线索可被毁换却没有代价，或痕迹强度与登记模式不符。
- 每幕只有对抗或投票，没有探索、暂时合作、恢复目标及其后续状态变化。
- 任一角色没有失败代价、关系债或至少两种主动行动；没有独占权限本身不构成失败。
- 人物压力测试要求 `truth_revision / character_revision` 却继续进入线索层；删去某角色后 Agency / Dependency / Exposure 都没有实质变化。
- 任一角色×幕缺格，或角色本自行改变公共场景事实。
- 角色在本幕尚无依据却提前推出 `forbiddenConclusions`；多人场景缺少共享 `observableBeats` 或各角色本改写了同一动作的参与者、物件和先后。
- 物料只能“阅读”，不能被玩家操作或参与结算。
- 两个选项写入完全相同的状态，或某幕选择不影响任何结局轴。
- 玩家超时/拒绝行动时没有 `defaultEffect + defaultAxisEffects`，或文字后果与状态写入不一致。
- 全路径模拟发现结局不可达或运行操作非法。
- 真人化文本门禁不通过，或评判结果 `readyForSync=false`。
- 利己隐瞒、沉默玩家、破坏线索、错误共识、新手主持或删角红队测试出现 high/blocked 结果。

## Session 真相源

```text
setting, synopsis, config,
truthBible,
characterArchives,
clueNetwork,
infoMatrix,
hostRunbooks,
scripts, evaluation, proposal,
locks, activeLayer,
repairPlan, artifactDependencyManifest
```

本地草稿键：`zhimuAiDraft:{worldId}:pipeline`。
