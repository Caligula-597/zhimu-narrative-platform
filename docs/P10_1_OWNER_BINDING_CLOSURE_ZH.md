# P10.1 — Owner Binding Closure

> 基线：P10.0 Audit @ `47f223a`  
> 问题：5/8 GEN 卡在 Production Gate（`OWNER_UNRESOLVED`），不是文风问题。  
> 原则：**补齐 OWNER 绑定闭环；不放宽 P9 Quality Gate；不 silent pick 任意角色为 OWNER。**

## 时代位置

```text
P9 Content Factory Foundation        ✅ CLOSED
P10.0 Generated Script Quality Audit ✅ 首报（3/8 可写）
P10.1 Owner Binding Closure          ← 本刀
P10.0 Re-audit                       → 确认 ≥7/8 可生产
★ Real Production Trial #1           ✅ CLOSED · TRIAL_PARTIAL
★ P10.2 Creation Intent Fidelity V1  ← NOW（见 P10_2_CREATION_INTENT_FIDELITY_ZH.md）
Writer V2                            🚫 NOT NOW
```

## 根因

```text
Complete Beat Semantics（M08 phase2）
  primaryRole = "defector"
        ↓
M08-1 / M08-3 / M08-6 的 roleSlots 未包含 defector
        ↓
bindRoles 从不绑定
        ↓
OWNER_UNRESOLVED → Production BLOCKED
```

次要：`INTENTIONAL_OVERLAP_CANDIDATE`（真凶∩阵营领袖）被误映射成 `UNRESOLVED_CONFLICT` 硬阻断。

## 做法

| 改动 | 说明 |
|---|---|
| `listPrimaryOwnerSlots(templateId)` | 从 Complete Beat 抽出必须绑定的 OWNER 槽 |
| `bindRoles` Owner Closure | 先绑 required/OWNER 槽；缺槽用 soft def；池尽时允许 defector 复用 memberA/B（显式 closure，非猜姓名） |
| M08-1/3/6 `roleKeys` 加入 `defector` | 数据与语义对齐 |
| Expander + Production Gate | `INTENTIONAL_OVERLAP_CANDIDATE` → advisory |

**禁止**：CharacterView 猜 OWNER、`characterIds[0]`、为刷分改 P9.4。

## PASS

```text
✅ GEN-02/04/05/06/07 不再因 OWNER_UNRESOLVED BLOCK
✅ 8/8 Production Gate ≠ BLOCKED（或 ≥7/8）
✅ INTENTIONAL_OVERLAP 不阻断生产
✅ P8 GEN machine / beat-owner-authority / P9 regression 绿
✅ P10.0 re-audit scoredSize ≥ 7
```

## 验证

```bash
node --test scripts/owner-binding-closure.test.mjs
node scripts/generated-script-quality-audit.mjs
node --test scripts/generated-script-quality-audit.test.mjs
npm run test:p8-generalization
```

## 下一步

**P10.2 Creation Intent Fidelity V1** — [`P10_2_CREATION_INTENT_FIDELITY_ZH.md`](./P10_2_CREATION_INTENT_FIDELITY_ZH.md)。  
Writer V2 / Context Domain：**NOT NOW**。
