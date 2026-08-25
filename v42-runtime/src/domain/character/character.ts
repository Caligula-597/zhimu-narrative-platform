import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";

export const CharacterNodeSchema = BaseNodeSchema.extend({
  type: z.literal("character"),
  name: z.string().min(1),
  age: z.number().int().positive().optional(),
  identity: z.object({
    occupation: z.string().optional(),
    socialPosition: z.string().optional(),
    economicPosition: z.string().optional()
  }),
  capabilities: z.array(z.string()),
  limitations: z.array(z.string()),
  personality: z.array(z.string()),
  values: z.array(z.string()),
  initialSpaceId: z.string().optional()
});
export type CharacterNode = z.infer<typeof CharacterNodeSchema>;

export const BackgroundNodeSchema = BaseNodeSchema.extend({
  type: z.literal("background"),
  characterId: z.string().min(1),
  description: z.string(),
  relevance: z.enum([
    "identity",
    "relationship",
    "motivation",
    "capability",
    "attitude"
  ]),
  importance: z.enum(["core", "supporting", "ambient"])
});
export type BackgroundNode = z.infer<typeof BackgroundNodeSchema>;

export const SituationNodeSchema = BaseNodeSchema.extend({
  type: z.literal("situation"),
  characterId: z.string().min(1),
  description: z.string(),
  pressures: z.array(z.string()),
  opportunities: z.array(z.string()),
  risks: z.array(z.string()),
  resourceIds: z.array(z.string())
});
export type SituationNode = z.infer<typeof SituationNodeSchema>;
