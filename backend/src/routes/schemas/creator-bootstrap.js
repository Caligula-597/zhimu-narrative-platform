import { worldIdParams } from "./world.js";

export const creatorBootstrapSchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      roomId: { type: "string", format: "uuid" }
    }
  }
};
