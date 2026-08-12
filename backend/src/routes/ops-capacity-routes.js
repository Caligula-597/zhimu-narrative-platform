import { sendErr } from "../api-errors.js";
import { capacityProbeDenial } from "../capacity-probe-policy.js";
import { emitCapacityProbe } from "../capacity-probe-service.js";

const PROBE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u;

export async function registerOpsCapacityRoutes(app) {
  app.post(
    "/api/ops/capacity/rooms/:roomId/events",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["roomId"],
          properties: { roomId: { type: "string", minLength: 1, maxLength: 200 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["probeId"],
          properties: { probeId: { type: "string", minLength: 1, maxLength: 100 } }
        },
        response: {
          200: { type: "object", additionalProperties: false, required: ["ok", "probeId", "emittedAt"], properties: {
            ok: { type: "boolean" },
            probeId: { type: "string" },
            emittedAt: { type: "string" }
          } }
        }
      }
    },
    async (request, reply) => {
      const denial = capacityProbeDenial(request.params.roomId);
      if (denial) return sendErr(reply, "UNAVAILABLE", "Capacity probe unavailable", { reason: denial });
      if (!PROBE_ID_PATTERN.test(request.body.probeId)) {
        return sendErr(reply, "BAD_REQUEST", "probeId contains unsupported characters");
      }
      try {
        return await emitCapacityProbe(request.params.roomId, request.body.probeId);
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );
}
