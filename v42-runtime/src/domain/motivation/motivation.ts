import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";

export const MotivationNodeSchema = BaseNodeSchema.extend({
  type: z.literal("motivation"),
  characterId: z.string().min(1),
  description: z.string(),
  sourceNodeIds: z.array(z.string()),
  priority: z.enum(["primary", "secondary", "minor"]),
  conflictWithMotivationIds: z.array(z.string()),
  active: z.boolean()
});
export type MotivationNode = z.infer<typeof MotivationNodeSchema>;
