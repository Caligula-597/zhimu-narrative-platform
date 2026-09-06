# Real Production Trial #1 — 人工审看包

机器判定：**`TRIAL_PARTIAL`**（非 PASS；正式 PASS 须你完成五项审看）

| 项 | 值 |
|---|---|
| 题目 | 《闭馆之后》 |
| Writer | DeepSeek `deepseek-v4-flash`（real） |
| Quality | `QUALITY_BLOCKED` · **65.5** · Hard Blocker ×1（`HOST_CANNOT_RUN`） |
| 作者确认 | 13 |
| 开发者救火 | **0** |
| Runtime smoke | 跳过（Package 未 approve → Playable `INVALID`，产品路径） |
| 模型调用 | 36 |
| 耗时 | ~219s |
| GAME | 未放置（`hasGame: false`） |

## 请先读（刻意先不看分数）

1. [`readable-scripts.md`](./readable-scripts.md) — 主持本 + 六角色本 + 线索/终局导出
2. [`complete-script-package.json`](./complete-script-package.json)
3. 读完再对照 [`quality-report.json`](./quality-report.json)

## 五项人工透镜（你的判据）

1. **前 20 分钟欲望** — 六角色第一幕能否回答「找谁 / 要什么 / 隐瞒什么 / 可交换什么 / 不做会损失什么」
2. **互动语法换挡** — Act 之间是否真的换玩法，而非只加信息
3. **六人声音盲测** — 遮姓名后能否靠人格区分（非古风/爆粗标签）
4. **GAME 后果** — 本次无 GAME；可记 N/A 或「系统未选 GAME」
5. **终局兑现表** — 核心物件/关系/第一幕谎言/中段选择/核心疑问是否被回收

## 机器侧已见的内容风险（供对照，不代替你的判断）

- Hard：主持本缺可执行发线索/推进/保密指引（`HOST_CANNOT_RUN`）
- 维度最低：E 审美声音 **1.5**；C 阶段推进 / D GAME 融合各 **3**
- 题材漂移信号：正文大量「案发现场 / 真凶 / 白绫嫁祸 / 更夫梆子」，与「当代美术馆闭馆预展 + 不要求唯一凶手」输入张力大
- `ROLE_STAGE_GAP`：role_P4 缺 act1 覆盖

## 与《青楼》对照表（留给你填）

| 比较项 | 《青楼》 | Trial #1 |
|---|---|---|
| 玩家多久开始主动做事 | 强 | ? |
| 资源能否制造关系行为 | 强 | ? |
| 机制是否改变后续状态 | 强 | N/A（无 GAME） |
| 阶段之间玩法是否换挡 | 强 | ? |
| 角色语言是否有辨识度 | 中等/类型化 | ? |
| 结构公平与事实可追溯 | 有明显妥协 | ? |
