import type { ProjectSpec } from "../../domain/project/project-spec.js";
import type { RequirementParseResult } from "./router.schema.js";

/**
 * LLM requirement parser stub.
 * Phase 1 returns empty capabilities — no free inference from natural language.
 */
export async function parseRequirementsWithLlm(
  _project: ProjectSpec
): Promise<RequirementParseResult> {
  return {
    requested_capabilities: [],
    explicitly_disabled: []
  };
}
