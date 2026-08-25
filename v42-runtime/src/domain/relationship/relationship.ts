import { z } from "zod";

export const RelationshipEdgeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fromCharacterId: z.string().min(1),
  toCharacterId: z.string().min(1),
  version: z.number().int().nonnegative(),
  basisNodeIds: z.array(z.string()),
  perception: z.string(),
  trust: z.number().min(0).max(1).optional(),
  closeness: z.number().min(0).max(1).optional(),
  unresolvedIssues: z.array(z.string())
});
export type RelationshipEdge = z.infer<typeof RelationshipEdgeSchema>;
