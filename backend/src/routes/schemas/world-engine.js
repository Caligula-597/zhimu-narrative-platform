import { worldIdParams } from "./world.js";

const action = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: { type: "string", maxLength: 40 },
    actor: { type: "string", maxLength: 40 },
    counterparty: { type: "string", maxLength: 40 },
    patient: { type: "string", maxLength: 40 },
    employee: { type: "string", maxLength: 40 },
    to: { type: "string", maxLength: 40 },
    payee: { type: "string", maxLength: 40 },
    objectId: { type: "string", maxLength: 40 },
    objectType: { type: "string", maxLength: 40 },
    locationId: { type: "string", maxLength: 40 },
    roleKey: { type: "string", maxLength: 40 },
    amount: { type: "number" },
    cost: { type: "number" },
    currency: { type: "string", maxLength: 8 },
    holder: { type: "string", maxLength: 40 },
    audience: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 12 },
    proposition: { type: "object", additionalProperties: true },
    fields: { type: "object", additionalProperties: true }
  }
};

const eventDraft = {
  type: "object",
  additionalProperties: false,
  properties: {
    locationId: { type: "string", maxLength: 40 },
    actions: { type: "array", items: action, minItems: 1, maxItems: 8 },
    edges: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "from", "to"],
        properties: {
          type: { type: "string", enum: ["caused_by"] },
          from: { type: "integer", minimum: 0, maximum: 7 },
          to: { type: "integer", minimum: 0, maximum: 7 }
        }
      }
    }
  }
};

export const worldEngineGetSchema = { params: worldIdParams };

export const worldEngineSeedSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", maxLength: 80 },
      inspiration: { type: "string", maxLength: 800 },
      banned: { type: "string", maxLength: 800 },
      venueKey: { type: "string", enum: ["photo_studio", "bus_station", "tv_station", "hotel"] },
      era: { type: "string", enum: ["contemporary", "2000s", "1990s", "republican", "ancient", "near_future"] },
      playerCount: { type: "integer", minimum: 4, maximum: 8 },
      dramaLevel: { type: "integer", minimum: 1, maximum: 6 },
      genres: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 6 },
      allowed: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 20 }
    }
  }
};

export const worldEngineSearchSchema = { params: worldIdParams, body: { type: "object", additionalProperties: false, properties: {} } };

export const worldEngineCommitSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      candidateIds: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 12 },
      event: eventDraft
    }
  }
};

export const worldEngineLowerTypeSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["actionType"],
    properties: { actionType: { type: "string", maxLength: 40 } }
  }
};

export const worldEngineEpistemicCommitSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["indexes"],
    properties: {
      indexes: { type: "array", items: { type: "integer", minimum: 0, maximum: 20 }, minItems: 1, maxItems: 8 }
    }
  }
};

export const worldEngineRenderSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["characterId"],
    properties: {
      characterId: { type: "string", maxLength: 40 },
      actId: { type: "string", maxLength: 20 }
    }
  }
};

export const worldEngineRepairSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["characterId", "text"],
    properties: {
      characterId: { type: "string", maxLength: 40 },
      actId: { type: "string", maxLength: 20 },
      text: { type: "string", minLength: 1, maxLength: 20_000 }
    }
  }
};