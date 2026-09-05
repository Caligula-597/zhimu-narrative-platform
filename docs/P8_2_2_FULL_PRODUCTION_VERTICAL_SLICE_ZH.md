# P8.2.2 — Full Production Vertical Slice

> 基线：`821c1ab`（P8.2.1 Writer Port FROZEN）  
> 原则：**组合证明**。不扩合同、不加 Writer 安全规则、不接真实 LLM、不改 Compiler/PMD 内核。

## 一句话

```text
GEN-01 ProductionMasterDraft V2
→ Gate → Packets → Writer → CompleteScriptPackage
→ Approve → PlayableProject
→ Existing Content Runtime
→ act1 → act2 → act3 → FINISHED（无 GAME · CONTENT_ONLY）
```

## 交付（薄）

| 文件 | 作用 |
|---|---|
| `shared/full-production-coverage.js` | 只读 Coverage / clue e2e / section→ContentUnit 回溯 |
| `scripts/p8-full-production-vertical.mjs` | FullProductionVerticalRunner + captures |
| `scripts/p8-full-production-vertical.test.mjs` | PASS Gate |
| `captures/p8-full-production/GEN-01/*` | package / playable / coverage / runtime-trace |

## 为串链做的极薄修补（非新中间层）

1. **Ending → Compile source**：adapter 把 `endingContent.sections` 映射为终幕 `publicScripts`（REVEAL），否则 Ending 写了也进不了 Playable。
2. **无 GAME finish**：`canFinishPlayableSession` 在终幕无 required placement 时允许 CONTENT_ONLY 结束（不强制 M09）。
3. **NPC 不可派发**：`NPC_*` → `playerAssignable: false`；start 只要求可派发 PLAYER（GEN-01 = 5）。

## PASS 摘要

Production / Coverage / Compile / Runtime / Trace / Regression — 见测试文件断言。

## 正式裁决（本刀通过后）

```text
Full Script Production Infrastructure ✅ PASS

From-zero Technical Vertical Slice:
Creation Intent → STORY → Master Outline → PMD V2
→ CompleteScriptPackage → PlayableProject → Runtime
✅ CLOSED
```

技术闭环 ≠ 商业内容质量。下一阶段切到题材实例化 / Variant / M01 crime-false / GAME narrative / 真实 Writer。

**不要再开 P8.2.3 补基础架构。**
