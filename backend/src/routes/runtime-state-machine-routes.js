// Runtime State Machine + Host Exception Remediation — REST routes (缺口 M)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listRuntimeStateMachines,
  getRuntimeStateMachine,
  createRuntimeStateMachine,
  updateRuntimeStateMachine,
  deleteRuntimeStateMachine
} from "../runtime-state-machine-service.js";
import {
  listSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema
} from "./schemas/runtime-state-machine.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerRuntimeStateMachineRoutes(app) {
  app.get("/api/worlds/:worldId/runtime-state-machines", {
    schema: listSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listRuntimeStateMachines(worldId);
  });

  app.get("/api/worlds/:worldId/runtime-state-machines/:id", {
    schema: getSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const machine = await getRuntimeStateMachine(worldId, request.params.id);
    if (!machine) return sendErr(reply, "NOT_FOUND", "Runtime state machine not found");
    return machine;
  });

  app.post("/api/worlds/:worldId/runtime-state-machines", {
    schema: createSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const machine = await createRuntimeStateMachine(worldId, request.body);
    return reply.code(201).send(machine);
  });

  app.patch("/api/worlds/:worldId/runtime-state-machines/:id", {
    schema: updateSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const machine = await updateRuntimeStateMachine(worldId, request.params.id, request.body);
    if (!machine) return sendErr(reply, "NOT_FOUND", "Runtime state machine not found");
    return machine;
  });

  app.delete("/api/worlds/:worldId/runtime-state-machines/:id", {
    schema: deleteSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteRuntimeStateMachine(worldId, request.params.id);
    } catch (error) {
      if (error?.code === "NOT_FOUND") return sendErr(reply, "NOT_FOUND", "Runtime state machine not found");
      throw error;
    }
  });
}