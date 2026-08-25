import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";
import {
  StateMutationSchema,
  StatePredicateSchema,
  TriggerRuleSchema
} from "../shared/state.js";

export const ReactiveBranchSchema = z.object({
  conditions: z.array(StatePredicateSchema),
  effects: z.array(StateMutationSchema),
  gmPresentation: z.string().optional()
});
export type ReactiveBranch = z.infer<typeof ReactiveBranchSchema>;

export const PlotEventNodeSchema = BaseNodeSchema.extend({
  type: z.literal("plot_event"),
  eventClass: z.enum(["fixed", "conditional", "reactive"]),
  title: z.string().min(1),
  trigger: TriggerRuleSchema,
  invariantEffects: z.array(StateMutationSchema),
  reactiveBranches: z.array(ReactiveBranchSchema),
  gmPresentation: z.string().optional(),
  repeatable: z.boolean()
});
export type PlotEventNode = z.infer<typeof PlotEventNodeSchema>;
