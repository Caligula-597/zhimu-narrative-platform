import type { ProjectSpec } from "../../domain/project/project-spec.js";
import { parseRequirementsWithLlm } from "./requirement-parser.js";
import { applyDeterministicRouterRules } from "./router-rules.js";
import type { ModuleFlag, RouterResult } from "./router.schema.js";

const KNOWN_MODULES = [
  "hard_mystery",
  "outcome_conflict",
  "ai_prose"
] as const;

function offFlag(): ModuleFlag {
  return {
    enabled: false,
    design: false,
    validation: false,
    editorial: false,
    triggerSource: []
  };
}

function enableFlag(
  flag: ModuleFlag,
  source: string,
  strictness?: ModuleFlag["strictness"]
): ModuleFlag {
  return {
    enabled: true,
    design: true,
    validation: true,
    editorial: flag.editorial,
    strictness: strictness ?? flag.strictness ?? "normal",
    triggerSource: [...new Set([...flag.triggerSource, source])]
  };
}

/**
 * Layer 0: user requirements → module flags.
 * Does not invent genre/modules from vague setting text (e.g. 「民国六人本」).
 */
export async function routeRequirements(
  project: ProjectSpec
): Promise<RouterResult> {
  const modules: Record<string, ModuleFlag> = {};
  for (const id of KNOWN_MODULES) {
    modules[id] = offFlag();
  }

  const enable = (
    moduleId: string,
    source: string,
    strictness?: ModuleFlag["strictness"]
  ) => {
    if (!(moduleId in modules)) {
      modules[moduleId] = offFlag();
    }
    modules[moduleId] = enableFlag(modules[moduleId]!, source, strictness);
  };

  applyDeterministicRouterRules(project, enable);

  const parsed = await parseRequirementsWithLlm(project);
  for (const cap of parsed.requested_capabilities) {
    enable(cap, `llm:${cap}`);
  }
  for (const disabled of parsed.explicitly_disabled) {
    if (modules[disabled]) {
      modules[disabled] = {
        ...offFlag(),
        triggerSource: [`llm_disabled:${disabled}`]
      };
    }
  }

  return { core: true, modules };
}
