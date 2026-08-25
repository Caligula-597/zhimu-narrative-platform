import { z } from "zod";
import type { NodeType } from "../domain/shared/base-node.js";

export const ValidatorDefinitionSchema = z.object({
  id: z.string(),
  category: z.enum(["deterministic", "semantic", "hybrid"]),
  requiredNodeTypes: z.array(z.string()),
  defaultSeverity: z.enum(["hard", "major", "warning", "minor"]),
  repairNodeTypes: z.array(z.string())
});

export interface ValidatorDefinition {
  id: string;
  category: "deterministic" | "semantic" | "hybrid";
  requiredNodeTypes: NodeType[];
  defaultSeverity: "hard" | "major" | "warning" | "minor";
  repairNodeTypes: NodeType[];
}

export const ValidationResultSchema = z.object({
  validatorId: z.string(),
  status: z.enum(["pass", "warning", "fail"]),
  severity: z.enum(["hard", "major", "warning", "minor"]),
  affectedNodeIds: z.array(z.string()),
  evidence: z.array(z.string()),
  explanation: z.string(),
  rootCauseCandidateIds: z.array(z.string()),
  suggestedRepairNodeIds: z.array(z.string())
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const SchemaValidValidator: ValidatorDefinition = {
  id: "schema_valid",
  category: "deterministic",
  requiredNodeTypes: [],
  defaultSeverity: "hard",
  repairNodeTypes: []
};

export const InvalidReferenceValidator: ValidatorDefinition = {
  id: "invalid_reference",
  category: "deterministic",
  requiredNodeTypes: [],
  defaultSeverity: "hard",
  repairNodeTypes: []
};

export const VALIDATOR_REGISTRY: Record<string, ValidatorDefinition> = {
  schema_valid: SchemaValidValidator,
  invalid_reference: InvalidReferenceValidator
};
