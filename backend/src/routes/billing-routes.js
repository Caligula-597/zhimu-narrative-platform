import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { createBillingCheckoutSession } from "../billing-service.js";
import {
  handleStripeWebhook
} from "../stripe-billing.js";

export async function registerBillingRoutes(app) {
  app.post(
    "/api/billing/stripe/webhook",
    {
      preParsing: async (_request, payload) => {
        const chunks = [];
        for await (const chunk of payload) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buf = Buffer.concat(chunks);
        _request.rawBody = buf.toString("utf8");
        return buf;
      },
      schema: {
        hide: true,
        tags: ["billing"]
      }
    },
    async (request, reply) => {
      try {
        const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
        const signature = request.headers["stripe-signature"];
        const outcome = await handleStripeWebhook(rawBody, signature);
        return reply.code(200).send({ received: true, ...outcome });
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );

  app.post(
    "/api/billing/checkout-session",
    {
      schema: {
        hide: true,
        tags: ["billing"],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["planCode"],
          properties: {
            planCode: { type: "string", enum: ["creator", "studio"] }
          }
        }
      }
    },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { planCode } = request.body;
      try {
        const session = await createBillingCheckoutSession({ actorId, planCode });
        return reply.code(200).send(session);
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );
}
