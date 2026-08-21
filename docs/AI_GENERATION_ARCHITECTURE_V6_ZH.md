# AI 剧本杀生成架构 V6.0（历史冻结）

状态：世界事实层仍有效（`WORLD_ENGINE_VERSION = 6`）。**生成流程已被 [V9.0 三遍制](./AI_GENERATION_ARCHITECTURE_V9_ZH.md) 取代。**

V6 锁的是：禁止把「某一句难看」写成新的 Renderer 提示词；模型不能拿事实权。V9 在此之上拆开 Writer / Editor / QA，世界只生成一次。

完整条文以当时会话中的《AI 剧本杀生成系统设计书 V6.0》为准。合同枚举已迁到 `generation-architecture.js` 的 9.0。下面保留 V6 当时的合同原文，便于对照；**不要按本节生产链实现新功能。**

## 已有代码绑定

现有 `shared/world-engine`（`WORLD_ENGINE_VERSION = 6`）已经覆盖：typed action、append-only `commitEvent`、Reducer（持有/现金/债务/权限）、Observation / Knowledge / Memory transform、由物件能力编译 Action Space。

尚未建成、不得用 Prompt 顶替的层：

- Play IR + 资源碰撞枚举
- Act Entry + Runtime Log
- Interaction IR
- Action / Conversation Compression（编译器已有雏形：`scripts/narrative-compression.mjs`）
- Narrative IR（ID + 封闭 semantic token）
- Provenance / Speech / Channel / Compression Gates

合同枚举在 `shared/world-engine/generation-architecture.js`。

## 五种权力

| 权力 | 层 | 能做什么 | 不能做什么 |
|---|---|---|---|
| 事实权 | World Engine | 实际发生过什么 | 主题、情绪、伏笔 |
| 候选权 | Event Search | 提议 typed event | 写入历史 |
| 选择权 | Author | 留 / 删 / 改，值不值得玩 | 发明世界规则 |
| 表达权 | Renderer | 已确定内容如何写成中文 | 何时发生、谁知道、谁开口、是否问答、什么重要 |
| 检查权 | Gates / Corpus | 检测和报警 | 重写故事 |

衡量一次模型调用是否危险，问的是**语义决定权**，不是调用次数。

## 生产链（程序函数为主）

```text
AUTHOR SEED → EVENT SEARCH → 作者取舍 → EVENT STORE → REDUCERS
→ COLLISION ENUMERATOR → 作者挑选 → PLAY IR → ACT ENTRY → RUNTIME LOG
→ INTERACTION IR + EPISTEMIC IR → COMPRESSION → NARRATIVE IR
→ RENDERER → HARD GATES → 局部 RERENDER → CORPUS DASHBOARD → HUMAN READ
```

禁止 Situation Writer / Gameplay Writer / Truth Rewriter。

## 返工表（不得跨层乱改）

| 异常 | 返工 |
|---|---|
| `opening_state_saturation` | Act Entry |
| `historical_reveal_dominance` | Act Entry / Narrative Candidate |
| `procedural_overcoverage` | Action Compression |
| `invented_speech_act` | Interaction IR |
| `excessive_direct_qa` | Interaction `render_mode` |
| `runtime_event_backfill` | Runtime Log |
| `acquisition_channel_drift` | 局部 rerender |
| `unsupported_interpretation` | 局部句子或补合法 Belief |
| `unearned_compression` | Preference Corpus，不改 World / Play |
| `thematic_collision` | 碰撞选择，主题相似不构成碰撞 |
| `affordance_backfill` | Substrate，禁止为玩法后补物件 |

测试 A 证明 Act Entry 有效。测试 B 证明下一刀是 Compression，不是推翻 Act Entry。

## 允许的 LLM

`event_search` · `epistemic_proposal`（可选）· `view_selector`（只能 SELECT / OMIT / SLOT）· `renderer`（极短 prompt）· `semantic_verifier`（只判 refs 是否支持句子，不重写）· `corpus_labeler`（离线，不进创作链）

## 第一版 Definition of Done

在讨论文风之前，必须先通过 `DEFINITION_OF_DONE` 十条：无物不能写出、无电话不能响、无 Interaction 不能问、reported 不能多轮对白、observed 不能改成「他告诉你」、routine packet 不能拆成五步、无 trigger 的旧事实不能想起、实义命题必须有 provenance、碰撞必须共享资源、同一 World 换角色不改 World Truth。

## 语料检测仪

`v2-axes-gold` 只校准、不立法。不追交谈比例、不追 incidental、不硬压 memory_share。结构指标：`procedural_overcoverage`、`action_information_yield`、`dialogue_yield`、`memory_payload_size`、channel HHI。

## 冻结后的开发顺序

1. Event Store（已有 ledger 上补稳定 ID / 版本 / stale 重编译）
2. Epistemic（已有 Observation，补 Claim 与 acquisition 锁）
3. Collision Enumerator（无 Situation LLM）
4. Play IR + Act Entry + Runtime Log
5. Interaction IR
6. Compression
7. Narrative IR
8. 极短 Renderer
9. Hard Gates
10. Corpus Dashboard

下一轮测新剧本，必须先给出 World IR → Play IR → Runtime Log → Interaction IR → Narrative IR，再单独渲染。不允许「按架构记住规则直接写」。
