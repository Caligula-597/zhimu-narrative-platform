import { throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { bootstrapWorldFromWizard } from "../world-wizard-bootstrap.js";
import {
  listWorldTemplates,
  getWorldTemplate,
  buildBootstrapPayloadFromTemplate
} from "../world-templates.js";
import { bootstrapWorldWizardSchema, createWorldFromTemplateSchema } from "./schemas.js";

export async function registerWorldWizardRoutes(app) {
  app.get("/api/platform/world-templates", async () => ({
    templates: listWorldTemplates()
  }));

  app.post("/api/worlds/wizard/bootstrap", { schema: bootstrapWorldWizardSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      const result = await bootstrapWorldFromWizard(actorId, request.body ?? {});
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
  });

  app.post(
    "/api/worlds/from-template/:templateId",
    { schema: createWorldFromTemplateSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { templateId } = request.params;
      if (!getWorldTemplate(templateId)) throwErr("WORLD_TEMPLATE_NOT_FOUND");
      const payload = buildBootstrapPayloadFromTemplate(templateId, request.body ?? {});
      try {
        const result = await bootstrapWorldFromWizard(actorId, payload);
        return reply.code(201).send({ templateId, ...result });
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
