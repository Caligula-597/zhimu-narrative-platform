import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";

export const SpaceConnectionSchema = z.object({
  targetSpaceId: z.string().min(1),
  type: z.enum(["door", "hallway", "stairs", "open", "other"]),
  travelTimeSeconds: z.number().nonnegative().optional()
});
export type SpaceConnection = z.infer<typeof SpaceConnectionSchema>;

export const SpaceNodeSchema = BaseNodeSchema.extend({
  type: z.literal("space"),
  name: z.string().min(1),
  parentSpaceId: z.string().optional(),
  connections: z.array(SpaceConnectionSchema),
  physicalAccess: z.array(z.object({ condition: z.string() })),
  formalAccess: z.object({
    characterIds: z.array(z.string()).optional(),
    identityConditions: z.array(z.string()).optional()
  }),
  socialLegitimacy: z.object({
    normalFor: z.array(z.string()),
    unusualFor: z.array(z.string())
  }),
  visibilityTo: z.array(z.string()),
  soundReachTo: z.array(z.string()),
  objectIds: z.array(z.string())
});
export type SpaceNode = z.infer<typeof SpaceNodeSchema>;
