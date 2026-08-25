import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";
import { TriggerRuleSchema } from "../shared/state.js";

export const GMRuleNodeSchema = BaseNodeSchema.extend({
  type: z.literal("gm_rule"),
  ruleType: z.enum([
    "public_rule",
    "contextual_rule",
    "hidden_adjudication",
    "scene_bridge",
    "fallback"
  ]),
  trigger: TriggerRuleSchema.optional(),
  instruction: z.string(),
  playerFacingText: z.string().optional(),
  interventionLevel: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5)
  ]).optional(),
  priority: z.number().int()
});
export type GMRuleNode = z.infer<typeof GMRuleNodeSchema>;
