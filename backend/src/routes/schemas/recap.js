import { paramsSchema, uuid } from "./primitives.js";

export const recapRoomParams = paramsSchema({ roomId: uuid });
export const recapIdParams = paramsSchema({ roomId: uuid, recapId: uuid });

export const listRecapsSchema = { params: recapRoomParams };
export const latestRecapSchema = { params: recapRoomParams };
export const recapDetailSchema = { params: recapIdParams };

export const createRecapSchema = {
  params: recapRoomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
      description: { type: "string", maxLength: 2000 }
    }
  }
};
