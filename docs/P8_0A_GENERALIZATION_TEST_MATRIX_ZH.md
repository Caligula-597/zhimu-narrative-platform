# P8.0A — Generalization Test Matrix

> 阶段：P8.0 Multi-Script Generalization Audit 的第一刀  
> 原则：**只冻结覆盖面与验收方式，不写产品功能**  
> 上游：Deterministic Production Layer FROZEN（`b4e4cce`）  
> 目标一句话：证明 `STORY → Integrator → ProductionMasterDraft V2 → Playable` **不只对当前 6 人古风案例有效**。  
> **代表案已定稿**：见 [`P8_0B_REPRESENTATIVE_CORPUS_ZH.md`](./P8_0B_REPRESENTATIVE_CORPUS_ZH.md)（GEN-01～GEN-08）。

## 0. 本刀做什么 / 不做什么

| 做 | 不做 |
|---|---|
| 冻结要覆盖的差异维度 | 笛卡尔积穷举 |
| **正式 8 本代表案例** | 开 P6.1 LLM / Full Script |
| 定义 Machine + Editorial 双层 Gate | 要求真人桌测 |
| 记录每本审查清单 | 改核心 Expander（除非解冻条件触发） |
| A–H 仅 regression | 用 A–H 冒充泛化证明 |

## 1. 差异维度（覆盖矩阵 · 非穷举）

| 轴 | 取值 |
|---|---|
| 人数 | 5 / 6 / 7 / 8 |
| 幕数 | 3 / 4 / 5 |
| 结构 | 推凶 · 身份 · 阵营 · 多线平行 · 高交织 · 低交织 |
| 题材 | 现代 · 古风 · 科幻 · 校园/现实 |
| 机制 | 无 GAME · 单 GAME · 多 GAME |
| 角色结构 | 单中心 · 双中心 · 群像 · 高负载角色 |

## 2. 正式代表案（8 本 · 已冻结）

| ID | 样本 | 人数 | 幕 | 压测重点 |
|---|---|---:|---:|---|
| GEN-01 | 《雨夜公寓》 | 5 | 3 | 少人短幕 · M01 |
| GEN-02 | 《长安夜宴》 | 6 | 5 | 五幕功能 · 阵营 |
| GEN-03 | 《赫利俄斯站》 | 7 | 4 | 科幻权限 · 非古风 |
| GEN-04 | 《毕业照之后》 | 8 | 5 | **无主凶案** |
| GEN-05 | 《零点拍卖会》 | 6 | 4 | M03×2+M09 |
| GEN-06 | 《两封没有寄出的信》 | 5 | 4 | 零假交织 |
| GEN-07 | 《王座之下》 | 7 | 5 | Projection V2 |
| GEN-08 | 《停电之前》 | 6 | 3 | 公共任务条件 |

输入路径：`shared/p8-generalization-cases/`。矩阵完整，**不需要第 9 本**。

## 3. Machine Gate（三层）

### G1 — Contract Generalization

人数 · 幕数 · 角色 ID · stage IDs · clue 生命周期 · projection — **不得写死 6 人 / 4 幕**。

### G2 — Semantic Generalization

requires/produces 可闭合 · 无 fake INTERWOVEN · OWNER/PARTICIPANT/TARGET · Truth flags · Structure warnings。

### G3 — Downstream Compatibility

PMD V2 → **结构可编译 / 适配诊断**（不要为 P8.0 生成 CompleteScriptPackage）。

## 4. Editorial Gate

见 P8.0A 原十条 + 失败分类：`CONTRACT_FAILURE` / `GENERATION_FAILURE` / `CONTENT_QUALITY_FAILURE`。

## 5. 通过标准

| 结果 | 含义 |
|---|---|
| Machine 全绿 + Editorial 无结构性否决 | P8.0 PASS → P8.1 |
| Machine 失败且合同装不下 | 触发解冻条件 |
| 仅文学偏好 | **不解冻** |

## 6. 下游

```text
P8.0A ✅ → P8.0B Corpus ✅ → P8.0D Editorial → Verdict
→ P8.1 PlayableCreationSpec → P8.2 Full Script Production
```

## 7. 废止

不以真人桌测为入口或出口 Gate。
