import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";
import {
  ObservationRuleSchema,
  StateMutationSchema,
  StatePredicateSchema
} from "../shared/state.js";

export const ActionDefinitionSchema = z.object({
  id: z.string().min(1),
  actionType: z.string().min(1),
  preconditions: z.array(StatePredicateSchema),
  execution: z.enum(["automatic", "rule_based", "gm_adjudicated"]),
  costs: z.array(StateMutationSchema),
  effects: z.array(StateMutationSchema),
  observableEffects: z.array(ObservationRuleSchema)
});
export type ActionDefinition = z.infer<typeof ActionDefinitionSchema>;

export const MechanicNodeSchema = BaseNodeSchema.extend({
  type: z.literal("mechanic"),
  name: z.string().min(1),
  diegeticSource: z.string(),
  relevantObjectiveIds: z.array(z.string()),
  availability: z.array(StatePredicateSchema),
  actionDefinitions: z.array(ActionDefinitionSchema),
  coupledMechanicIds: z.array(z.string())
});
export type MechanicNode = z.infer<typeof MechanicNodeSchema>;
