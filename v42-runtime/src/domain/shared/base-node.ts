import { z } from "zod";

export const NodeStatusSchema = z.enum([
  "draft",
  "validated",
  "locked",
  "invalidated"
]);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const NodeTypeSchema = z.enum([
  "setting",
  "space",
  "character",
  "background",
  "relationship",
  "situation",
  "motivation",
  "objective",
  "plot_event",
  "mechanic",
  "fact",
  "knowledge",
  "object",
  "gm_rule",
  "resolution",
  "narrative_section"
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const BaseNodeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: NodeTypeSchema,
  version: z.number().int().nonnegative(),
  status: NodeStatusSchema,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lockLevel: z.number().int().nonnegative(),
  tags: z.array(z.string())
});
export type BaseNode = z.infer<typeof BaseNodeSchema>;
