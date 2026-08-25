import { z } from "zod";
import type { NodeType } from "../domain/shared/base-node.js";

export const ModuleHookSchema = z.enum([
  "after_objective",
  "before_plot",
  "after_plot",
  "after_mechanics",
  "after_gm",
  "after_narrative",
  "final_validation"
]);
export type ModuleHook = z.infer<typeof ModuleHookSchema>;

export interface ModuleDefinition {
  id: string;
  hook: ModuleHook;
  requiredNodeTypes: NodeType[];
  designAgent?: string;
  validatorIds: string[];
  editorialAgentIds: string[];
  writableNodeTypes: NodeType[];
  repairNodeTypes: NodeType[];
  designConstraintIds: string[];
}

export const HardMysteryModule: ModuleDefinition = {
  id: "hard_mystery",
  hook: "after_plot",
  requiredNodeTypes: ["fact", "knowledge", "plot_event"],
  designAgent: "mystery_design_agent",
  validatorIds: [
    "truth_consistency",
    "evidence_closure",
    "solution_reachability",
    "unsupported_inference"
  ],
  editorialAgentIds: [],
  writableNodeTypes: ["fact", "knowledge", "plot_event"],
  repairNodeTypes: ["fact", "knowledge", "plot_event"],
  designConstraintIds: ["TRUTH_FIXED", "SOLUTION_REACHABLE"]
};

export const OutcomeConflictModule: ModuleDefinition = {
  id: "outcome_conflict",
  hook: "after_objective",
  requiredNodeTypes: ["objective"],
  designAgent: "outcome_conflict_agent",
  validatorIds: ["objective_compatibility_graph"],
  editorialAgentIds: [],
  writableNodeTypes: ["objective"],
  repairNodeTypes: ["objective"],
  designConstraintIds: ["OUTCOME_GRAPH_COMPLETE"]
};

export const AiProseModule: ModuleDefinition = {
  id: "ai_prose",
  hook: "after_narrative",
  requiredNodeTypes: ["narrative_section"],
  designAgent: undefined,
  validatorIds: ["ai_prose"],
  editorialAgentIds: ["ai_prose_editor"],
  writableNodeTypes: ["narrative_section"],
  repairNodeTypes: ["narrative_section"],
  designConstraintIds: ["HUMAN_LIKE_PROSE"]
};

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  hard_mystery: HardMysteryModule,
  outcome_conflict: OutcomeConflictModule,
  ai_prose: AiProseModule
};
