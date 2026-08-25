import type { NodeType } from "../../domain/shared/base-node.js";

export const AgentPermissions = {
  setting_agent: ["setting"],
  space_agent: ["space"],
  character_agent: ["character"],
  background_agent: ["background"],
  relationship_agent: ["relationship"],
  situation_agent: ["situation"],
  motivation_agent: ["motivation"],
  objective_agent: ["objective"],
  plot_agent: ["plot_event"],
  mechanic_agent: ["mechanic"],
  gm_agent: ["gm_rule"],
  narrative_writer: ["narrative_section"],
  /** Repair permissions are granted dynamically per RepairRequest. */
  repair_agent: [] as NodeType[]
} satisfies Record<string, NodeType[]>;

export type AgentType = keyof typeof AgentPermissions;

export function writableTypesFor(agent: AgentType): NodeType[] {
  return [...AgentPermissions[agent]];
}

export function assertWriteAllowed(
  agent: AgentType,
  nodeType: NodeType,
  dynamicRepairTypes: NodeType[] = []
): void {
  const allowed =
    agent === "repair_agent"
      ? dynamicRepairTypes
      : AgentPermissions[agent];
  if (!allowed.includes(nodeType)) {
    throw new Error(`Agent ${agent} cannot write node type ${nodeType}`);
  }
}
