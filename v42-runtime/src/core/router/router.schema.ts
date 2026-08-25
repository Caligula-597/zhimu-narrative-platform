import { z } from "zod";

export const ModuleFlagSchema = z.object({
  enabled: z.boolean(),
  design: z.boolean(),
  validation: z.boolean(),
  editorial: z.boolean(),
  strictness: z.enum(["light", "normal", "hard"]).optional(),
  triggerSource: z.array(z.string())
});
export type ModuleFlag = z.infer<typeof ModuleFlagSchema>;

export const RouterResultSchema = z.object({
  core: z.literal(true),
  modules: z.record(ModuleFlagSchema)
});
export type RouterResult = z.infer<typeof RouterResultSchema>;

export const RequirementParseResultSchema = z.object({
  requested_capabilities: z.array(z.string()),
  explicitly_disabled: z.array(z.string())
});
export type RequirementParseResult = z.infer<typeof RequirementParseResultSchema>;
