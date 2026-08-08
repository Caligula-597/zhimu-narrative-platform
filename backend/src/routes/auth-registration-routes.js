import { sessionRequestMeta } from "../auth.js";
import {
  createGuestIdentity,
  registerIdentity,
  upgradeGuestIdentity
} from "../auth-registration-service.js";
import { requireActor } from "../request-actor.js";
import { getPublicEmailServiceStatus } from "../email.js";
import { isEmailVerificationRequired } from "../email-verification-policy.js";
import { listEnabledOAuthProviders } from "../oauth-providers.js";
import {
  authBodySchema,
  sendAuthSession,
  userAuthPayload
} from "./auth-route-shared.js";

export async function registerAuthRegistrationRoutes(app) {
  app.get("/api/auth/config", async () => ({
    requireEmailVerification: isEmailVerificationRequired(),
    email: getPublicEmailServiceStatus(),
    oauth: listEnabledOAuthProviders()
  }));

  app.post("/api/auth/register", {
    schema: {
      body: {
        ...authBodySchema,
        required: ["email", "displayName", "password"],
        properties: {
          ...authBodySchema.properties,
          displayName: { type: "string", minLength: 2, maxLength: 40 }
        }
      }
    }
  }, async (request, reply) => {
    const result = await registerIdentity({
      body: request.body,
      ip: request.ip,
      sessionMeta: sessionRequestMeta(request),
      logger: request.log
    });
    const payload = {
      user: userAuthPayload(result.user),
      acceptedInvites: result.acceptedInvites,
      pendingEmailVerification: result.pendingEmailVerification,
      verificationEmailSent: result.verificationEmailSent,
      verificationChallenge: result.verificationChallenge
    };
    if (result.pendingEmailVerification) {
      return reply.code(201).send({
        ...payload,
        message: result.verificationEmailSent
          ? "Registration successful. Please verify your email before creating worlds."
          : "Registration successful. Verification delivery is delayed; request a new code."
      });
    }
    return sendAuthSession(reply, result.session, payload, 201);
  });

  app.post("/api/auth/guest", {
    schema: {
      body: {
        type: "object", additionalProperties: false,
        properties: {
          displayName: { type: "string", minLength: 2, maxLength: 40 },
          deviceLabel: { type: "string", minLength: 1, maxLength: 80 }
        }
      }
    }
  }, async (request, reply) => {
    const result = await createGuestIdentity({
      displayName: request.body?.displayName,
      ip: request.ip,
      sessionMeta: sessionRequestMeta(request)
    });
    return sendAuthSession(reply, result.session, { user: userAuthPayload(result.user) }, 201);
  });

  app.post("/api/auth/upgrade", {
    schema: {
      body: {
        type: "object", additionalProperties: false,
        required: ["email", "displayName", "password"],
        properties: {
          email: { type: "string", minLength: 3, maxLength: 320 },
          displayName: { type: "string", minLength: 2, maxLength: 40 },
          password: { type: "string", minLength: 8, maxLength: 128 }
        }
      }
    }
  }, async (request, reply) => {
    const result = await upgradeGuestIdentity({
      actorId: requireActor(request),
      body: request.body,
      ip: request.ip,
      sessionMeta: sessionRequestMeta(request),
      logger: request.log
    });
    return sendAuthSession(reply, result.session, {
      user: userAuthPayload(result.user),
      acceptedInvites: result.acceptedInvites,
      pendingEmailVerification: result.pendingEmailVerification,
      verificationEmailSent: result.verificationEmailSent,
      verificationChallenge: result.verificationChallenge
    }, 200);
  });
}
