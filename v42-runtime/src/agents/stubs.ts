import type { NodeType } from "../domain/shared/base-node.js";
import { NotImplementedError } from "../core/errors.js";
import type { Agent, AgentRunResult, AgentTask } from "./agent-types.js";

function stubAgent(
  agentType: string,
  writableNodeTypes: NodeType[]
): Agent {
  return {
    agentType,
    writableNodeTypes,
    async run(_task: AgentTask): Promise<AgentRunResult> {
      // Phase 1: IR agents are interface-only; no LLM.
      return { createdNodeIds: [], updatedNodeIds: [] };
    }
  };
}

export const settingAgent = stubAgent("setting_agent", ["setting"]);
export const spaceAgent = stubAgent("space_agent", ["space"]);
export const characterAgent = stubAgent("character_agent", ["character"]);
export const backgroundAgent = stubAgent("background_agent", ["background"]);
export const relationshipAgent = stubAgent("relationship_agent", ["relationship"]);
export const situationAgent = stubAgent("situation_agent", ["situation"]);
export const motivationAgent = stubAgent("motivation_agent", ["motivation"]);
export const objectiveAgent = stubAgent("objective_agent", ["objective"]);
export const plotAgent = stubAgent("plot_agent", ["plot_event"]);
export const mechanicAgent = stubAgent("mechanic_agent", ["mechanic"]);
export const gmAgent = stubAgent("gm_agent", ["gm_rule"]);
export const narrativeWriter = stubAgent("narrative_writer", ["narrative_section"]);

export const repairAgent: Agent = {
  agentType: "repair_agent",
  writableNodeTypes: [],
  async run(_task: AgentTask): Promise<AgentRunResult> {
    throw new NotImplementedError("repair_agent dynamic grant");
  }
};
