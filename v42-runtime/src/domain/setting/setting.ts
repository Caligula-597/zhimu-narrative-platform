import { z } from "zod";
import { BaseNodeSchema } from "../shared/base-node.js";

export const SettingNodeSchema = BaseNodeSchema.extend({
  type: z.literal("setting"),
  timePeriod: z.string().optional(),
  location: z.string().optional(),
  technology: z.array(z.string()),
  medicine: z.array(z.string()),
  transportation: z.array(z.string()),
  communication: z.array(z.string()),
  tools: z.array(z.string()),
  socialNorms: z.array(z.string()),
  legalNorms: z.array(z.string()),
  languageConstraints: z.array(z.string()),
  unknowns: z.array(z.string()),
  description: z.string()
});
export type SettingNode = z.infer<typeof SettingNodeSchema>;
