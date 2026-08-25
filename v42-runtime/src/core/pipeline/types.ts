import type { NodeType } from "../../domain/shared/base-node.js";
import type { RouterResult } from "../router/router.schema.js";
import type { ProjectSpec } from "../../domain/project/project-spec.js";
import type { NodeRepository } from "../../infrastructure/db/node-repository.js";

export type PipelineStage =
  | "routing"
  | "setting"
  | "space"
  | "characters"
  | "background"
  | "relationships"
  | "situations"
  | "motivations"
  | "objectives"
  | "optional_pre_plot"
  | "plot"
  | "mechanics"
  | "resolution"
  | "gm"
  | "structural_validation"
  | "narrative"
  | "editorial"
  | "final_validation"
  | "complete";

export interface PipelineContext {
  projectId: string;
  project: ProjectSpec;
  router: RouterResult;
  repo: NodeRepository;
  stage: PipelineStage;
  completedStages: PipelineStage[];
}

export interface PipelineStepResult {
  createdNodeIds: string[];
  updatedNodeIds: string[];
  validationIds: string[];
  nextStage?: PipelineStage;
}

export interface PipelineStep {
  id: string;
  readTypes: NodeType[];
  writeTypes: NodeType[];
  run(context: PipelineContext): Promise<PipelineStepResult>;
}

export function emptyStepResult(
  nextStage?: PipelineStage
): PipelineStepResult {
  return {
    createdNodeIds: [],
    updatedNodeIds: [],
    validationIds: [],
    nextStage
  };
}
