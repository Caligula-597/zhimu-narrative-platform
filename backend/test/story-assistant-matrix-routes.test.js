import assert from "node:assert/strict";
import test from "node:test";
import { registerStoryAssistantMatrixRoutes } from "../src/routes/story-assistant-matrix-routes.js";

test("story assistant matrix routes keep explicit schemas and the LLM pre-handler", () => {
  const registered = [];
  const app = {
    post(path, options, handler) {
      registered.push({ path, options, handler });
    }
  };
  const preHandler = () => {};

  registerStoryAssistantMatrixRoutes(app, { preHandler });

  assert.deepEqual(registered.map(({ path }) => path), [
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/truth",
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/characters",
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/clue-network",
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/info-matrix",
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/host-runbook",
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/player-script",
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/evaluate",
    "/api/worlds/:worldId/story-assistant/deepseek/pipeline/matrix/sync-preview"
  ]);
  for (const route of registered) {
    assert.equal(route.options.preHandler, preHandler);
    assert.equal(typeof route.options.schema, "object");
    assert.equal(typeof route.handler, "function");
  }
});
