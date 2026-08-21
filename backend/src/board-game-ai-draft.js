import { randomUUID } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { requestDeepseekJson } from "./deepseek-client.js";
import { normalizeBoardGameDesign } from "../../shared/board-game-design.js";
import { BOARD_GAME_ENGINE_CAPABILITIES } from "../../shared/board-game-engine.js";
import { BOARD_GAME_AI_DRAFT_SCOPES, BOARD_GAME_AI_DRAFT_SECTIONS, createBoardGameAiDraftPreview, detectedUnsupportedBoardGameRequirements } from "../../shared/board-game-ai-draft.js";

const clean = (value, limit = 3000) => String(value ?? "").trim().slice(0, limit);
function scopeInstruction(scope, section) {
  if (scope === "full") return "生成完整新原型。";
  if (scope === "patch") return "按本次要求修改并返回完整设计；未涉及内容、ID 与引用原样保留。";
  if (scope === "current") return `只重做 ${section}，其他内容保持原样。`;
  return "只补齐空字段，保留作者已有内容。";
}

export function buildBoardGameAiDraftMessages({ currentDesign, scope, currentSection, instructions, seed }) {
  const design = normalizeBoardGameDesign(currentDesign);
  const capabilities = BOARD_GAME_ENGINE_CAPABILITIES.map((item) => `${item.id}:${item.status}`).join("；");
  const system = `你是桌游创作网站的结构化设计编译器。输出写入编辑器与试玩引擎，不是文章。
边界：
1. 只定义对象、合法行动、信息范围、状态变化、结算和结束条件；不预测或代替任何人的想法、情绪、策略、决定或未来行为。
2. id 必须唯一且只用 ASCII 小写字母、数字、连字符或下划线；所有引用必须指向真实 ID。
3. 地图必须写入 engine.map.nodes/edges；行动必须写入 engine.actions 并由 phases.actionIds 引用。禁止用背景图或说明文字冒充实现。
4. 只有 supported 能力可进入可运行 engine；partial/unsupported 写入 capabilityPlan.unsupported。
5. 运行必需但作者未说明的内容可以自由补全，并列入 assumptions。
6. 只输出 JSON，不要 Markdown。
能力：${capabilities}
JSON 必须包含 summary、capabilityPlan 和 design。design 必须包含 title、designGoal、playerCount、playTimeMinutes、seats、components、variables、mechanisms、engine、rulebook、updatedAt。seats 是桌游自己的席位数组，不得使用角色本或跑团角色数据。
engine 格式：{"version":1,"maxRounds":6,"map":{"kind":"area_graph","nodes":[{"id":"a","label":"区域A","x":20,"y":30,"terrain":"plain","capacity":99,"scoreValue":0,"initialOwner":-1,"description":""}],"edges":[{"id":"a-b","from":"a","to":"b","cost":1,"blocked":false,"bidirectional":true,"label":""}]},"phases":[{"id":"phase","label":"阶段","mode":"sequential|simultaneous|reveal","actionIds":["action"],"description":""}],"actions":[{"id":"action","label":"行动","kind":"move|gain|pay|control|score|mechanism|pass","phaseId":"phase","target":"none|any_region|adjacent_region|own_region|opponent_region","resourceKey":"resource-id","cost":0,"amount":0,"mechanismId":"","description":""}],"setup":{"unitsPerSeat":1,"startingNodeIds":["a"]},"endCondition":{"type":"rounds|variable_threshold","variableKey":"","operator":"gte","value":6},"information":"public"}。`;
  const user = `生成标识：${seed}\n范围：${scopeInstruction(scope, currentSection)}\n作者要求：${instructions || "自由生成一份可运行原型。"}\n当前设计：${JSON.stringify(design)}`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export async function createBoardGameAiDraft(input = {}, { requestId = null } = {}) {
  const scope = BOARD_GAME_AI_DRAFT_SCOPES.includes(input.scope) ? input.scope : "missing";
  const currentSection = BOARD_GAME_AI_DRAFT_SECTIONS.includes(input.currentSection) ? input.currentSection : "components";
  const currentDesign = normalizeBoardGameDesign(input.currentDesign);
  const instructions = clean(input.instructions);
  const seed = clean(input.seed, 120) || randomUUID();
  const result = await requestDeepseekJson(buildBoardGameAiDraftMessages({ currentDesign, scope, currentSection, instructions, seed }), {
    maxTokens: 9000, temperature: 0.72, timeoutMs: 240_000, phase: "board-game-ai-draft", context: { requestId, scope, currentSection }
  });
  if (!result.value?.design || typeof result.value.design !== "object") throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 没有返回可写入桌游编辑器的结构化设计。", { scope, currentSection });
  const preview = createBoardGameAiDraftPreview(currentDesign, result.value.design, { scope, currentSection });
  const declaredUnsupported = Array.isArray(result.value.capabilityPlan?.unsupported) ? result.value.capabilityPlan.unsupported.slice(0, 50) : [];
  const unsupported = [...declaredUnsupported, ...detectedUnsupportedBoardGameRequirements(instructions)]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.capabilityId === item.capabilityId) === index)
    .slice(0, 50);
  return {
    generationId: randomUUID(), seed, scope, currentSection, summary: clean(result.value.summary, 600) || "已生成结构化桌游草稿。",
    capabilityPlan: {
      requested: Array.isArray(result.value.capabilityPlan?.requested) ? result.value.capabilityPlan.requested.slice(0, 50) : [],
      unsupported,
      assumptions: Array.isArray(result.value.capabilityPlan?.assumptions) ? result.value.capabilityPlan.assumptions.map((item) => clean(item, 500)).filter(Boolean).slice(0, 50) : [],
      impactedSections: Array.isArray(result.value.capabilityPlan?.impactedSections) ? result.value.capabilityPlan.impactedSections.map((item) => clean(item, 80)).filter(Boolean).slice(0, 20) : [],
      actual: preview.engineReport.capabilities
    },
    ...preview,
    blocking: preview.blocking || unsupported.length > 0,
    model: result.model, provider: result.provider, usage: result.usage
  };
}
