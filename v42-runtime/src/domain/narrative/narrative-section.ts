import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";

export const NarrativeSectionSchema = BaseNodeSchema.extend({
  type: z.literal("narrative_section"),
  characterId: z.string().optional(),
  order: z.number().int().nonnegative(),
  sourceNodeIds: z.array(z.string()),
  knowledgeScopeIds: z.array(z.string()),
  text: z.string(),
  styleAnchorIds: z.array(z.string()),
  lockedText: z.boolean()
});
export type NarrativeSection = z.infer<typeof NarrativeSectionSchema>;
