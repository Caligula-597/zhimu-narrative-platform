import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";
import { StatePredicateSchema } from "../shared/state.js";

export const ObjectiveNodeSchema = BaseNodeSchema.extend({
  type: z.literal("objective"),
  characterId: z.string().optional(),
  scope: z.enum(["personal", "shared"]),
  priority: z.enum(["primary", "secondary"]),
  description: z.string(),
  desiredState: z.array(StatePredicateSchema),
  partialSuccessState: z.array(StatePredicateSchema).optional(),
  failureState: z.array(StatePredicateSchema).optional()
});
export type ObjectiveNode = z.infer<typeof ObjectiveNodeSchema>;

export const ObjectiveCompatibilitySchema = z.object({
  objectiveAId: z.string().min(1),
  objectiveBId: z.string().min(1),
  relation: z.enum([
    "compatible",
    "conditional",
    "conflicting",
    "mutually_exclusive"
  ]),
  reason: z.string()
});
export type ObjectiveCompatibility = z.infer<typeof ObjectiveCompatibilitySchema>;
