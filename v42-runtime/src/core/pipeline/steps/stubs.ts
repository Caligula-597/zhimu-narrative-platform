import type { NodeType } from "../../../domain/shared/base-node.js";
import {
  emptyStepResult,
  type PipelineContext,
  type PipelineStage,
  type PipelineStep
} from "../types.js";

function stubStep(
  id: string,
  writeTypes: NodeType[],
  nextStage: PipelineStage,
  readTypes: NodeType[] = []
): PipelineStep {
  return {
    id,
    readTypes,
    writeTypes,
    async run(_ctx: PipelineContext) {
      return emptyStepResult(nextStage);
    }
  };
}

export const pipelineSteps: Record<string, PipelineStep> = {
  setting: stubStep("setting", ["setting"], "space"),
  space: stubStep("space", ["space"], "characters", ["setting"]),
  characters: stubStep("characters", ["character"], "background", ["setting"]),
  background: stubStep("background", ["background"], "relationships", ["character"]),
  relationships: stubStep(
    "relationships",
    ["relationship"],
    "situations",
    ["character", "background"]
  ),
  situations: stubStep(
    "situations",
    ["situation"],
    "motivations",
    ["character"]
  ),
  motivations: stubStep(
    "motivations",
    ["motivation"],
    "objectives",
    ["character", "background", "relationship", "situation"]
  ),
  objectives: stubStep(
    "objectives",
    ["objective"],
    "optional_pre_plot",
    ["motivation"]
  ),
  plot: stubStep("plot", ["plot_event"], "mechanics", ["objective"]),
  mechanics: stubStep("mechanics", ["mechanic"], "resolution", ["plot_event"]),
  resolution: stubStep("resolution", ["resolution"], "gm"),
  gm: stubStep("gm", ["gm_rule"], "structural_validation"),
  narrative: stubStep("narrative", ["narrative_section"], "editorial")
};
