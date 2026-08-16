# 织幕 · AI 创作流水线提示词合同

> 更新：2026-08-15。UI 与生产路由见 [AI_PIPELINE_UI_ZH.md](./AI_PIPELINE_UI_ZH.md)。

生成顺序必须是：

```text
作者素材/灵感 → 玩家体验承诺与概念门禁 → 玩法类型（仅分流）
→ 世界与真相合同 → 人物处境与关系 → 稀疏线索网络
→ 公共幕与机制合同 → 主持执行合同
→ 单角色逐幕正文 → 机器评判 → 路径模拟 → 入库
```

这是一条**作者确认顺序**，不是失败后必须从头再跑的瀑布线。系统同时维护 `source → truth → characters → clues → matrix → outlines → scripts/host → evaluation` 依赖图。下游失败由 `repairPlan.targetStage` 路由到最早出错层，只重算该层及其依赖产物：文风问题不改真相，认知泄漏退回分幕纲要/正文，线索瓶颈只退回线索网；只有原素材忠实度、客观事实或人物因果证明失败时才回到上游。

禁止逆向采用“先想立意 → 分配观点席位 → 让人物轮流发言 → 作者给答案”。作者可以有明确答案，但平台不能把它编码成玩家必须抵达的唯一正确结局；作者立场必须先成为会改变人物行动、关系与代价的一股力量。

这里的顺序与创作驾驶舱“概念 → 架构 → 人物 → 流程 → 文稿”完全对应。`centralQuestion`、`endingAxes`、权限、物料和结算字段只能验证已经成立的体验，不能作为 AI 倒推题材和人物的起点。详细纲领见 [AI真人化叙事创作核心原则.md](./AI真人化叙事创作核心原则.md)。

AI 自主选题禁止回落到养老/退休待遇、人员失踪失联、旧单位改制和福利补偿分配等反复使用的安全现实主义母题。创作者原始素材明确指定时只做忠实改编；模型不得自行补入，也不得通过换机构、换年代或换物件规避。

## 1. 创作立项

立项先完成三个概念证明：

- `playerExperiencePromise`：玩家会亲自经历什么，不是最后决定什么；
- `retellableMoment`：一个不依赖中心思想也值得次日复述的具体场面；
- `worldSpecificActions`：至少两种只有在本题材、身份和场所中成立，并会改变下一幕现实的动作。

缺少任一项，或题材只能概括成“利益相关者限时开会、交换权限、签字投票、选择版本或分配责任”，真相层必须拒收并退回概念阶段。不得用“每人一项不可替代权限”代替人物非对称。

`setting.playStructure` 是整个流水线的分流键：

| 值 | 主要推进力 | 必须有凶手 |
|---|---|---|
| `mystery` | 可还原事实、嫌疑与证据链 | 是 |
| `faction` | 利益、资源、结盟与背叛 | 否 |
| `mechanism` | 多轮操作及累积后果 | 否 |
| `hybrid` | 事实还原与博弈共同推进 | 否 |

所有后续请求必须携带完整 `setting + synopsis + config`，并注入创作驾驶舱已确认的故事脊柱、创作宪法与机制设计。不能只传标题。

## 2. 世界与真相合同

提示词：`backend/src/prompts/truth-bible.js`。

- `objectiveFacts` 只登记可观察、可证实或可证伪的事件。
- `truthNodes` 把完整真相拆为 mainline / branch / relationship / context 节点；至少包含 critical 主线节点与 local/relationship 局部节点。
- `sharedObjective` 是人物仍在冲突时也不得不暂时合作完成的现实事项，不等同于最终问题。
- `playerExperiencePromise + retellableMoment + worldSpecificActions` 是概念阶段凭证；它们先于核心决定存在。
- `centralQuestion` 是全桌最后必须完成的具体决定，不是主题句。
- `publicCrisis + irreversibleDeadline` 解释角色为什么今天不能离场。
- `publicCrisis` 必须由人物已经实施的不可撤销行动引爆，不能只是召集众人协商分配。
- `endingAxes` 是叙事层聚合状态，建议 2–5 条、最多 6 条；金额、好感和物件位置等细变量留在运行时状态，不全部升级为结局轴。
- 主 `endingRoutes` 最多 8 条；每名角色另有 2–3 个 `roleEpilogues.variants`，它们读取同一组 `endingAxes`，不新增平行积分，不把“成长/报应/和解”当默认收束。
- `endingRoutes` 为 3–8 条，恰好 1 条默认路线；其余路线必须写机器可判断的轴条件。作者可以有倾向，但不得把某一路线编码成唯一道德正确答案。
- 只有 `mystery` 强制 `killer + method`。其他结构没有凶案时必须返回空值。

## 3. 角色档案

提示词：`backend/src/prompts/character-archives.js`。

每个角色必须同时具备：眼下欲望、私人利益、不可退让项、失败代价、至少两种主动行动、可操作资源和至少一笔指向其他角色的关系债。独占/稀缺决策权只有在既有身份与关系确实产生时才登记，允许部分角色没有；不得为了整齐给每人强造一项权限。观点、性格和秘密不能替代行动能力。

角色不是“女权主义者”“社达主义者”一类观点容器。立场必须从其账户、关系、承诺、工作和正在失去的东西中长出来。

每人通过 `knownTruthNodeKeys` 登记真正完整知道的节点，通过 `partialTruths` 登记自己亲历的一截、误读与取得时间。信息不按人数平均；两个人的旧事允许只属于两个人。

人物层必须反压真相层，而不是被动给既定真相分配执行者。每个 critical `truthNode` 都要有 `truthStressTests`：列出涉及角色、关系—利益—压力链与 `credible / character_revision / truth_revision` 结论。若人物没有理由做出关键行动，流程停在②/③之间，不能用“一时冲动”补洞后继续铺线索。

可玩结构中的每位角色同时提交 `agencyProfile`：`agencyProof`（能主动改变什么）、`dependencyProof`（别人为何绕不过他）、`exposurePlan`（在哪些核心互动中作用于谁）和 `removalImpact`（删掉后具体断掉什么）。平衡看 Agency / Dependency / Exposure，不看台词数、线索数是否平均。

## 4. 稀疏线索网络

提示词：`backend/src/prompts/clue-network.js`。

- 完整真相只存在于 HOST `truthNodes`；单张线索的 `description` 只写可观察内容，结论放在 `hostMeaning`。
- 默认用 `private / pair / group`；`holderRoleKeys`、`interpreterRoleKeys` 与 `misreaderRoleKeys` 分开。
- `public_anchor` 只服务会改变全桌现实的事件，原则上不超过幕数。不得因为大家能看到就把所有人写成私人关联者。
- critical 真相至少两条不共用线索且渠道不同的还原路径；每条同时登记 `requiredRoleKeys / requiredInterpreterRoleKeys / requiredActKeys / reasoningMode`。两条路径不能换了卡片却仍共同依赖同一人开口、同一解释者、同一幕唯一触发或同一种推理。
- hide / destroy / swap 必须有真实代价，但不再规定“一干扰必留可归因痕迹”。`traceMode` 分为高代价无痕 `none_high_cost`、只能证明发生过干扰的 `ambiguous` 和满足条件后才可归人的 `attributable`。
- `links` 只登记真实 supports / contradicts / recontextualizes / unlocks / echoes；严禁按数组顺序把全部线索串成主线。

## 5. 公共流程矩阵与幕合同

提示词：`backend/src/prompts/info-matrix.js`。

先生成 `actContracts`，后生成角色 `rows`：

- 每幕至少两个连续公共场景；每场写明地点、时间、在场角色、入场动作和离场状态变化。多人现场另写 `observableBeats`，锁定双方都看得见/听得见的人物、原话或动作、物件与先后；`shared` 事实各角色本必须一致，`disputed / partial` 只允许解释不同。
- 场景使用 `changeMode`。冲突场才要求争夺对象与双方不可兼得；误解、错过、共同克制、合作、假胜利和安静重估场用“原有压力—具体转折—可见差别”证明有效，不能统一改写成索取—拒绝—倒计时。
- 每幕填写 `temporarySharedGoal + cooperationPayoff`，并至少有一个 exploration / cooperation / recovery 场景。合作提供继续行动的条件，不负责让人物和解。
- 每幕恰好一个不可跳过的 `decision`；选项不得等价，每个选项至少改变一个 `endingAxis`。
- 每个决定至少有一个明确受益者、受损者和反制窗口的尖锐选项；其他探索/合作选项允许不直接伤人，但必须填写具体 `tradeoff`。
- 玩家不行动也写 `defaultEffect + defaultAxisEffects`；默认推进必须像主动选项一样进入结局轴，不能只在主持文案里发生。
- 本层不能新增、改写或扩大线索范围；只能把上一层线索调度到场景与 `rows.newClueIds`。`auto` 只表示自动发给既定持有人，不表示全桌公开。
- `rows` 完整覆盖角色×幕，只能调用角色档案已经登记的权限、资源和关系债。
- `rows` 除正向来源外，还登记 `notYetInferred / forbiddenConclusions / allowedSuspicionRange`：角色不仅不能知道某事实，也不能在证据尚未到位时提前推导到作者答案。

`actContracts` 是主持手册和所有私人本的唯一公共事实源。后续提示词不得自行补地点、时间线或公共反转。

进入正文前执行静态 dry run：检查角色×幕空转、探索线索没有落点、共享场景缺少可见转折、删除角色后几乎无影响，以及名义双路径的共同瓶颈。失败只退回矩阵或线索层。

## 6. 主持手册

提示词：`backend/src/prompts/host-runbook.js`。

每幕必须给出可直接执行的开场朗读、目标、物料摆放与允许操作、决定程序、失败推进和结束条件。主持人负责确认玩家已经做出的行动，不替作者讲道理，也不替玩家选择。

## 7. 私人本正文

核心提示词：`backend/src/prompts/matrix-structured-script.js`、`matrix-player-script.js` 与 `human-authorship.js`。

生产默认链路固定为：`术语来源合同 → 场景合同 → 动作事实 → 人物对白 → 首次成稿 → 真人化门禁 → 定向重写/拒收`。术语合同并非让模型堆专业词，而是关闭无来源造词：作者素材、已确认物料与当前角色已授权线索之外的精确行业词一律不得进入正文；角色职业、`voiceHints`、时代氛围和文风预设不能授权新名词。找不到来源时写普通可见动作，确需考证时标记 `terminology_research_required`。前端不再请求“把矩阵行直接改写成正文”的旧模式。兼容的单章分幕与总剧情拆角色接口也必须注入同一套真人化宪法；成稿命中 `matrix_serialization`、电报式对白链、任务包装或作者代替人物总结时，不得写入工作区。

- 输入只使用已锁定的角色档案、对应矩阵格和该角色实际在场的共享场景。
- 线索账本只包含本角色此前取得的线索与公共锚点；生成时不再向模型提供其他玩家的正文摘要。
- 正文写角色如何生活、误判、试探、行动和承受，不把 tasks 改写成旁白清单。
- 禁止用全知旁白替角色解释“你不是……你只是……”“你一直这样告诉自己”。
- 每部角色本在生成前锁定第一人称“我”或第二人称“你”，引号外的叙述、回忆、心理与场景过渡全程一致；不得在分幕或修稿时换人称，也不得用角色姓名旁观自己。
- 第一人称不等于角色给自己写人物分析。“我之所以……是因为……”“我知道自己为什么……”“我很清楚自己真正害怕的是……”仍属于作者解释，应改成角色当时的动作、借口、改口与后果。
- 禁止连续使用“问一句—答几个字—再问—报数字”的对白阶梯；金额、期限和责任必须经过人物的护短、回避、旧账或误解进入场景，不能像客服查询一样逐字段返回。
- 禁止把上一段关键词换成“我/我的……也……”回扣成金句。命中后须重写整场交谈，不能只把短句合并成一个段落。
- 禁止把“口语化”解释成所有台词都要短、断、碎；句长由人物关系和当下企图决定。每个角色只使用其年龄、职业、教育与生活经验允许的词汇，不能全员共享合同顾问腔。
- 禁止在正文用“我可以……也可以……”替玩家列完整策略菜单；选择与结算属于机制字段，正文只提供足以让玩家自己产生行动的处境。
- 禁止结尾自动和解、报应或作者判词。
- 文风门禁只是最后一道检查；结构仍然观点化时，不能靠口语化或增加感官细节假装修好。
- 每份成稿保存 `prosePolicy` 与 `proseDiagnostics`，其中包含 `terminologyGroundingVersion`，标明实际使用的生成宪法、术语门禁、文本门禁版本和命中证据；旧内容不能借一次新评分冒充已按新流程生成。

## 8. 评判和机械入库

评判至少覆盖：事实一致性、信息可还原性、线索拓扑、线索抗毁、合作节奏、角色能动性、物料可操作性、共享场景一致性、文本真人感、戏剧张力和结局因果。另做利己隐瞒者、沉默玩家、线索破坏者、错误共识、新手主持和逐个删角六类红队桌测；出现 high/blocked 发现时不得同步。`clueTopology / clueResilience / cooperationRhythm / dramaticTension` 任一低于 7 时不得同步或进入真人测试。

这里的公平只保证规则清楚、关键事实可获得、受损者有反制机会；它不保证收益、损失、戏份、道德评价与结局奖惩对称。若连续多幕只有协商、表态、共同投票或平均分配，张力最高只能评 4 分。

入库时把 `decisions.options.axisEffects` 与 `decisions.defaultAxisEffects` 编译为 Host/Player 共用的运行时状态写入，把 `endingRoutes` 编译为结局判定。模拟器枚举包含超时在内的完整路径；等价选项、不可达结局、非法写入或无默认推进均为阻断错误。

评判结果同时附 `repairPlan` 和 `artifactDependencyManifest`。前者给出最早返工层以及 `targetPaths / invalidatesPaths`；后者为真相节点、角色、线索、矩阵格、正文格和主持幕保存字段级指纹与依赖。创作端只把精确对象标为“局部过期”，保留无关成稿。重新入库时，session 中的 provider/model/生成时间与人工编辑记录会合并成 `pipelineGenerationAudit` 并写入 world settings 和实体 metadata。

可玩结构在⑤完成后执行 100 局确定性策略压力测试，覆盖合作、利己、隐瞒、沉默、破坏和机会主义组合，检查默认推进率、关键真相还原、结局可达/集中及角色是否从未关键。该测试只证明结构抗压，不预测真人是否感动、是否愿意表演，不能代替真人桌测。

这意味着“提示词生成成功”不等于“剧本完成”。只有通过验证器、文本门禁、红队评判和运行时路径模拟后，内容才能进入 `host.getzhimu.com` 与 `play.getzhimu.com`。
