import type { ProjectSpec } from "../../domain/project/project-spec.js";
import type { ModuleFlag } from "./router.schema.js";

export type ModuleEnableFn = (moduleId: string, source: string, strictness?: ModuleFlag["strictness"]) => void;

/**
 * Deterministic keyword → module mapping.
 * Default: optional modules stay OFF unless explicitly triggered.
 */
export function applyDeterministicRouterRules(
  project: ProjectSpec,
  enable: ModuleEnableFn
): void {
  const texts = [
    ...project.requirements,
    ...(project.settingRequest ? [project.settingRequest] : []),
    ...project.forbiddenPatterns.map((p) => `forbid:${p}`)
  ];

  for (const text of texts) {
    if (text.includes("硬核推理") || text.includes("hard_mystery")) {
      enable("hard_mystery", `rule:${text}`, "hard");
    }
    if (text.includes("结局冲突") || text.includes("outcome_conflict")) {
      enable("outcome_conflict", `rule:${text}`, "normal");
    }
    if (text.includes("去AI味") || text.includes("ai_prose")) {
      enable("ai_prose", `rule:${text}`, "normal");
    }
  }

  if (project.deliverables.fullNarrative) {
    enable("ai_prose", "deliverable:fullNarrative", "light");
  }
}
