import { sendErr } from "../api-errors.js";
import {
  checkPortalNameAvailability,
  confirmPortalAvatarUpload,
  findPublicPortalAvatar,
  getPortalProfile,
  getPortalProfiles,
  preparePortalAvatarUpload,
  removePortalAvatar,
  updatePortalDisplayName
} from "../portal-profile-service.js";
import { requireActor } from "../request-actor.js";
import { getObjectStorage } from "../storage/index.js";

const portalParams = {
  type: "object",
  required: ["portal"],
  properties: {
    portal: { type: "string", enum: ["creator", "host", "player"] }
  }
};

function handleProfileError(reply, error) {
  if (error.code && error.statusCode) {
    return sendErr(reply, error.code, error.message, error.details);
  }
  throw error;
}

export async function registerAccountProfileRoutes(app) {
  app.get("/api/account/portal-profiles", async (request) => {
    const actorId = requireActor(request);
    return { profiles: await getPortalProfiles(actorId) };
  });

  app.get("/api/account/portal-profiles/:portal", {
    schema: { params: portalParams }
  }, async (request, reply) => {
    try {
      return await getPortalProfile(requireActor(request), request.params.portal);
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });

  app.get("/api/account/portal-profiles/:portal/name-availability", {
    schema: {
      params: portalParams,
      querystring: {
        type: "object",
        required: ["displayName"],
        properties: {
          displayName: { type: "string", minLength: 1, maxLength: 80 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      return await checkPortalNameAvailability(
        requireActor(request),
        request.params.portal,
        request.query.displayName
      );
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });

  app.put("/api/account/portal-profiles/:portal/name", {
    schema: {
      params: portalParams,
      body: {
        type: "object",
        additionalProperties: false,
        required: ["displayName"],
        properties: {
          displayName: { type: "string", minLength: 1, maxLength: 80 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      return await updatePortalDisplayName(
        requireActor(request),
        request.params.portal,
        request.body.displayName
      );
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });

  app.post("/api/account/portal-profiles/:portal/avatar-upload-url", {
    schema: {
      params: portalParams,
      body: {
        type: "object",
        additionalProperties: false,
        required: ["filename", "contentType", "byteSize"],
        properties: {
          filename: { type: "string", minLength: 1, maxLength: 255 },
          contentType: { type: "string", minLength: 1, maxLength: 80 },
          byteSize: { type: "integer", minimum: 1, maximum: 2097152 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await preparePortalAvatarUpload(
        requireActor(request),
        request.params.portal,
        request.body
      );
      return reply.code(201).send(result);
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });

  app.post("/api/account/portal-profiles/:portal/avatar/confirm", {
    schema: {
      params: portalParams,
      body: {
        type: "object",
        additionalProperties: false,
        required: ["uploadId"],
        properties: {
          uploadId: { type: "string", format: "uuid" }
        }
      }
    }
  }, async (request, reply) => {
    try {
      return await confirmPortalAvatarUpload(
        requireActor(request),
        request.params.portal,
        request.body.uploadId
      );
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });

  app.delete("/api/account/portal-profiles/:portal/avatar", {
    schema: { params: portalParams }
  }, async (request, reply) => {
    try {
      return await removePortalAvatar(requireActor(request), request.params.portal);
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });

  app.get("/api/account/portal-avatars/:userId/:portal", {
    schema: {
      params: {
        type: "object",
        required: ["userId", "portal"],
        properties: {
          userId: { type: "string", format: "uuid" },
          portal: { type: "string", enum: ["creator", "host", "player"] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const avatar = await findPublicPortalAvatar(request.params.userId, request.params.portal);
      const stream = await getObjectStorage().streamObjectBytes({
        key: avatar.objectKey,
        maxBytes: 2097152
      });
      return reply
        .header("Content-Type", avatar.contentType)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .header("X-Content-Type-Options", "nosniff")
        .send(stream);
    } catch (error) {
      return handleProfileError(reply, error);
    }
  });
}
