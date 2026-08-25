import { z } from "zod";
import type { StateMutation } from "../../domain/shared/state.js";
import type { SessionState } from "../state/session-state.js";
import type { MechanicNode } from "../../domain/mechanic/mechanic.js";
import { NotImplementedError } from "../../core/errors.js";

export const OpenActionRequestSchema = z.object({
  actorId: z.string(),
  description: z.string(),
  targetIds: z.array(z.string()),
  locationId: z.string(),
  sessionTime: z.number()
});
export type OpenActionRequest = z.infer<typeof OpenActionRequestSchema>;

export const ObservationEventSchema = z.object({
  observerIds: z.array(z.string()),
  content: z.string()
});

export const ActionResolutionSchema = z.object({
  possible: z.boolean(),
  reason: z.string(),
  timeCostSeconds: z.number(),
  mutations: z.array(z.any()),
  observations: z.array(ObservationEventSchema)
});
export type ActionResolution = z.infer<typeof ActionResolutionSchema>;

export interface ProjectRuntimeDesign {
  mechanics: MechanicNode[];
}

export async function resolveAction(
  _request: OpenActionRequest,
  _state: SessionState,
  _project: ProjectRuntimeDesign
): Promise<ActionResolution> {
  throw new NotImplementedError("resolveAction / open action adjudicator");
}

export type { StateMutation };
