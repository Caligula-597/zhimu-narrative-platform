import type { AgentTask } from "../../agents/agent-types.js";

export interface CompiledPrompt {
  system: string;
  user: string;
  outputSchemaId: string;
}

/**
 * Prompt Compiler stub — composes constitution + task + nodes later.
 * Phase 1 returns a structured placeholder without LLM calls.
 */
export function compileAgentPrompt(task: AgentTask): CompiledPrompt {
  return {
    system: [
      "V4.2 Agent Constitution (stub)",
      `agentType=${task.agentType}`,
      `writable=${task.writableNodeTypes.join(",")}`,
      `immutable=${task.immutableNodeIds.join(",")}`,
      `constraints=${task.moduleConstraintIds.join(",")}`
    ].join("\n"),
    user: [
      `operation=${task.operation}`,
      `inputNodes=${task.inputNodeIds.join(",")}`,
      `maxOutputNodes=${task.maxOutputNodes}`
    ].join("\n"),
    outputSchemaId: task.outputSchemaId
  };
}
