import { httpError, sendErr, throwErr } from "./api-errors.js";
import { assertContentPlatformEditor } from "./content-platform-access-service.js";
import { configureContentPlatformTransaction } from "./repositories/content-platform-access-repository.js";
import {
  createWorldTruthClaim,
  deleteWorldTruthClaim,
  listWorldTruthClaims,
  lockWorldTruthClaim,
  readTruthClaimReferenceCounts,
  updateWorldTruthClaim
} from "./repositories/content-platform-truth-repository.js";
import { runRevisionMutation } from "./world-revision.js";

export function normalizeContentPlatformTruthError(error) {
  if (error?.code === "23505") {
    return httpError(409, "Truth claim key already exists in this world", "TRUTH_CLAIM_KEY_CONFLICT");
  }
  if (["40P01", "55P03"].includes(error?.code)) {
    return httpError(409, "Truth claim write is busy; retry shortly", "CONTENT_PLATFORM_WRITE_BUSY");
  }
  if (error?.code === "57014") {
    return httpError(503, "Truth claim write exceeded its safe execution window", "CONTENT_PLATFORM_WRITE_TIMEOUT");
  }
  return error;
}

function requiredText(value, code, field) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throwErr(code, `${field} cannot be empty`);
  return normalized;
}

function optionalText(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function createPayload(body) {
  return {
    claimKey: optionalText(body.claimKey),
    title: requiredText(body.title, "TITLE_EMPTY", "title"),
    claim: requiredText(body.claim, "TRUTH_CLAIM_EMPTY", "claim"),
    revealStage: optionalText(body.revealStage),
    confidence: body.confidence ?? "canon",
    evidence: body.evidence ?? [],
    contradictions: body.contradictions ?? [],
    roleVisibility: body.roleVisibility ?? {},
    metadata: body.metadata ?? {}
  };
}

function patchPayload(body) {
  const hasClaimKey = Object.hasOwn(body, "claimKey");
  const hasRevealStage = Object.hasOwn(body, "revealStage");
  return {
    ...body,
    hasClaimKey,
    claimKey: hasClaimKey ? optionalText(body.claimKey) : undefined,
    title: body.title === undefined ? undefined : requiredText(body.title, "TITLE_EMPTY", "title"),
    claim: body.claim === undefined ? undefined : requiredText(body.claim, "TRUTH_CLAIM_EMPTY", "claim"),
    hasRevealStage,
    revealStage: hasRevealStage ? optionalText(body.revealStage) : undefined
  };
}

async function runTruthMutation({ request, reply, actorId, worldId, statusCode, mutate }) {
  try {
    return await runRevisionMutation(request, reply, worldId, async (client) => {
      await assertContentPlatformEditor(client, { worldId, actorId });
      return mutate(client);
    }, {
      sendErr,
      statusCode,
      configureClient: configureContentPlatformTransaction
    });
  } catch (error) {
    throw normalizeContentPlatformTruthError(error);
  }
}

export async function getWorldTruthClaims(worldId) {
  return { claims: await listWorldTruthClaims(worldId) };
}

export function addWorldTruthClaim({ request, reply, actorId, worldId, body }) {
  const normalized = createPayload(body);
  return runTruthMutation({
    request,
    reply,
    actorId,
    worldId,
    statusCode: 201,
    mutate: async (client) => ({
      claim: await createWorldTruthClaim(client, { worldId, body: normalized })
    })
  });
}

export function reviseWorldTruthClaim({ request, reply, actorId, worldId, claimId, body }) {
  const normalized = patchPayload(body);
  return runTruthMutation({
    request,
    reply,
    actorId,
    worldId,
    mutate: async (client) => {
      if (!await lockWorldTruthClaim(client, { worldId, claimId })) {
        throwErr("TRUTH_CLAIM_NOT_FOUND");
      }
      const claim = await updateWorldTruthClaim(client, {
        worldId,
        claimId,
        body: normalized
      });
      if (!claim) throwErr("TRUTH_CLAIM_NOT_FOUND");
      return { claim };
    }
  });
}

export function removeWorldTruthClaim({ request, reply, actorId, worldId, claimId }) {
  return runTruthMutation({
    request,
    reply,
    actorId,
    worldId,
    mutate: async (client) => {
      if (!await lockWorldTruthClaim(client, { worldId, claimId })) {
        throwErr("TRUTH_CLAIM_NOT_FOUND");
      }
      const references = await readTruthClaimReferenceCounts(client, { worldId, claimId });
      if (references.segments > 0) {
        throwErr("TRUTH_CLAIM_REFERENCED", undefined, { references });
      }
      if (!await deleteWorldTruthClaim(client, { worldId, claimId })) {
        throwErr("TRUTH_CLAIM_NOT_FOUND");
      }
      return { ok: true };
    }
  });
}
