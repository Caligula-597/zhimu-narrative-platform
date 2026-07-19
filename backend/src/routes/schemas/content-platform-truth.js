import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalText = (maxLength) => ({
  anyOf: [
    { type: "string", maxLength },
    { type: "null" }
  ]
});
const truthClaimProperties = {
  claimKey: optionalText(120),
  title: { type: "string", minLength: 1, maxLength: 200 },
  claim: { type: "string", minLength: 1, maxLength: 12_000 },
  revealStage: optionalText(120),
  confidence: { type: "string", enum: ["canon", "inferred", "misdirection", "unknown"] },
  evidence: { type: "array", maxItems: 100, items: metadataObject },
  contradictions: { type: "array", maxItems: 100, items: metadataObject },
  roleVisibility: metadataObject,
  metadata: metadataObject
};

export const truthClaimIdParams = paramsSchema({ worldId: uuid, claimId: uuid });

export const listTruthClaimsSchema = { params: worldIdParams };

export const createTruthClaimSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "claim"],
    properties: truthClaimProperties
  }
};

export const patchTruthClaimSchema = {
  params: truthClaimIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: truthClaimProperties
  }
};

export const deleteTruthClaimSchema = { params: truthClaimIdParams };
