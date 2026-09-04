# P5.1 Integrator Product Trial — SCORECARD

> 生成：`node scripts/integrator-product-trial.mjs`  
> 产物：`captures/integrator-product-trial-v1/`  
> 原则：**不改算法**，只回答「新人看这份骨架，能不能开始写一本剧本？」

## 评估约定

| 标签 | 含义 |
|---|---|
| **COLOCATED** | 同一阶段出现 ≥2 个家族的 beat（并排同幕） |
| **INTERWOVEN** | 存在共享**行动/因果/场景后果**的真正交织（不是「碰巧同幕 + 共享角色名」） |

自动统计里的 `WEAVE_SHARED_SCENE` **不等于**产品意义上的 INTERWOVEN：当前实现常把「同 phaseBand + 共享角色」标成 SHARED_SCENE，但文案仍是三条机制流水线。

通过线（产品拍板）：

```text
每项平均 ≥ 3.5 / 5
且 Conflict honesty ≥ 3
且 Editability ≥ 3
```

---

## 自动结构速览

| Case | beats | 跨家族阶段 | 自动 INTERWOVEN 边* | KEEP_PARALLEL | conflicts |
|---|---:|---:|---:|---:|---:|
| A 标准推理 | 14 | 4 | 14 | **0** | 6 |
| B 身份为主 | 12 | 4 | 12 | **0** | 6 |
| C 群像阵营 | 12 | 4 | 12 | **0** | 6 |
| D 高重叠 | 14 | 4 | 12 | **0** | 5 |
| E 低相关 | 8 | 4 | 4 | **0** | 0 |

\*自动边严重偏高；见下方人工 Weave quality。

共通结构问题（五案皆见）：

1. **第三幕空窗** — phaseBand 0/1/2/3 映射到 5 个项目阶段时出现空洞幕。  
2. **终局重复「××阶段完成」** — 收束句不像剧情。  
3. **KEEP_PARALLEL 从未出现** — 即使用意弱相关的 Case E 也被共享角色强缝。

---

## 人工评分（1–5）

### Case A — 标准推理（M01 + M07-5 + M08-2）

| 指标 | 分 | 笔记 |
|---|---:|---|
| Whole-story clarity | 3 | 能感到「嫁祸追凶 + 有人伪装身份 + 有隐营」，但说不清三者如何咬合。 |
| Weave quality | 2 | 每幕都是 M01∥M07∥M08 列表；共享角色≠共享搜查行动。 |
| Character agency | 2 | 几乎只有机制态（伪装态/压力与信息差），少见「为了…而做」。 |
| Stage rhythm | 2 | 中段空幕；爆发与收束挤在后两幕且互相复读。 |
| Conflict honesty | 4 | 负载冲突全员报告，有用。 |
| Editability | 4 | 局部 API 已有单测；本轮未手点 UI，按架构给分。 |
| **平均** | **2.8** | |

一句话主线：有「栽赃追凶」核，但身份与隐营像贴在旁边的进度条。  
值得继续写详细母稿？**有条件 — 否（先修交织与节奏）**

---

### Case B — 身份为主（M07-1 + M07-5 + M08-4）

| 指标 | 分 | 笔记 |
|---|---:|---|
| Whole-story clarity | 2 | 读起来就是「发放 → 假层崩 → 改归属」三条时间轴。 |
| Weave quality | 2 | 典型机械流水线；双 M07 同幕并排最明显。 |
| Character agency | 1 | 无角色目标驱动句。 |
| Stage rhythm | 2 | 再次空幕 + 同构四段。 |
| Conflict honesty | 4 | 过载报告正常。 |
| Editability | 4 | 同 A。 |
| **平均** | **2.5** | |

值得继续写？**否** — 失败类型 **B（流水线）+ C（工具人）**

---

### Case C — 群像阵营（M08-1 + M08-6 + M07-2）

| 指标 | 分 | 笔记 |
|---|---:|---|
| Whole-story clarity | 2 | 「对峙 / 临时结盟 / 结算码」三词并列，无整本冲突句。 |
| Weave quality | 2 | 两阵营块文案几乎同构（压力与信息差…）。 |
| Character agency | 1 | 无。 |
| Stage rhythm | 2 | 同空幕问题；负载报告显示角色池紧张。 |
| Conflict honesty | 4 | 负载爆表被诚实列出。 |
| Editability | 4 | 同 A。 |
| **平均** | **2.5** | |

值得继续写？**否** — 失败类型 **A（节奏）+ C（agency）**；角色池在多 M08 下易触发生成失败（trial 已改用 intentionalOverlap / 换模板绕过）。

---

### Case D — 高交织重叠（culprit = factionLead = bearer）

| 指标 | 分 | 笔记 |
|---|---:|---|
| Whole-story clarity | 3 | 「沈孤鸿既是真凶、伪装身份者、又是阵营领袖」——复杂度可读，但仍缺一条戏。 |
| Weave quality | 3 | 人物重叠提供了真正可写的强接口；骨架仍未写成共享行动。 |
| Character agency | 2 | 潜台词有（他必须维护伪装与阵营），文案未写出来。 |
| Stage rhythm | 2 | 结构同 A。 |
| Conflict honesty | **5** | 明确 `INTENTIONAL_OVERLAP_CANDIDATE` + load=7；这是本轮最有价值的输出。 |
| Editability | 4 | 同 A。 |
| **平均** | **3.2** | |

值得继续写？**有条件** — 冲突层合格；叙事编织层仍不够。失败偏 **C（缺 character-goal 接口）**。

---

### Case E — 低相关（M08-1 + M07-2）

| 指标 | 分 | 笔记 |
|---|---:|---|
| Whole-story clarity | 2 | 公开阵营赛道 vs 权限触发，新人拼不出一本戏。 |
| Weave quality | **1** | **本应 KEEP_PARALLEL，实际 0 条 PARALLEL**；因角色池重叠被 SHARED_SCENE 强缝。 |
| Character agency | 1 | 无。 |
| Stage rhythm | 2 | 同空幕。 |
| Conflict honesty | **2** | 未报告「积木弱相关 / 建议平行」；过载也没有（反而掩盖问题）。 |
| Editability | 4 | 同 A。 |
| **平均** | **2.0** | |

值得继续写？**否** — 失败类型 **D（weave scoring 过度缝合）**。

---

## 汇总

| Case | 平均 | Conflict | Editability | 过线？ |
|---|---:|---:|---:|---|
| A | 2.8 | 4 | 4 | 否 |
| B | 2.5 | 4 | 4 | 否 |
| C | 2.5 | 4 | 4 | 否 |
| D | 3.2 | 5 | 4 | 否（最接近） |
| E | 2.0 | 2 | 4 | 否（Conflict 未过线） |
| **全体均分** | **≈2.6** | — | — | **未达 3.5** |

### 硬门槛

| 门槛 | 结果 |
|---|---|
| 平均 ≥ 3.5 | ❌ |
| Conflict honesty ≥ 3（各案） | ❌（E=2） |
| Editability ≥ 3 | ✅ |

---

## 失败归因（按拍板分类）

| 代码 | 现象 | 本轮证据 |
|---|---|---|
| **A rhythm** | 空幕、同构四段、收束复读 | 五案第三幕皆空 |
| **B shared-action** | COLOCATED 多、真 INTERWOVEN 少 | 文案仍是「M01 然后 M07 然后 M08」 |
| **C character-goal** | 人物是机制容器 | agency hits≈0；无「为了…」驱动 |
| **D weave scoring** | 强行巧合 / 过度缝合 | Case E 无 KEEP_PARALLEL |
| **E interface** | 冲突多或接口不兼容 | 负载冲突有用；缺「弱相关」类冲突 |

**架构未崩的部分**：Conflict honesty（过载/有意重叠）与 Editability API —— 这两项达标说明「可控生成」底座仍在；缺的是**叙事编织质量**，不是又一次 CRUD。

---

## 产品裁决

```text
P5 Integrator Prototype     ✅ 代码闭环成立
P5.1 Product Trial          ❌ 未过线（均分 ~2.6）
P6 Production Master Draft  🚫 暂不开
```

**不要**立刻开 Master Draft Expander。  
**不要**先补 M10/M11。

下一刀若动代码，应按失败类型小步，而不是 Integrator V2 大重构：

1. **区分 COLOCATED vs INTERWOVEN**（评分与 UI 标签）  
2. **修阶段映射空幕（rhythm）**  
3. **弱相关 → 强制可产出 KEEP_PARALLEL**（Case E）  
4. **Block/Beat 增加 character-goal / shared-action 接口**（为真交织喂数据）  

只有再跑一轮 Trial 均分 ≥ 3.5，才开 P6。

---

## 复现

```bash
node scripts/integrator-product-trial.mjs
# → captures/integrator-product-trial-v1/*.md
```
