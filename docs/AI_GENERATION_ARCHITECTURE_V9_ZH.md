# AI 剧本杀生成架构 V9.0（冻结）

状态：冻结。**世界只生成一次，角色文本允许反复编辑。**

V6 的 World Engine（typed event、`commitEvent`、Observation / Knowledge）仍是事实层，版本仍是 `WORLD_ENGINE_VERSION = 6`。V9 拆开的是**生产流程**：不再要求第一遍 Renderer 直接出商业成品，也不再把文风问题和游戏问题混成一次返工。

合同枚举：`shared/world-engine/generation-architecture.js`（`GENERATION_ARCHITECTURE_VERSION = "9.0"`）。

改架构的条件：检测仪证明某一遍拿了不属于它的决定权（例如编辑补秘密、QA 失败却去润色、第一遍为「AI 味」推倒世界）。

---

## 三遍解决的是三件不同的事

| 遍 | 角色 | 求什么 | 允许 | 禁止 |
|---|---|---|---|---|
| 设计 | 作者 + World Engine | 故事与玩法结构稳定 | 改事件、关系、谁看见什么 | 写角色正文 |
| PASS 1 Writer | 初稿 | 写出来并且不乱 | 啰嗦、重复、不好看 | 越知识、改真相、漏人生、泄主持人信息 |
| 全桌阅读 | 诊断 | 单本看不出的平均化 | 只报警 | 不改稿、不改世界 |
| PASS 2 Editor | 编辑 | 像人写的、段段有推进 | 删压移改写合并 | 新事件、新关系、新秘密、改谁知道什么 |
| QA | 桌测 | 公平、好不好玩 | 只报警 | 不直接改文 |
| PASS 3 | 结构修复 | 只修检测出的结构 | 局部改事件/在场/证据足迹 | 全员重写、用编辑把角色「写有趣」 |

Canonical Truth 全程不动。动真相只能发生在 PASS 3 的上游结构修复，然后只重跑受影响角色：Writer → Editor。

---

## 总图

```text
             ┌─────────────────────┐
             │   创作设计 / 世界   │
             │ Premise / People    │
             │ History / Truth     │
             └──────────┬──────────┘
                        │
                        ▼
             ┌─────────────────────┐
             │ Game / Epistemic    │
             │ Hypothesis/Evidence │
             │ Experience/Memory   │
             └──────────┬──────────┘
                        │
                        ▼
                HOST TRUTH SHEET
                        │
                        ▼
             ┌─────────────────────┐
             │ PASS 1：角色初稿    │
             │ Coverage & Integrity│
             └──────────┬──────────┘
                        │
                        ▼
                  全桌共同阅读
                        │
                        ▼
             ┌─────────────────────┐
             │ PASS 2：编辑        │
             │ 压缩 / 重组 / 文风  │
             └──────────┬──────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │ Fairness + Fun QA      │
            └───────────┬────────────┘
                        │
              ┌─────────┴─────────┐
            PASS                FAIL
              │                   │
              ▼                   ▼
       Final Host Manual     定位上游问题
                                  │
                                  ▼
                         局部结构修复
                                  │
                                  ▼
                         受影响角色重跑
```

---

## 第一阶段：世界与游戏设计（不写角色正文）

```text
Dramatic Premise
  → Human World
  → Characters / Relationships
  → Event Ecology
  → Canonical Truth
  → Game Form
  → Hypothesis / Evidence
  → Experience / Knowledge
  → Current Situation
```

到这里系统必须已经知道：实际发生过什么、每个人是谁、经历过什么、谁知道/不知道什么、哪些错误认知是故意的、这一桌怎么玩、推理可能往哪走、证据从哪来。

**一个字角色本都还没有。**

主持人先出 **Host Truth Sheet**：Canonical Truth 的人读版，只为全程不乱。不是最终主持手册。

World Engine 绑定不变：事实是 ID，不是散文；碰撞必须共享资源；同屋才看见；Event Search 仍禁止把凶手/秘密/反转写成事实。

---

## PASS 1 — Writer（Draft）

目标：把每个人的人生和合法信息写出来。

只优化四件事：

1. **Coverage** — 该有的人生有没有写进去  
2. **Perspective Integrity** — 有没有写出他不可能知道的事  
3. **Cross-role Consistency** — 和别人的版本能否被真相层解释  
4. **Character Coherence** — 行为和已建立的生活、关系有没有明显冲突  

第一稿可以不漂亮。不要为「AI 味」在这一遍推倒世界。

硬失败（不是文风）：越知识边界、改真相、漏掉真正重要的历史、当前经历和别人冲突、人物不成立、主持人信息进玩家本。

---

## 全桌阅读（Whole-Cast Read）

必须一次读进所有角色。很多问题单本看不见。

**A. 单角色编辑**  
`semantic_redundancy` `background_overexplanation` `author_interpretation` `premature_summary` `procedural_overcoverage` `dialogue_redundancy` `timeline_like_narration` `profession_metaphor` `repeated_emotional_thesis` `weak_paragraph_progression` `event_to_explanation_redundancy`

**B. 全桌编辑**  
`cross_role_repetition` `voice_homogenization` `same_background_reexplained` `same_event_same_angle` `shared_fact_overexposure` `role_length_uniformity` `role_structure_uniformity`

例：三个人各自把「养育胜于血缘」解释四五遍 — 不是某一句差，是整桌过度消费同一命题。

---

## PASS 2 — Editor（Editorial）

不是重新创作。输入：该角色初稿、其 Knowledge/Experience、全桌初稿、编辑诊断。Canonical Truth **只验证，不准当素材新写**。

可做：删、压、移、改写、合并、重排信息位置、调段落、调对白/转述、调人物语言。

不可做：新世界事件、新重要关系、补秘密、改谁知道什么、改谁看见什么、改证据来源、创造新推理答案。

原则是 **Narrative Progress**：一段至少推进人生/关系/时间/局面/新人/旧事新义/行动/玩家判断材料之一。只换说法再说，优先压缩。

两种「重要」：

| 种类 | 例 | 编辑 |
|---|---|---|
| `FACT_REQUIRED` | 小蔓不是刘桂生亲生 | 必须保留 |
| `INTERPRETATION_OPTIONAL` | 「二十一年养育比血缘重要」 | 生活已经表达了就可以删 |

### Edit Provenance

每次大改记录：原段、为什么改、用了哪些 facts/events、删了什么、保留了什么、知识有没有变。`knowledge_changed` 必须为假。

---

## QA（必须在编辑之后）

第一稿噪声太大，拿去测「好不好玩」会分不清是游戏差还是文章烦。

顺序：结构稳定 → 初稿 → 编辑 → **再**测游戏。

### Fairness（不看文风）

真相可达、证据独立性、单点失败、错误假设能否排除、是否依赖主持人最后甩新证据、过强角色（动机+方法+时间+人物一人独揽）、过弱角色（无信息、无生活、无选择）。

### Interestingness（与公平分开）

可以公平但无聊（八人各说一句拼出答案）。要问：要不要判断、同一事实有没有不同合理解释、新信息会不会改写旧信息、有没有自身理由不立刻公开、有无不同个人关切、过去是否影响现在怎么说话、中途会不会改判断、有没有「我刚才理解错了」、主案之外桌上还有没有值得谈的人和事。

### QA 失败禁止改文

过弱角色 → 不是「写得更有趣」，是回 Character / Event / Epistemic：这人是不是真的缺少经历。  
某人看见 70% 当晚关键信息 → 不是把她的本删短，是上游 Experience 足迹没有自然分布。

然后只重写受影响角色。

---

## PASS 3 — Structural Repair

只在 QA 真的抓到结构问题时才跑。修的是「为什么不好玩」，不是「怎么写」。

可改：事件发生方式、是否在场、Evidence Footprint、假设排除路径、信息边界、是否需要加强私人历史。

`affected refs → affected roles`，局部重跑 Writer → Editor。不重写全桌。

---

## 主持人手册两个版本

| 产物 | 何时 | 是什么 |
|---|---|---|
| Host Truth Sheet | 世界设计刚完成 | Canonical Truth 人读版 |
| Final Host Manual | 公平性和角色本稳定后 | 卡点、开幕节奏、设计好的误会、主持人不能提前解释的话、推理路径、卡关提示、复盘 |

---

## Corpus Gate 怎么用

真人语料异常**先**进 Editorial Diagnosis，不要一异常就改世界架构。

例如初稿 `memory_triggered` 高、语义重复高、当前行动低：编辑阶段针对性压缩。

编辑之后还在，而且确实是因为角色只有过去、没有当前经历，才回到 Experience / Act Entry。

**写坏了**和**设计坏了**必须分开。这是 V6 检测仪和 Renderer 一直混在一起的原因。

---

## 允许的模型 / 禁止的模型

允许：`event_search` · `epistemic_proposal` · `view_selector` · `writer` · `editor` · `editorial_diagnoser` · `fairness_qa` · `interestingness_qa` · `host_truth_sheet` · `host_manual` · `semantic_verifier` · `corpus_labeler`

`renderer` 仍可作 PASS 1 的实现名，但成功标准是 Coverage & Integrity，不是商业文风。

禁止：`situation_writer` · `gameplay_writer` · `truth_rewriter` · `language_optimizer`（泛化润色岗；编辑必须走有 provenance 的 `editor`）· `relationship_fixer` · `act_designer` · `fun_rewriter` · `secret_injector` · `fairness_editor`

---

## 权力

| 权力 | 能做什么 | 不能做什么 |
|---|---|---|
| 事实权 World Engine | 实际发生过什么 | 主题、情绪、伏笔 |
| 候选权 Event Search | 提议 typed event | 写入历史 |
| 选择权 Author | 留 / 删 / 改，值不值得玩 | 发明世界规则 |
| 初稿权 Writer | 把合法人生写成中文 | 改谁知道什么；追求出版稿 |
| 编辑权 Editor | 提高段落有效推进量 | 改世界、补秘密、改证据 |
| 检查权 Gates / QA | 检测和报警 | 重写故事；用润色修公平 |

---

## 和 V6 的关系

V6 锁住了「模型不能拿事实权」。那一层仍有效。

V9 锁住了另一条：不要设计完美 Renderer。第一遍写坏一点没有关系。真正危险的是写坏以后分不清文字问题还是游戏问题，于是每次推倒世界。

商业流程对照：作者初稿 → 编辑修稿 → 桌测。没有人要求第一稿就是出版稿。

---

## 后继：V4.2 可执行规格（开发中）

V9 解决的是「三遍制生产流程」与 Prompt 边界。下一版生成架构改为 **IR + Orchestrator + Validator** 的软件系统，目标整体**替代** V9 式 Prompt Pipeline（接入产品尚未开始）。

规格与代码映射：[`AI_GENERATION_ARCHITECTURE_V4_2_ZH.md`](./AI_GENERATION_ARCHITECTURE_V4_2_ZH.md) · 实现包 [`v42-runtime/`](../v42-runtime/)

V9 在 V4.2 验收通过前仍为线上生成流程真相。
