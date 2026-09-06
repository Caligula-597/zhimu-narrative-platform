# Real Production Trial #1 — 《闭馆之后》

> 基线：P10.1 Owner Binding Closure ✅ @ `f5a4a02`  
> **不开 P10.2。** 真模型 · 新题目 · 全链路 · 无开发者手修。

## 时代位置

```text
P9 Content Factory Foundation        ✅ CLOSED
P10.0 Quality Audit                  ✅（8/8 可生产）
P10.1 Owner Binding Closure          ✅
★ Real Production Trial #1           ← NOW
P10.2                                → 由 Trial 真实弱点决定（不预锁）
```

## 题目（仅此输入）

见 `trials/rpt-1-closed-after-hours/trial-input.json`。

```text
《闭馆之后》
6人 · 当代美术馆闭馆预展夜 · 关系博弈+推理 · ~3.5h
试探 / 隐瞒 / 交换 / 怀疑 / 一次公开抉择
不要求传统唯一凶手；GAME 可选，不为塞而塞
```

**禁止**再补凶手、关系表、幕表、强制 M03、终局剧本。

## 作者确认 vs 开发者救火

| 允许（AUTHOR） | 禁止（FIREFIGHT） |
|---|---|
| 接受推荐 STORY / Variant | 直接改 JSON / DB |
| 角色槽位与 Owner 确认 | 手填 factId / ownerCharacterIds |
| 确认 Context 绑定 | 改 PMD 中间产物 |
| Quality 后 regenerate section | ignore warning 刷过 Gate |
| `approveCompleteScriptPackage` | 人工塞坏段落 / 改 Runtime |

> 凡普通创作者在产品 UI/正式 API 做不到的，试验一律不做。

## 产物目录

```text
trials/rpt-1-closed-after-hours/runs/<timestamp>/
  trial-input.json
  author-decisions.json
  story-candidate-plan.json
  story-state.json
  master-outline.json
  pmd.json
  production-gate.json
  context-profile.json
  game-narrative-plan.json
  writer-run-metadata.json
  complete-script-package.json
  quality-report.json
  playable-project.json
  runtime-smoke-trace.json
  readable-scripts.md
  trial-summary.json
```

## 运行

```bash
# CI / 无密钥：mock Writer（仍走真实生产链）
node scripts/real-production-trial-1.mjs --mode=mock

# 真模型（读取 backend/.env 的 DEEPSEEK_*）
node scripts/real-production-trial-1.mjs --mode=real
```

## 判定（三档）

| 档 | 条件 |
|---|---|
| `TRIAL_PASS` | 无救火 + Quality≥75 + 无 Hard Blocker + **五项人工审看≥4**（机器只能给 `TRIAL_PASS_CANDIDATE`） |
| `TRIAL_PARTIAL` | 全链路能跑，1–2 个系统性内容弱点 |
| `TRIAL_FAIL` | 需要开发者手修，或中途崩 |

> Quality Gate 拦住 → 不 approve → Runtime 跳过 = **产品路径**，不计开发者救火。

## 首跑结果（真模型）

目录：`trials/rpt-1-closed-after-hours/runs/2026-09-06T04-19-32-742Z/`

| 项 | 结果 |
|---|---|
| 机器 verdict | **`TRIAL_PARTIAL`** |
| Quality | BLOCKED · 65.5 · `HOST_CANNOT_RUN` ×1 |
| 作者确认 / 救火 | 13 / **0** |
| 模型调用 / 耗时 | 36 / ~219s |
| 给人读 | [`HUMAN_REVIEW_PACKET.md`](../trials/rpt-1-closed-after-hours/runs/2026-09-06T04-19-32-742Z/HUMAN_REVIEW_PACKET.md) + `readable-scripts.md` |

### 五项人工审看

1. 前 20 分钟欲望  
2. 幕间互动语法换挡  
3. 六人声音可盲辨  
4. GAME 后果（若有）  
5. 终局兑现表  

## 与《青楼》对照（人工）

不比反转/字数；比对：主动做事速度、资源制造关系、机制改状态、阶段换挡、声音辨识、事实可追溯。

## 交付给审查者

1. `complete-script-package.json`  
2. `quality-report.json`  
3. `readable-scripts.md`（主持本 + 六角色本 + 线索）
