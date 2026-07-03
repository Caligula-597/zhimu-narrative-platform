import { submitFeedback } from "../feedback.js";

export async function registerFeedbackRoutes(app) {
  app.post(
    "/api/feedback",
    {
      schema: {
        tags: ["platform"],
        body: {
          type: "object",
          required: ["subject", "body"],
          properties: {
            kind: { type: "string", enum: ["feedback", "bug", "feature"] },
            subject: { type: "string", minLength: 1, maxLength: 200 },
            body: { type: "string", minLength: 1, maxLength: 4000 },
            pageUrl: { type: "string", maxLength: 500 },
            userAgent: { type: "string", maxLength: 500 }
          }
        },
        response: {
          201: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const result = await submitFeedback(request.body, request.actorId);
        return reply.code(201).send(result);
      } catch (error) {
        if (error.code && error.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: error.code
          });
        }
        throw error;
      }
    }
  );
}
