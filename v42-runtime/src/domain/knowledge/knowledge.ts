import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";

export const FactNodeSchema = BaseNodeSchema.extend({
  type: z.literal("fact"),
  content: z.string(),
  truthStatus: z.boolean(),
  establishedByNodeIds: z.array(z.string()),
  timeRef: z.string().optional(),
  spaceRef: z.string().optional()
});
export type FactNode = z.infer<typeof FactNodeSchema>;

export const KnowledgeNodeSchema = BaseNodeSchema.extend({
  type: z.literal("knowledge"),
  characterId: z.string().min(1),
  content: z.string(),
  epistemicType: z.enum([
    "experienced",
    "reported",
    "inferred",
    "believed",
    "public"
  ]),
  sourceNodeIds: z.array(z.string()),
  certainty: z.enum(["certain", "likely", "uncertain"])
});
export type KnowledgeNode = z.infer<typeof KnowledgeNodeSchema>;
