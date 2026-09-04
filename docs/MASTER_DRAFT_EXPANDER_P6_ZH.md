# P6 Master Draft Expander — 范围冻结（原型阶段）

> 裁决来源：`captures/integrator-product-trial-v1/SCORECARD.md`（commit `f954d9d`）  
> DEV A–E **3.57** · Held-out F–H **3.44** → **P5.2 PASS** → P6 可进原型。

## 一句话

**只把现有 `MasterOutlineDraft` 展开成可审阅的生产母稿。**  
不允许静默重排阶段；不允许靠文学润色伪造新的因果或交织。

## 产品定位（克制理解）

| 现在是 | 现在不是 |
|---|---|
| 诚实的结构编排器 + 少量真实交织 | 自动戏剧编剧 |
| 可展开、可审阅、可局部改 | 一键写出成熟整本大纲 |

Integrator 已知债务（P6 **不得掩盖**）：

1. **Stage rhythm / band 聚集**（B、C、G）— 多 beat 挤进单一阶段  
2. **真正交织密度偏低**（A/D/F 仅 1 条 INTERWOVEN；H 为 0）

## 允许

```text
MasterOutlineDraft
  → MasterDraftDocument（生产母稿草稿）
       · 按既有 stages / beats / weaveLinks / conflicts 展开
       · 每个 beat → 可读段落（角色目标·行动·后果，尊重 BeatSemantics）
       · 标注 relationQuality（INTERWOVEN / COLOCATED / PARALLEL）
       · NEEDS_DETAIL / 缺语义处显式标出，不瞎编
       · 可选：轻量 LLM 只做「同结构展开措辞」，输入必须锁定 outline 节点
```

## 禁止

- 静默重排 / 合并 / 拆分阶段或 beat 顺序  
- 新增未在 draft 中声明的因果、共享行动、交织边  
- 把 `COLOCATED` / `KEEP_PARALLEL` 润色成「看起来交织」  
- 用文学描写填平空阶段或节奏拥挤  
- 整本一次 LLM rewrite（把积木扔进模型重写大纲）  
- M10/M11 Content Pack、STORY runtime、GAME、世界域、Canon、v42

## 结构变更通道

若 Expander 发现「这两条必须重新织」：

```text
输出 StructureChangeRequest[]
  → 回报 Integrator（proposeWeave / split / move …）
  → 用户确认后改 MasterOutlineDraft
  → 再重新 Expand
```

**禁止** Expander 自己改 `stages` / `weaveLinks` 后当作成品。

## 建议输出形状（原型）

```ts
MasterDraftDocument {
  sourceOutlineId: string;
  sourceStoryStateRevision: number;
  status: "DRAFT" | "USER_REVIEWED";
  chapters: [{
    stageId: string;
    stageLabel: string;
    sections: [{
      outlineBeatId: string;
      prose: string;                 // 可审阅正文
      agency: { actor, goal, action, consequence? };
      relationNotes: string[];       // 引用已有 weave WHY，不发明
      flags: ("NEEDS_DETAIL" | "PARALLEL_LINE" | "COLOCATED_ONLY")[];
    }];
  }];
  structureChangeRequests: StructureChangeRequest[]; // 可空
  warnings: string[];              // 节奏拥挤、交织稀薄等诚实警告
}
```

## Gate（原型过线建议）

- 展开后 stage 顺序 / beat 集合与源 `MasterOutlineDraft` **一一对应**（可测）  
- 无新增 `weaveLinks`；文中声称的交织必须能指回已有 INTERWOVEN 边  
- `KEEP_PARALLEL` 线在正文中仍可读作平行（不得写成强交织）  
- StructureChangeRequest 若有，不得自动应用  
- 局部编辑（移动/拆开等）仍走 Integrator，Expand 可重跑

## 与债务的关系

| 债务 | P6 态度 |
|---|---|
| B/C/G 阶段拥挤 | `warnings` 诚实标出；修 rhythm → 回 Integrator，不在 P6 藏 |
| A/D/F/H 交织稀薄 | 正文保持稀薄；要加交织 → StructureChangeRequest |
| F–H held-out | 已 sealed；再改 Integrator 算法不得用 F–H 证明泛化 |

## 状态

```text
P5 Integrator Prototype       ✅
P5.1 Product Trial            ❌
P5.2 Semantic Bridge          ✅ PASS
P6.0 Master Draft Expander    ✅ Deterministic First（见实现）
P6.1 Optional LLM Rendering   ⏸ 后移（等 P7 第一局跑通）
P7 Playable Vertical Slice    → docs/PLAYABLE_VERTICAL_SLICE_P7_ZH.md
```

硬边界仍有效：只展开、不静默重排、不伪造交织；结构调整仅 `StructureChangeRequest`（PROPOSED）。
