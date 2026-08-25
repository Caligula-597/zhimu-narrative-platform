import type { NodeType } from "../domain/shared/base-node.js";

export interface AgentTask {
  taskId: string;
  projectId: string;
  agentType: string;
  operation: "create" | "expand" | "validate" | "patch";
  inputNodeIds: string[];
  writableNodeTypes: NodeType[];
  immutableNodeIds: string[];
  moduleConstraintIds: string[];
  outputSchemaId: string;
  maxOutputNodes: number;
}

export interface AgentRunResult {
  createdNodeIds: string[];
  updatedNodeIds: string[];
}

export interface Agent {
  agentType: string;
  writableNodeTypes: NodeType[];
  run(task: AgentTask): Promise<AgentRunResult>;
}
