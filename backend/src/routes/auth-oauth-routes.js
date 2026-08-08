import { sessionRequestMeta } from "../auth.js";
import { fetchUserKind } from "../capabilities.js";
import { oauthFrontendReturnUrl } from "../oauth-providers.js";
import {
  buildOAuthAuthorizeUrl, completeOAuthLoginCode, createOAuthState, handleOAuthCallback
} from "../oauth-service.js";
import { sendErr } from "../api-errors.js";
import { sendAuthSession, userAuthPayload } from "./auth-route-shared.js";
import {
  oauthCallbackQuerySchema,
  oauthProviderErrorCode,
  oauthStartQuerySchema
} from "../oauth-request-policy.js";

const providerParams = {
  type: "object",
  required: ["provider"],
  properties: { provider: { type: "string", enum: ["google", "github"] } }
};

async function guestUserIdForRequest(request) {
  if (!request.actorId) return null;
  try {
    return (await fetchUserKind(request.actorId)) === "guest" ? request.actorId : null;
  } catch {
    return null;
  }
}

export async function registerAuthOAuthRoutes(app) {
  app.get("/api/auth/oauth/:provider/start", {
    schema: { params: providerParams, querystring: oauthStartQuerySchema }
  }, async (request, reply) => {
    const { provider } = request.params;
    const state = await createOAuthState(provider, await guestUserIdForRequest(request), request.query?.returnOrigin);
    return reply.redirect(buildOAuthAuthorizeUrl(provider, state));
  });

  app.post("/api/auth/oauth/:provider/start-url", {
    schema: {
      params: providerParams,
      body: {
        type: "object", additionalProperties: false,
        properties: { returnOrigin: { type: "string", minLength: 8, maxLength: 200 } }
      }
    }
  }, async (request) => {
    const { provider } = request.params;
    const state = await createOAuthState(provider, await guestUserIdForRequest(request), request.body?.returnOrigin);
    return { url: buildOAuthAuthorizeUrl(provider, state) };
  });

  app.get("/api/auth/oauth/:provider/callback", {
    schema: { params: providerParams, querystring: oauthCallbackQuerySchema }
  }, async (request, reply) => {
    const { provider } = request.params;
    const code = String(request.query?.code ?? "");
    const state = String(request.query?.state ?? "");
    const oauthError = String(request.query?.error ?? "");
    const frontend = new URL(oauthFrontendReturnUrl());
    if (oauthError) {
      frontend.searchParams.set("oauth_error", oauthProviderErrorCode(oauthError));
      return reply.redirect(frontend.toString());
    }
    if (!code || !state) return sendErr(reply, "BAD_REQUEST");
    try {
      return reply.redirect(await handleOAuthCallback(provider, { code, state }));
    } catch (error) {
      request.log.warn({ err: error, provider }, "oauth callback failed");
      const errorCode = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]*$/.test(error.code)
        ? error.code : "OAUTH_EXCHANGE_FAILED";
      frontend.searchParams.set("oauth_error", errorCode);
      return reply.redirect(frontend.toString());
    }
  });

  app.post("/api/auth/oauth/complete", {
    schema: {
      body: {
        type: "object", additionalProperties: false, required: ["code"],
        properties: { code: { type: "string", minLength: 16, maxLength: 128 } }
      }
    }
  }, async (request, reply) => {
    const result = await completeOAuthLoginCode(request.body.code, sessionRequestMeta(request));
    return sendAuthSession(reply, {
      token: result.token, expiresAt: result.expiresAt, sessionId: result.sessionId
    }, { user: userAuthPayload(result.user) }, 200);
  });
}
