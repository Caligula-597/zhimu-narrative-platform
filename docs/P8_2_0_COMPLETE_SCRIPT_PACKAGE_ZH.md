# P8.2.0 — CompleteScriptPackage + Packetization（无 LLM）

> 基线：`c930aa1`（P8.1 PlayableCreationSpec）  
> 本刀：锁 **CompleteScriptPackage 合同 / ProductionGate / View Packets / Validator / Playable 适配**。  
> **不接 Writer / LLM**；不改 P6/P7；不自动发明 GAME。

## 链路（冻结）

```text
ProductionMasterDraft V2
  → Script Production Gate
  → View-specific Packet Set
  → (P8.2.1 Writer Port …)
  → CompleteScriptPackage
  → toPlayableCompileSource()
  → existing compilePlayableProject()
  → PlayableProject → P7 Runtime
```

原则：**LLM 负责写；确定性层决定它能写什么。** 本刀尚未接 Writer。

## 模块

| 文件 | 职责 |
|---|---|
| `shared/complete-script-package-contracts.js` | Package V1（warehouse-six 同形） |
| `shared/script-production-gate.js` | blockers / fillable / advisories |
| `shared/script-production-packets.js` | Host / Role / Clue / Public / Ending |
| `shared/complete-script-draft-assembler.js` | 确定性草稿（拷贝 PMD 字段，非写作） |
| `shared/complete-script-validator.js` | 结构 / lifecycle / 禁新增 stage·role |
| `shared/complete-script-playable-adapter.js` | Package → Compiler source |

## Gate 分类

| Warning | 行为 |
|---|---|
| OWNER_UNRESOLVED / AMBIGUOUS / UNRESOLVED_CONFLICT / MISSING_CAUSAL_LINK | **BLOCK** |
| MISSING_CLUE_DETAIL | fillable（Writer 可补表象） |
| STAGE_CROWDING / LOW_WEAVE / PARALLEL / ROLE_OVERLOAD | advisory |

## Packet 边界

- **Role**：以 `contributions[]` 为主；带 `allowedFactIds` / `forbiddenFactIds`  
- **Host**：可读 truthView + 全线索 + executionView  
- **Clue**：只具体化；不得改 `isMisleading` / `isDecisive`  
- **Ending**：无必填 `correctCulpritId`；`resolutionMode` 可推导  
- **GAME**：`mechanismAnnotations = []` 合法（无 placement 不发明）

## 代表样本

**GEN-01**：5 人 / 3 幕 / M01+M07 / 无 GAME / 结构 PASS。  
证明：Gate → Packets → Draft Package → `compilePlayableProject` → **READY**。

## 验证

```bash
node --test scripts/complete-script-package.test.mjs
node --test scripts/playable-creation-spec.test.mjs scripts/p8-generalization.test.mjs
npm run verify:playable
```

## 下一刀

```text
P8.2.1 Writer Port + Provenance Diff ✅（见 docs/P8_2_1_WRITER_PORT_ZH.md）
P8.2.2 Full Production Vertical Slice ✅（见 docs/P8_2_2_FULL_PRODUCTION_VERTICAL_SLICE_ZH.md）
  （deterministic test writer，仍可不接真实 LLM）
↓
P8.2.2 全链代表 fixture 证明
```
