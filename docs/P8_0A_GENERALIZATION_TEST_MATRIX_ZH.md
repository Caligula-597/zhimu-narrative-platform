# P8.0A — Generalization Test Matrix

> 阶段：P8.0 Multi-Script Generalization Audit 的第一刀  
> 原则：**只冻结覆盖面与验收方式，不写产品功能**  
> 上游：Deterministic Production Layer FROZEN（`b4e4cce`）  
> 目标一句话：证明 `STORY → Integrator → ProductionMasterDraft V2 → Playable` **不只对当前 6 人古风案例有效**。

## 0. 本刀做什么 / 不做什么

| 做 | 不做 |
|---|---|
| 冻结要覆盖的差异维度 | 笛卡尔积穷举 |
| 选 5～8 个代表案例 | 开 P6.1 LLM / Full Script |
| 定义 Machine + Editorial 双层 Gate | 要求真人桌测 |
| 记录每本审查清单 | 改核心 Expander（除非解冻条件触发） |

## 1. 差异维度（覆盖矩阵 · 非穷举）

| 轴 | 取值 |
|---|---|
| 人数 | 5 / 6 / 7 / 8 |
| 幕数 | 3 / 4 / 5 |
| 结构 | 推凶 · 身份 · 阵营 · 多线平行 · 高交织 · 低交织 |
| 题材 | 现代 · 古风 · 科幻 · 校园/现实 |
| 机制 | 无 GAME · 单 GAME · 多 GAME |
| 角色结构 | 单中心 · 双中心 · 群像 · 高负载角色 |

**选代表案例，不跑全组合。** 每个案例应尽量撞到多个轴上的「非默认」点。

## 2. 建议代表案例池（5～8 本）

| ID | 画像 | 主要压测点 |
|---|---|---|
| A | 5 人 · 现代封闭推理 · 3 幕 | 少人 / 短幕 / 推凶 |
| B | 6 人 · 古风阵营 · 5 幕 | 基线对照（现有）· 长幕 · 阵营 |
| C | 7 人 · 科幻身份 · 4 幕 | 多人 / 身份结构 / 非古风 |
| D | 8 人 · 情感悬疑 · 无主凶案 | 群像 / 非推凶 / 高人数 |
| E | 6 人 · 强机制 / 弱推理 | 多 GAME · 机制是否挤掉叙事 |
| F（可选） | 5～6 人 · 低交织平行线 | Integrator 假交织风险 |
| G（可选） | 含高负载复杂角色 | Character Projection V2 承压 |
| H（可选） | 校园/现实 · 单 GAME | 题材迁移 · 单机制 |

定稿时填写：样本来源（fixture / 人工大纲 / 真实剧本摘录）、路径、是否已生成 PMD V2。

## 3. Coding 侧 Machine Gate（同一套合同）

对每本样本，自动验证至少：

```text
不同人数 · 不同幕数 · 不同 STORY 组合
不同角色数量 · 不同 clue 数量
→ schema / fidelity / determinism / projection / compile 兼容
→ 核心代码无需 per-case 特判
```

若换案例就要改 Expander / 硬编码人数幕数 → **泛化失败**，记录为合同解冻候选。

## 4. Editorial Gate（逐本人工审查）

每本必过：

1. STORY 选择是否合理  
2. 人数有没有被隐性写死  
3. 角色负载是否失衡  
4. 阶段数量是否真的通用  
5. Integrator 是否又出现假交织  
6. Character Projection 是否还能正确承载复杂角色  
7. Clue 生命周期是否正常  
8. Truth View 是否保持语义一致  
9. StructureChangeRequest 是否能抓节奏问题  
10. CompleteScriptPackage 未来需要哪些新增信息  

另评：故事是否成立、人物是否像人、冲突与节奏、线索是否支撑推理、机制是否融入、模板味、「结构正确但不好看」。

## 5. 通过标准（P8.0 阶段）

| 结果 | 含义 |
|---|---|
| Machine Gate 全绿 + Editorial 无结构性否决 | P8.0 PASS → 可开 P8.1 |
| Machine 失败且需改合同 | 触发 Expander 解冻条件（见冻结文档） |
| Machine 绿但 Editorial 结构性否决 | 记缺陷；区分「合同装不下」vs「样本质量差」 |
| 仅文学偏好 / 润色意见 | **不解冻**；留给 Full Script Production |

## 6. 下游衔接

```text
P8.0A Matrix（本文）→ 选案 + 跑 Gate + 逐本审
P8.0 完成 → P8.1 PlayableCreationSpec（人数/题材/机制等产品输入合同）
P8.2 / Full Script Production V1 → CompleteScriptPackage
```

## 7. 废止

本阶段**不**以真人桌测为入口或出口 Gate。  
桌测执行单（`P7_PRODUCT_PLAYTEST_ROUND1_ZH.md`）可选、不阻塞。
