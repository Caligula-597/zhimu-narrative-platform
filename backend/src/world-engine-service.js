import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import {
  applyTransform,
  auditScriptText,
  compileQuery,
  compileWorld,
  createLedgerFromSeed,
  listVenueOptions,
  rememberedView,
  validateAmbiguityRisk,
  validateTransform
} from "../../shared/world-engine/index.js";
import {
  renderCharacterAct,
  searchEpistemicCandidates,
  searchEventCandidates
} from "./world-engine-llm.js";
import { commitEvent } from "../../shared/world-engine/engine.js";

function publicView(ledger) {
  const compiled = compileWorld(ledger);
  return {
    version: ledger.version,
    seed: ledger.seed,
    characters: ledger.characters,
    objects: ledger.objects,
    accounts: ledger.accounts,
    debts: ledger.debts,
    eventLog: ledger.eventLog,
    transforms: ledger.transforms,
    authorNotes: ledger.authorNotes,
    loweredTypes: ledger.loweredTypes,
    candidates: ledger.candidates,
    epistemicCandidates: ledger.epistemicCandidates,
    scripts: ledger.scripts,
    dailyProcess: ledger.dailyProcess,
    venues: listVenueOptions(),
    compiled,
    playability: compiled.playability
  };
}

export async function loadWorldEngine(worldId) {
  const result = await query(`SELECT settings FROM worlds WHERE id = $1`, [worldId]);
  if (!result.rowCount) throwErr("WORLD_NOT_FOUND");
  const ledger = result.rows[0].settings?.worldEngine || null;
  return {
    ledger,
    view: ledger ? publicView(ledger) : { venues: listVenueOptions(), ledger: null }
  };
}

async function saveLedger(client, worldId, ledger) {
  const result = await client.query(
    `UPDATE worlds
     SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [worldId, JSON.stringify({ worldEngine: ledger })]
  );
  if (!result.rowCount) throwErr("WORLD_NOT_FOUND");
}

export async function seedWorldEngine(client, worldId, seed) {
  const ledger = createLedgerFromSeed(seed);
  await saveLedger(client, worldId, ledger);
  return publicView(ledger);
}

export async function searchWorldEngineEvents(worldId) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  return searchEventCandidates(ledger);
}

export async function storeWorldEngineCandidates(client, worldId, searched) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  const next = {
    ...ledger,
    candidates: {
      batchId: `BAT_${Date.now()}`,
      items: searched.kept || []
    }
  };
  await saveLedger(client, worldId, next);
  return { ...publicView(next), rejected: searched.rejected || [], model: searched.model };
}

export async function commitWorldEngineEvents(client, worldId, candidateIds = [], eventDraft = null) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  let next = ledger;
  const committed = [];
  if (eventDraft?.actions) {
    const result = commitEvent(next, eventDraft);
    if (!result.ok) throwErr("WORLD_ENGINE_EVENT_INVALID", result.issues.join("；"), { issues: result.issues });
    next = result.ledger;
    committed.push(result.event.eventId);
  }
  for (const candidateId of candidateIds) {
    const candidate = (next.candidates?.items || []).find((row) => row.candidateId === candidateId);
    if (!candidate) throwErr("WORLD_ENGINE_CANDIDATE_NOT_FOUND", undefined, { candidateId });
    const result = commitEvent(next, candidate);
    if (!result.ok) throwErr("WORLD_ENGINE_EVENT_INVALID", result.issues.join("；"), { issues: result.issues });
    next = result.ledger;
    committed.push(result.event.eventId);
  }
  next.candidates = null;
  await saveLedger(client, worldId, next);
  return { ...publicView(next), committed };
}

export async function lowerWorldEngineType(client, worldId, actionType) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  const next = {
    ...ledger,
    loweredTypes: [...new Set([...(ledger.loweredTypes || []), String(actionType || "")].filter(Boolean))]
  };
  await saveLedger(client, worldId, next);
  return publicView(next);
}

export async function searchWorldEngineEpistemic(worldId) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  if (!ledger.eventLog?.length) throwErr("WORLD_ENGINE_EVENT_INVALID", "需要先写入 Canonical Event");
  const searched = await searchEpistemicCandidates(ledger);
  const items = [];
  for (const candidate of searched.candidates) {
    if (candidate.proposal?.type === "false_causal_link") {
      const issues = validateAmbiguityRisk(ledger, candidate);
      items.push({ ...candidate, issues, kind: "ambiguity_risk" });
      continue;
    }
    const proposal = { ...(candidate.proposal || {}), source: candidate.source, holder: candidate.proposal?.holder };
    const issues = validateTransform(ledger, proposal);
    items.push({ ...candidate, issues, kind: "transform" });
  }
  return { items, model: searched.model };
}

export async function storeWorldEngineEpistemic(client, worldId, searched) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  const next = {
    ...ledger,
    epistemicCandidates: { batchId: `EPI_${Date.now()}`, items: searched.items || [] }
  };
  await saveLedger(client, worldId, next);
  return { ...publicView(next), model: searched.model };
}

export async function commitWorldEngineEpistemic(client, worldId, indexes = []) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  let next = ledger;
  for (const index of indexes) {
    const candidate = ledger.epistemicCandidates?.items?.[Number(index)];
    if (!candidate) throwErr("WORLD_ENGINE_CANDIDATE_NOT_FOUND");
    if (candidate.kind === "ambiguity_risk") {
      next = {
        ...next,
        authorNotes: [...(next.authorNotes || []), {
          targetId: (candidate.sources || []).join(","),
          text: `ambiguity_risk:${candidate.proposal?.reason || "same_place"}`
        }]
      };
      continue;
    }
    const result = applyTransform(next, {
      source: candidate.source,
      ...candidate.proposal
    });
    if (!result.ok) throwErr("WORLD_ENGINE_EVENT_INVALID", result.issues.join("；"), { issues: result.issues });
    next = result.ledger;
  }
  next.epistemicCandidates = null;
  await saveLedger(client, worldId, next);
  return publicView(next);
}

export async function generateWorldEngineScript(worldId, characterId, actId = "ACT_1") {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  const rendered = await renderCharacterAct(ledger, characterId, actId);
  if (!rendered.ok) throwErr("DEEPSEEK_OUTPUT_INVALID", rendered.issues.join("；"), { issues: rendered.issues });
  return {
    characterId,
    actId,
    text: rendered.text,
    audits: auditScriptText(rendered.text),
    query: rendered.query,
    model: rendered.model,
    memories: rememberedView(ledger, characterId)
  };
}

export async function storeWorldEngineScript(client, worldId, payload) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  const key = `${payload.characterId}:${payload.actId}`;
  const next = {
    ...ledger,
    scripts: {
      ...(ledger.scripts || {}),
      [key]: {
        text: payload.text,
        audits: payload.audits,
        model: payload.model
      }
    }
  };
  await saveLedger(client, worldId, next);
  return {
    ...payload,
    playability: compileWorld(next).playability
  };
}

export async function repairWorldEngineScript(client, worldId, characterId, actId, text) {
  const { ledger } = await loadWorldEngine(worldId);
  if (!ledger) throwErr("WORLD_ENGINE_SEED_REQUIRED");
  const key = `${characterId}:${actId}`;
  const current = ledger.scripts?.[key];
  if (!current) throwErr("WORLD_ENGINE_SCRIPT_NOT_FOUND");
  const audits = auditScriptText(text);
  const next = {
    ...ledger,
    scripts: {
      ...ledger.scripts,
      [key]: { ...current, text: String(text || "").slice(0, 20_000), audits }
    }
  };
  await saveLedger(client, worldId, next);
  return { characterId, actId, text: next.scripts[key].text, audits, query: compileQuery(next, characterId, actId) };
}
