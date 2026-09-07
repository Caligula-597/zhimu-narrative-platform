# STORY 机制缺口 — Formation vs Resolution（文档骨架）

> 状态：**骨架 / 未开刀**  
> 触发：RPT #1C《闭馆之后》暴露 M12 只有谈判桌、没有坐上桌子的因果  
> 上游已冻结：P10.2–P10.4 · P10.5.0 Diff · P10.5.1 Repair（Rendering）  
> **本文件不是 Voice V2，也不重开 Projection / Writer 文学性。**

## 一句话判断

```text
我们写的「最小可闭环」机制，多数只封住了 Resolution（怎么结算/怎么换/怎么判），
少写了 Formation（玩家凭什么知道、凭什么锁定、凭什么有杠杆、凭什么此刻必须坐到桌边）。

M12 最刺眼，但很可能不是孤例——是整类「最小闭环」机制的同构病。
```

作者同意的诊断：

> 不是谈判选项不够，而是 **Pre-Bargain Information Chain**（更泛化：**Experience Formation Chain**）缺失。

---

## 正式区分（钉死）

| 层 | 回答什么 | M12 现状 | 典型症状 |
|---|---|---|---|
| **Formation** | 为什么这场体验会形成 | ❌ 几乎没有 | 「你们现在交换吧」 |
| **Resolution** | 形成后怎么推进/结算 | ✅ 有最小闭环 | seeker/holder/exchange 能跑 |

```text
Resolution 合同（可保留）：
  seeker · holder · stake · price · exchange · aftermath

Formation 合同（缺）：
  ① 存在/价值   ② 谁可能知道   ③ 锁定掌握者
  ④ 让人开口     ⑤ 才有资格谈
  ⑥ 我的杠杆来路 ⑦ 对家为何需要 ⑧ 为何现在必须谈 ⑨ 谈完改变什么
```

**规则：** 任一 Formation 格是「模板设定 / 玩家自然知道 / holder 就在那 / 他们可以谈」→ **不进 Writer。**

---

## 8 问 Formation Gate（交换类先钉；其它族映射同构问）

| # | 问题 | 字段名（草案） |
|---|---|---|
| 1 | X 为什么值得要？ | `valueSource` |
| 2 | A 怎么知道 X 存在？ | `existenceSource` |
| 3 | A 怎么知道谁可能知道 X？ | `knowledgePath` |
| 4 | A 怎么锁定真正 holder？ | `locatorPath` |
| 5 | holder 为什么不直接拒绝？ | `counterpartLeverage` |
| 6 | A 的筹码从哪来？ | `leverageProvenance` |
| 7 | holder 为什么需要这个筹码？ | `counterpartNeed` |
| 8 | 什么使谈判/交换**现在**发生？ | `trigger` |

双边杠杆声明：

```text
真正的谈判至少需要 bilateral leverage。
另一边可以是：信息 / 权限 / 证明 / 人情 / 关系 / 保密 / 威胁 / 替代渠道。
但必须存在「我不能直接无视你」的理由。
只有一边有东西、且无威胁/情报/权限 → 不是谈判，是请求/索取/胁迫/剧情强行交易。
```

---

## 示范位（待填满，非定稿正文）

题材锚：RPT #1C《闭馆之后》· 未公开预展目录册  

```text
① 撤展异常 + 来源不一致 → 推断「另有内部目录」（不是开场直发「去找目录册」）
② 签字/邮件/整理记录 → 「梁赫可能知道」
③ 授权进库 + 可能被借 → 「持有 vs 只知去向」成问题
④ 白绫开口需要沈岚手里另一条信息 → 第一轮信息交易
⑤ 拼链后才锁定「大概率在梁赫手里」
⑥⑦ 腕带也有获取链 + 梁赫今晚为何非要腕带
⑧ 第二轮预展/私人展厅时窗 → trigger
⑨ 换手后 knowledge/access delta
```

完整因果表：**待本骨架验收后另开「闭馆夜 Formation 填表」切片。**

---

## 机制盘点（初判 · 待逐条复核）

原则：先问「玩家如何自己走到结算桌」，再问「结算合同是否完备」。

### A. 生产 COMPLETE（真正会进 Writer 的）

| ID | 名称 | Resolution 有吗 | Formation 初判 | 缺口形态（假说） |
|---|---|---|---|---|
| **M12-1** | 双边关系议价 | ✅ PROBE→NEGOTIATE→EXCHANGE→AFTERMATH | **❌ 高** | 第五层当第一层；STAKE_HINT 是暗示槽不是存在推理链；角色靠岗位标签而非信息链节点 |
| **M01-FRAMING** | 嫁祸/追凶主壳 | ✅ 误导→反证→真手法 | **⚠️ 中低** | 追凶族相对最接近 Formation（线索改变线索意义）；但仍可能「开场已知谁相关」过强，需对照 8 问做映射表 |
| **M07-1…8** | 记忆/身份开放 | ✅ 阶段/条件开放闭环 | **❌ 高～中** | 多半是「到点发信息」，缺：为何在意、谁先发现异常、旁观者如何拼出真相、开口杠杆 |
| **M08-1…8** | 阵营结构 | ✅ 阵营目标/公开任务 | **❌ 高** | 有立场结算，少「为何结盟/叛变形成」的信息与利害链；临时联盟尤甚 |
| **M12 以外 COMPLETE** | — | — | — | 目前生产 COMPLETE 主要就是上表；无第二套议价族 |

### B. Registry 种子 / FOUNDATION（最小壳，37 个 catalog 对齐）

`shared/story-mechanism-templates-data.js` 的 `CATALOG_SEEDS`：M01-1…10、M07、M08、M10、M11。

| 族 | 用途摘要 | Formation 初判 |
|---|---|---|
| **M01-1…10** | 各类判断/追凶变体 | 种子级 HOOK/PAYOFF；**有判断闭环意图，无完整信息因果合同** |
| **M10-1…6** | 结局问答映射 | 纯 Resolution（选择→结局）；Formation 本不在此层，但若前置无「为何这些问题有意义」会空 |
| **M11-1…5** | 世界状态/现场 | 状态变更闭环；缺「玩家如何发现状态可改、改了谁在乎」 |
| **M07 / M08 种子** | 与 COMPLETE 同族 | 同构病预期更重（连 Resolution 细节都薄） |

### C. 同构病检查清单（整理机制时逐条打）

对每个 template 问：

```text
[ ] 是否只有结算槽（角色岗位 + plot 结果），没有来源链槽？
[ ] 开场是否直接发放「答案级」知识（谁有、谁要、在哪）？
[ ] 非 OWNER 角色是「岗位标签」还是「链上节点」？
[ ] 是否存在双边杠杆 / 等价「不能无视」条件？
[ ] clueSlots 是装饰性暗示，还是改变前序意义的因果链？
[ ] 若删掉旁白「你可以谈/你可以查」，玩家是否仍有内生理由行动？
```

任 3 项「否」→ 标 **FORMATION_GAP_HIGH**，不得用「补 Writer prompt」假装修好。

---

## 与已冻结层的边界

```text
P10.2 Intent          ✅ 要什么体验 —— 仍冻结
P10.3 Coverage        ✅ 有没有议价块 —— 仍冻结（M12 作为 Resolution 载体仍成立）
P10.4 Projection      ✅ Packet 忠实投影 —— 仍冻结
P10.5 Rendering       ✅ Writer 不改规则 —— 仍冻结

本缺口               ← 更上游：STORY 机制语义 / Formation 合同
                     不是 Diff 能修的，也不是 Section Repair 能修的
```

**禁止：** 用 P10.5 RepairBrief 硬塞 Formation；用 Context 词藻掩盖「开场已知答案」；扩 Voice。

---

## 建议工作序（未排期）

1. **骨架认可**（本文）  
2. **机制表填满**：COMPLETE 逐条 + FOUNDATION 抽样，打 Formation 等级  
3. **闭馆夜示范链**：用 8 问填一版目录册因果（仍不进 Writer）  
4. **再决定刀号**：M12 Formation V1 合同？跨族 Experience Formation 字段？Gate 进 Pre-Writer？  
5. 真模型重跑 **远晚于** 合同与示范链

---

## 验收位置

纯文档 / 机制审计骨架，无新 UI。

| 项目 | 说明 |
|---|---|
| 视图 | 仓库文档（非产品界面） |
| 区域 | `docs/STORY_MECHANISM_FORMATIONATION_GAP_ZH.md` |
| 控件 | — |
| 操作 | 阅读「一句话判断」与 COMPLETE 初判表；确认是否进入机制逐条整理 |
| 文件 | 本文；对照 `shared/story-mechanism-m12-pack.js`、`story-mechanism-templates-data.js`、`complete-beat-semantics-data.js` |

---

## 待填（下一轮整理机制时勾掉）

- [ ] M12-1：现有 clue/plot/stage 逐字段对照 8 问（哪些槽假装覆盖了 Formation）
- [ ] M01-FRAMING：把追凶链映射成 Formation 同构表（作为「做得相对好」的参照）
- [ ] M07×8 / M08×8：各一页「开放/阵营」Formation 缺口等级
- [ ] M10 / M11：标明「本层不负责 Formation」vs「调用方必须另有 Formation」
- [ ] 产出统一字段：是否升格进 template schema，还是只做 Gate 清单
