import { requireActor } from "../request-actor.js";
import { bindUserLlmContext } from "../user-llm.js";

export function createLlmContextPreHandler(sendErr) {
  return async (request, reply) => {
    try {
      await bindUserLlmContext(requireActor(request));
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  };
}
