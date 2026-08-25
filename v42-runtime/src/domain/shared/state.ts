import { z } from "zod";

export const StatePredicateSchema = z.object({
  path: z.string().min(1),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "exists",
    "greater_than",
    "less_than"
  ]),
  value: z.unknown().optional()
});
export type StatePredicate = z.infer<typeof StatePredicateSchema>;

export const StateMutationSchema = z.object({
  path: z.string().min(1),
  operation: z.enum(["set", "add", "remove", "increment", "append"]),
  value: z.unknown()
});
export type StateMutation = z.infer<typeof StateMutationSchema>;

export const TriggerRuleSchema = z.object({
  type: z.enum(["time", "state", "manual_gm", "compound"]),
  predicates: z.array(StatePredicateSchema)
});
export type TriggerRule = z.infer<typeof TriggerRuleSchema>;

export const ObservationRuleSchema = z.object({
  observerCharacterIds: z.array(z.string()).default([]),
  visibility: z.enum(["public", "private", "conditional"]).default("private"),
  description: z.string().optional()
});
export type ObservationRule = z.infer<typeof ObservationRuleSchema>;
