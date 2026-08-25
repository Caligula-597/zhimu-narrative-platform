import { z } from "zod";

export const ObjectiveProgressSchema = z.object({
  objectiveId: z.string(),
  status: z.enum(["active", "partial", "completed", "failed"]),
  matchedPredicates: z.number().int().nonnegative(),
  totalPredicates: z.number().int().nonnegative()
});
export type ObjectiveProgress = z.infer<typeof ObjectiveProgressSchema>;

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  currentTime: z.number(),
  characterLocations: z.record(z.string()),
  objectStates: z.record(z.unknown()),
  characterKnowledgeIds: z.record(z.array(z.string())),
  publicKnowledgeIds: z.array(z.string()),
  resourceStates: z.record(z.unknown()),
  objectiveProgress: z.record(ObjectiveProgressSchema),
  firedPlotEventIds: z.array(z.string()),
  activeGMRuleIds: z.array(z.string()),
  stateVariables: z.record(z.unknown())
});
export type SessionState = z.infer<typeof SessionStateSchema>;
