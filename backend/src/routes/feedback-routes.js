import { submitFeedback } from "../feedback.js";

const feedbackResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "kind", "subject", "status", "created_at"],
  properties: {
    id: { type: "string", format: "uuid" },
    kind: { type: "string", enum: ["feedback", "bug", "feature", "satisfaction"] },
    subject: { type: "string" },
    status: { type: "string", enum: ["new", "seen", "resolved"] },
    created_at: { type: "string", format: "date-time" }
  }
};

export async function registerFeedbackRoutes(app) {
  app.post(
    "/api/feedback",
    {
      schema: {
        summary: "Submit user feedback / bug report",
        description:
          "Public endpoint (no auth required) for in-app feedback, bug reports, and feature requests. " +
          "Rate-limited per IP (RATE_LIMIT_FEEDBACK_MAX per hour).",
        tags: ["platform"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["subject", "body"],
          properties: {
            kind: { type: "string", enum: ["feedback", "bug", "feature", "satisfaction"], default: "feedback" },
            subject: { type: "string", minLength: 1, maxLength: 200 },
            body: { type: "string", minLength: 1, maxLength: 4000 },
            pageUrl: { type: "string", maxLength: 500 },
            userAgent: { type: "string", maxLength: 500 },
            roomId: { type: "string", format: "uuid" }
          }
        },
        response: {
          201: feedbackResponseSchema,
          400: {
            type: "object",
            additionalProperties: false,
            properties: {
              error: { type: "string" },
              code: { type: "string" }
            }
          },
          429: {
            type: "object",
            additionalProperties: false,
            properties: {
              error: { type: "string" },
              code: { type: "string" }
            }
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
