import { requireActor } from "../request-actor.js";
import { query } from "../db.js";
import { sendErr } from "../api-errors.js";
import {
  createStripeCheckoutSession,
  handleStripeWebhook,
  isStripeConfigured
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
      if (!isStripeConfigured()) return sendErr(reply, "STRIPE_NOT_CONFIGURED");
      const actorId = requireActor(request);
      const { planCode } = request.body;

      const user = await query(
        `SELECT email, user_kind FROM users WHERE id = $1`,
        [actorId]
      );
      if (!user.rowCount) return sendErr(reply, "USER_NOT_FOUND");
      if (user.rows[0].user_kind === "guest") {
        return sendErr(reply, "AUTH_REQUIRED", "Guest accounts cannot subscribe");
      }
      const email = user.rows[0].email;
      if (!email) return sendErr(reply, "BAD_REQUEST", "Account email required for checkout");

      try {
        const session = await createStripeCheckoutSession({ userId: actorId, email, planCode });
        return reply.code(200).send(session);
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );
}
