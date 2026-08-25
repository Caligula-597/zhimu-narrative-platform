import { z } from "zod";

export const DependencyRelationSchema = z.enum([
  "depends_on",
  "derived_from",
  "described_by",
  "validated_by"
]);
export type DependencyRelation = z.infer<typeof DependencyRelationSchema>;

export const DependencyEdgeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  relation: DependencyRelationSchema
});
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
