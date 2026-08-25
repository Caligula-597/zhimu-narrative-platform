import type { ProjectSpec } from "../../domain/project/project-spec.js";
import type { RouterResult } from "../router/router.schema.js";
import { routeRequirements } from "../router/requirement-router.js";
import type { NodeRepository } from "../../infrastructure/db/node-repository.js";
import { MODULE_REGISTRY } from "../../modules/registry.js";
import type { ModuleHook } from "../../modules/registry.js";
import { pipelineSteps } from "../pipeline/steps/stubs.js";
import {
  type PipelineContext,
  type PipelineStage,
  type PipelineStepResult
} from "../pipeline/types.js";

export interface OrchestratorRunResult {
  projectId: string;
  router: RouterResult;
  completedStages: PipelineStage[];
  moduleHooksRun: ModuleHook[];
  stepResults: Record<string, PipelineStepResult>;
}

async function runModuleHook(
  router: RouterResult,
  hook: ModuleHook,
  hooksRun: ModuleHook[]
): Promise<void> {
  hooksRun.push(hook);
  for (const [id, flag] of Object.entries(router.modules)) {
    if (!flag.enabled) continue;
    const def = MODULE_REGISTRY[id];
    if (def?.hook === hook) {
      // Phase 1: module agents are no-ops; hook registration is the contract.
    }
  }
}

async function runStage(
  ctx: PipelineContext,
  stage: PipelineStage,
  stepResults: Record<string, PipelineStepResult>
): Promise<PipelineStage | undefined> {
  const step = pipelineSteps[stage];
  if (!step) {
    ctx.completedStages.push(stage);
    return undefined;
  }
  const result = await step.run({ ...ctx, stage });
  stepResults[stage] = result;
  ctx.completedStages.push(stage);
  return result.nextStage;
}

/**
 * Orchestrator: decides who runs next. Does not create content.
 */
export async function runProject(
  project: ProjectSpec,
  repo: NodeRepository
): Promise<OrchestratorRunResult> {
  const router = await routeRequirements(project);
  const completedStages: PipelineStage[] = [];
  const moduleHooksRun: ModuleHook[] = [];
  const stepResults: Record<string, PipelineStepResult> = {};

  const ctx: PipelineContext = {
    projectId: project.id,
    project,
    router,
    repo,
    stage: "routing",
    completedStages
  };

  completedStages.push("routing");

  const designOrder: PipelineStage[] = [
    "setting",
    "space",
    "characters",
    "background",
    "relationships",
    "situations",
    "motivations",
    "objectives"
  ];

  for (const stage of designOrder) {
    await runStage(ctx, stage, stepResults);
  }

  await runModuleHook(router, "after_objective", moduleHooksRun);
  completedStages.push("optional_pre_plot");

  await runStage(ctx, "plot", stepResults);
  await runModuleHook(router, "after_plot", moduleHooksRun);

  await runStage(ctx, "mechanics", stepResults);
  await runModuleHook(router, "after_mechanics", moduleHooksRun);

  await runStage(ctx, "resolution", stepResults);
  await runStage(ctx, "gm", stepResults);
  await runModuleHook(router, "after_gm", moduleHooksRun);

  completedStages.push("structural_validation");

  if (project.deliverables.fullNarrative || project.deliverables.characterBooks) {
    await runStage(ctx, "narrative", stepResults);
    await runModuleHook(router, "after_narrative", moduleHooksRun);
    completedStages.push("editorial");
  }

  await runModuleHook(router, "final_validation", moduleHooksRun);
  completedStages.push("final_validation");
  completedStages.push("complete");

  return {
    projectId: project.id,
    router,
    completedStages,
    moduleHooksRun,
    stepResults
  };
}
