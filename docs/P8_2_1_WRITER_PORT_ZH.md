# P8.2.1 — Writer Port + Provenance Diff（无真实 LLM）

> 基线：`7f4fe63`（P8.2.0 Package / Gate / Packets FROZEN）  
> 原则：**Writer 只接 Packet；结构化正文 + 出处声明；越权硬 INVALID；Canon 只能 proposed。**

## 冻结链路

```text
PMD V2
  → ProductionGate
  → Packet Builder
  → ScriptWriterPort.write(packet)
  → Provenance Diff
  → Section States → CompleteScriptPackage
  → (显式 approve) READY_TO_COMPILE
  → 现有 Playable Compiler
```

禁止：`PMD ────────────→ Writer`

## 本刀交付

| 模块 | 文件 |
|---|---|
| WriterPort / 请求合同 | `shared/script-writer-port.js`, `script-writer-result-contracts.js` |
| Provenance Diff | `shared/script-writer-provenance-diff.js` |
| Deterministic Test Writer | `shared/deterministic-test-script-writer.js` |
| Orchestrator + approve | `shared/script-production-orchestrator.js` |
| Packet Fact ID 规范 | `shared/script-production-packets.js`（`allowedFactIds` = 真 factId；beats/clues/labels 分开） |
| 测试 | `scripts/script-writer-port.test.mjs` |

## Diff 状态

| status | 含义 |
|---|---|
| `CLEAN` | 出处全在 Packet；无 forbidden；无 proposed canon |
| `REVIEW_REQUIRED` | 结构合法但 `proposedCanonicalChanges > 0` |
| `INVALID` | 未知 beat/clue/fact、forbidden fact、新增 stage/角色、改 clue semantics、Ending 发明真相等 |

Role：`sourceFactId ∈ forbiddenFactIds` → **硬 INVALID**（无 warning）。

## Package 状态流

```text
DRAFT → Writer 完成 → READY_FOR_REVIEW → approveCompleteScriptPackage() → READY_TO_COMPILE
```

Writer 成功**不会**自动批准。有 proposed canon 或 INVALID section 时停在 `READY_FOR_REVIEW` / `INVALID`。

## PASS Gate（15）

1. Writer 只接 Packet，不接 PMD  
2. 返回结构化 sections  
3. 每 section 有 provenance  
4. beat/clue/fact 必须来自 Packet  
5. role forbidden fact → INVALID  
6. unknown source → INVALID  
7. 不得新增 stage  
8. 不得新增 character  
9. clue semantics/lifecycle 不得改  
10. Canon 只能 proposed  
11. clean → READY_FOR_REVIEW  
12. explicit approval → READY_TO_COMPILE  
13. DeterministicTestWriter 可复现  
14. bad-writer fixtures 全按预期失败  
15. GEN-01 → existing Compiler → Playable READY  

## 明确不做（留给 P8.2.2+）

真实 LLM、Prompt、Retry/Critic、genre、GAME/STORY 修补、UI、Compiler 改造。

下一刀：**P8.2.2 Full Production Vertical Slice** ✅（见 docs/P8_2_2_FULL_PRODUCTION_VERTICAL_SLICE_ZH.md）
