# P10.4 — Experience Realization / Production Projection Fidelity

> 来源：RPT #1B 人工结案（[`RPT1B_HUMAN_ADJUDICATION_ZH.md`](./RPT1B_HUMAN_ADJUDICATION_ZH.md)）  
> 基线：P10.3 @ `2b6c761` · RPT #1B run `1426a6e`  
> **不开 Writer V2。不扩 STORY 库。先 Packet Probe，再真模型。**

## 一句话

```text
正确的 STORY 语义（slots / stakes / roles / terms）
必须完整穿过 PMD → Packet → Final Text，
变成具体、角色正确、可执行的玩家内容。
```

## 问题已不是

```text
有没有 M12？
```

## 问题是

```text
M12 的具体交易能否送到玩家手上？
```

## 只盯四件事

### 1. Symbolic Slot Grounding

```text
bargainA / bargainB / stakeholder …
→ Writer 前必须全部 concrete
→ Writer 永远看不到裸 slotId
```

应只见：

```text
holder: { characterId: P2, displayName: 梁赫 }
```

### 2. Concrete Stake Grounding

```text
contestedStake / holderPrice / seekerNeed / exchangeTerms
→ Production Packet 前实例化为具体内容
→ 禁止落到正文仍是「可交换标的」
```

### 3. Role Contribution Scope

```text
OWNER / PRIMARY 内容只能进入正确角色本
顾清的 M07 不得完整复制给方序
```

### 4. Action Realization

```text
NEGOTIATE / EXCHANGE
≠ 「你们进行了谈判 / 完成了交换」

Packet 必须携带：
谁要什么、谁有什么、代价是什么、
可选条件是什么、不同结果改变什么
```

## Packet-Level Probe（真模型前必过）

示例必须看见：

```text
M12 packet
seeker: 沈岚
holder: 梁赫
stake: 未公开预展目录册的库房访问权（或等价具体物）
seekerNeed: …
holderNeed: …
offer: …
counterOptions: …
```

禁止仍见：

```text
actor = bargainA
target = bargainB
stake = 可交换标的
```

## 明确不在本刀

- Writer literary prompt / Voice V2  
- Context Domain Coherence（可下一刀）  
- Host operational rendering  
- 再新增 STORY family  
- 放宽 P9.4  

## 成功标准（草案）

```text
✅ Writer 输入中无裸 slotId
✅ contestedStake 等在 packet 已 concrete
✅ PRIMARY 体验不跨角色完整复制
✅ NEGOTIATE/EXCHANGE packet 含 terms / options / aftermath deltas
✅ Packet Probe PASS 后再开真模型重跑
```

正式开刀时再锁 ticket 切片与测试入口。
