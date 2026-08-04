import { cleanText } from "../../prompts/shared.js";
import { OUTLINE_REVISION } from "../../story-outline-contract/vocabulary.js";
import { materializeBlueprintGenerationContract } from "../blueprint-contract.js";

export class ValidationIssueCollector {
  #items = [];

  push(...items) {
    return this.#items.push(...items);
  }

  get length() {
    return this.#items.length;
  }

  toArray() {
    return [...this.#items];
  }
}

export function createBlueprintValidationContext(raw, spec, brief) {
  const contract = brief?.generationContract || {};
  const value = materializeBlueprintGenerationContract(
    raw && typeof raw === "object" && !Array.isArray(raw) ? structuredClone(raw) : {},
    contract,
    spec
  );
  const players = Array.isArray(value.players) ? value.players : [];
  const entities = Array.isArray(value.entities) ? value.entities : [];
  const states = Array.isArray(value.endingLogic?.stateVariables) ? value.endingLogic.stateVariables : [];
  const routes = Array.isArray(value.endingLogic?.routes) ? value.endingLogic.routes : [];
  const chapterExpressions = Array.isArray(value.styleContract?.chapterExpressions)
    ? value.styleContract.chapterExpressions
    : [];
  const normalizedName = (name) => cleanText(name, 160).toLocaleLowerCase("zh-CN").replace(/[\s，。、“”‘’：:；;（）()《》【】\-_]/gu, "");
  const expectedRevision = cleanText(contract.outlineRevision, 20) || OUTLINE_REVISION;
  const isV23 = expectedRevision === "2.3";
  const isV24 = expectedRevision === "2.4";

  return {
    raw,
    spec,
    brief,
    contract,
    value,
    issues: new ValidationIssueCollector(),
    players,
    entities,
    states,
    routes,
    chapterExpressions,
    normalizedName,
    expectedRevision,
    isV23,
    isV24,
    isV23Plus: isV23 || isV24,
    registries: {
      playerKeys: new Set(),
      playerNames: new Set(),
      stateKeys: [],
      resourceKeys: [],
      resourceKeySet: new Set()
    }
  };
}
