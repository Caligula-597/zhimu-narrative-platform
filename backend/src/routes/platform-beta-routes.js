import { getBetaApplicationFormConfig, submitBetaApplication } from "../beta-apply.js";
import { sendErr } from "../api-errors.js";
import { submitBetaApplicationSchema } from "./schemas.js";

export async function registerPlatformBetaRoutes(app) {
  app.get(
    "/api/platform/beta",
    {
      schema: {
        tags: ["platform"],
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async () => getBetaApplicationFormConfig()
  );

  app.post(
    "/api/platform/beta/apply",
    { schema: submitBetaApplicationSchema },
    async (request, reply) => {
      try {
        const result = await submitBetaApplication(request.body ?? {});
        return reply.code(201).send(result);
      } catch (error) {
        if (error.code && error.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: error.code,
            ...(error.details !== undefined ? { details: error.details } : {})
          });
        }
        throw error;
      }
    }
  );
}
