import { z } from "zod";

export const RepairRequestSchema = z.object({
  id: z.string(),
  failureIds: z.array(z.string()),
  rootCauseNodeIds: z.array(z.string()),
  editableNodeIds: z.array(z.string()),
  immutableNodeIds: z.array(z.string()),
  requiredChanges: z.array(z.string()),
  forbiddenChanges: z.array(z.string()),
  downstreamInvalidationIds: z.array(z.string())
});
export type RepairRequest = z.infer<typeof RepairRequestSchema>;

export const PatchOperationSchema = z.object({
  operation: z.enum(["create_node", "update_node", "delete_node"]),
  nodeId: z.string().optional(),
  expectedVersion: z.number().int().optional(),
  changes: z.record(z.unknown())
});
export type PatchOperation = z.infer<typeof PatchOperationSchema>;
