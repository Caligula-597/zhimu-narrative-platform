# @zhimu/v42-runtime (V4.2)

独立的剧本杀创作中间表示（IR）与 Pipeline Runtime。与现有织幕产品（V9 / World Engine / 创作中心）**并行**，本阶段不挂产品路由、不改前端。

## 边界

| 层 | 现状 |
|---|---|
| 织幕产品真相 | `shared/world-engine/`、`docs/AI_GENERATION_ARCHITECTURE_V9_ZH.md` |
| V4.2 | 本包：结构化 IR → Orchestrator → Validators → Runtime |
| 接入 | `src/integration/` 仅定义 Adapter / Hook，**未接线** |

## 跑测试

```bash
cd v42-runtime
npm install
npm test
```

根目录：`npm run test:v42`

## 目录映射

见仓库内 V4.2 Runtime Specification：`domain/`、`core/`、`agents/`、`modules/`、`validators/`、`runtime/`、`infrastructure/`、`api/`、`integration/`。

## Phase 1 范围

- Zod IR schemas + ProjectSpec
- Memory repository（version / lock / dependency）
- 确定性 Requirement Router（默认 optional module = OFF）
- Orchestrator / Pipeline stub（无 LLM）
- MVP module 注册：`hard_mystery` / `outcome_conflict` / `ai_prose`
- SQL 骨架（Postgres JSONB），PG 实现留 stub
