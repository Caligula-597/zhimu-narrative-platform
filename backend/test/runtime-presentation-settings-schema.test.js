import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { updateRoomSettingsSchema } from "../src/routes/schemas/world.js";

async function validate(body) {
  const app = Fastify();
  app.patch("/api/rooms/:roomId/settings", { schema: updateRoomSettingsSchema }, async () => ({ ok: true }));
  const response = await app.inject({
    method: "PATCH",
    url: "/api/rooms/11111111-1111-4111-8111-111111111111/settings",
    payload: body
  });
  await app.close();
  return response;
}

test("room runtime presentation accepts field-level patches", async () => {
  const response = await validate({
    settings: {
      runtimePresentation: {
        mapVisible: false,
        updatedAt: "2026-08-10T14:00:00.000Z"
      }
    }
  });
  assert.equal(response.statusCode, 200, response.body);
});

test("room runtime presentation rejects empty and timestamp-only patches", async () => {
  const timestampOnly = await validate({
    settings: {
      runtimePresentation: { updatedAt: "2026-08-10T14:00:00.000Z" }
    }
  });
  assert.equal(timestampOnly.statusCode, 400);

  const missingTimestamp = await validate({
    settings: {
      runtimePresentation: { activeEncounter: null }
    }
  });
  assert.equal(missingTimestamp.statusCode, 400);
});

test("room runtime presentation accepts tabletop variable settlement and ending publication", async () => {
  const response = await validate({
    settings: {
      runtimePresentation: {
        variableValues: [{ id: "threat", value: 38 }],
        publishedEnding: {
          id: "escape",
          publishedAt: "2026-08-10T14:00:00.000Z"
        },
        updatedAt: "2026-08-10T14:00:00.000Z"
      }
    }
  });
  assert.equal(response.statusCode, 200, response.body);
});
