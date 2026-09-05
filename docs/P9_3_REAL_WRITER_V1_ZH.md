# P9.3 — Real Writer V1

> 基线：`57c83a0`（P9.2 GAME Narrative Binding FROZEN）  
> 原则：**把正确的结构 / 题材实体 / 玩法因果，写成可读自然语言；Writer 仍不是 Source of Truth。**

## 时代位置

```text
P9.0 Semantic Fidelity             ✅ FROZEN
P9.1 Context Instantiation         ✅ FROZEN
P9.2 GAME Narrative Binding        ✅ FROZEN @ 57c83a0
P9.3 Real Writer V1                ← 本刀
P9.4 Content Quality Gate          → next
```

## 链

```text
PMD + Context + GameNarrativePlan
  → Production Packets（薄投影）
  → RealScriptWriter (ScriptWriterPort)
  → ScriptWriterResult + WriterRunMetadata
  → Provenance Diff
  → CompleteScriptPackage (READY_FOR_REVIEW)
  → approveCompleteScriptPackage() → READY_TO_COMPILE
```

## 边界

| 可以动 | 禁止动 |
|---|---|
| RealScriptWriter 实现 Port | 改 ScriptWriterPort 形状 |
| Host/Role/Clue/Public/Ending Profiles | Whole-PMD 万能 Prompt |
| Packet 薄投影 Context/GAME | 改 Fact / Owner / Weave / Runtime |
| 一次 FORMAT_REPAIR | Critic / Agent loop |
| WriterRunMetadata / fingerprint / STALE | 自动 approve |
| regenerateJob(key) | 商业质量打分（P9.4） |

## 交付

| 文件 | 作用 |
|---|---|
| `shared/real-script-writer.js` | RealScriptWriter |
| `shared/script-writer-profiles.js` | 五类 Writer Profile + promptVersion |
| `shared/script-writer-llm-port.js` | 可注入 LLM（Mock 默认） |
| `shared/script-writer-format-repair.js` | Schema 解析 |
| `shared/script-writer-run-metadata.js` | fingerprint / metadata |
| `shared/script-writer-packet-enrichment.js` | Context + GAME → Packet |
| `shared/script-writer-mock-handlers.js` | CI 可控文学化 Mock |
| `shared/script-production-orchestrator.js` | enrich、metadata、STALE、regenerateJob |
| `scripts/real-script-writer.test.mjs` | PASS Gate |

`DeterministicTestScriptWriter` **保留**，作 regression baseline。

## Prompt Profiles

```text
HOST_WRITER_V1
ROLE_WRITER_V1
CLUE_WRITER_V1
PUBLIC_STAGE_WRITER_V1
ENDING_WRITER_V1
```

共享：不得新增 Canon / 人物 / 幕；不得改 clue semantics / GAME runtimeTruth；优先使用 packet 专有名词。

## Structured Output

- 正常输出 `ScriptWriterResult`
- Schema 失败最多 **1** 次 `FORMAT_REPAIR_ONLY`（`maxAttempts=2`）
- `proposedCanonicalChanges` 仍走 REVIEW
- Real Writer **永不**自动 `READY_TO_COMPILE`

## Lifecycle

- `WriterRunMetadata`：profile / model / promptVersion / fingerprints / attemptCount
- 上游 Context / GAME revision 变化 → section `STALE`
- `regenerateScriptProductionJob({ jobKey: "role:B" })`

## 代表证明（Mock LLM，无网络）

| Case | 证明 |
|---|---|
| GEN-03 | 空间站实体进入成品正文 |
| GEN-05 Plan | why/stake/outcome + winnerCount=1 进入 Host/Public |
| GEN-06 | 「两封没有寄出的信」贯穿正文 |
| Safety | 资料不足时不自选真凶 |
| Repair | 坏 JSON → 一次修复成功 |

> 注：GEN-05/06 结构 Gate 可能因 OWNER_UNRESOLVED BLOCK；Writer 渲染测使用 READY carrier（GEN-03）+ 对应 Context/Plan。

## 验证

```bash
node --test scripts/real-script-writer.test.mjs
node --test scripts/script-writer-port.test.mjs scripts/script-writer-provenance.test.mjs
node --test scripts/game-narrative-binding.test.mjs scripts/context-instantiation.test.mjs scripts/story-semantic-fidelity.test.mjs
npm run test:p8-generalization
node --test scripts/p8-full-production-vertical.test.mjs
npm run verify:playable
```

## 下一步

**P9.4 Content Quality Gate** — 评「写得够不够好 / 值不值得卖」，不回头扩架构。
