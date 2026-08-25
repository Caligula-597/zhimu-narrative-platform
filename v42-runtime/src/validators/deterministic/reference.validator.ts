import type { AnyDesignNode } from "../../domain/shared/any-node.js";
import type { ValidationResult } from "../registry.js";

/** Deterministic: every listed id in a string[] field must exist in the project node set. */
export function validateNodeReferences(
  nodes: AnyDesignNode[],
  referenceFields: string[] = ["sourceNodeIds", "establishedByNodeIds", "basisNodeIds"]
): ValidationResult {
  const ids = new Set(nodes.map((n) => n.id));
  const missing: string[] = [];
  const affected: string[] = [];

  for (const node of nodes) {
    const record = node as unknown as Record<string, unknown>;
    for (const field of referenceFields) {
      const value = record[field];
      if (!Array.isArray(value)) continue;
      for (const ref of value) {
        if (typeof ref === "string" && ref.length > 0 && !ids.has(ref)) {
          missing.push(`${node.id}.${field}→${ref}`);
          affected.push(node.id);
        }
      }
    }
  }

  if (missing.length === 0) {
    return {
      validatorId: "invalid_reference",
      status: "pass",
      severity: "hard",
      affectedNodeIds: [],
      evidence: [],
      explanation: "All references resolve",
      rootCauseCandidateIds: [],
      suggestedRepairNodeIds: []
    };
  }

  return {
    validatorId: "invalid_reference",
    status: "fail",
    severity: "hard",
    affectedNodeIds: [...new Set(affected)],
    evidence: missing,
    explanation: "INVALID_REFERENCE",
    rootCauseCandidateIds: [...new Set(affected)],
    suggestedRepairNodeIds: [...new Set(affected)]
  };
}
