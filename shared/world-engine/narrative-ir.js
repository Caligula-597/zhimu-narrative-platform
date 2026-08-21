import { compressDialogueActs } from "./compression.js";
import { characterById, list, locationById, record } from "./catalog.js";
import { compileObservations } from "./compile.js";
import { eventsForRuntime } from "./runtime-log.js";
import { extractPublicContext } from "./public-context.js";
import { listVisibleObjectSurfaces, surfaceOf, toRendererSurfaces } from "./surface-ref.js";

const PUBLIC_REASON = /潮水|潮汐|不等人|只有一台主吊机/u;

function sameRoomIds(ledger, characterId) {
  return new Set(
    compileObservations(ledger)
      .filter((row) => row.observer === characterId && row.completeness === "same_room")
      .map((row) => row.eventId)
  );
}

function runtimeByEvent(runtimeLog) {
  return new Map(list(runtimeLog).map((row) => [row.eventId, row.runtimeId]));
}

function interactionFor(interactions, characterId, event) {
  const actors = new Set(list(event?.actions).map((action) => action.actor).filter(Boolean));
  return list(interactions).find((row) => (
    actors.has(row.initiator) && (row.initiator === characterId || list(row.audience).includes(characterId))
  )) || null;
}

function privateReasons(values) {
  return [...new Set(list(values).filter((row) => row && !PUBLIC_REASON.test(row)))];
}

function expandWindow(event, characterId, ledger, interaction) {
  const actions = list(event.actions);
  const assert = actions.find((action) => action.type === "assert");
  const search = actions.find((action) => action.type === "search");
  const delay = actions.find((action) => action.type === "delay" || action.type === "deny");
  const moveOnly = actions.length > 0 && actions.every((action) => action.type === "move");
  if (moveOnly) return null;
  if (!assert && !search && !delay) return null;

  const talk = interaction ? compressDialogueActs(list(interaction.acts)) : [];
  const spoken = talk.find((row) => row.semantic_token === "spoken_turn");
  const verification = talk.find((row) => row.semantic_token === "verification_attempt");
  const prop = assert?.proposition || {};
  const locName = locationById(ledger, event.locationId)?.name;
  const current_state = { location: locName };
  const reason_refs = [];
  const requester = surfaceOf(ledger, interaction?.initiator || assert?.actor || search?.actor || delay?.actor);
  const counterpart = surfaceOf(
    ledger,
    list(interaction?.audience).find((id) => id !== characterId) || assert?.audience?.[0]
  );

  if (event.locationId === "LOC_crane" || prop.token === "shared_capacity_blocked" || verification) {
    current_state.first_operation = verification?.failed_fields?.includes("first_job") ? "unfinished" : "in_progress";
    current_state.crane_capacity = 1;
  }
  if (search) {
    const docs = list(ledger.objects).filter((row) => record(row.fields).tons != null);
    current_state.documents = docs.map((row) => `${surfaceOf(ledger, row.id)}写着${row.fields.tons}吨`);
  }
  if (prop.amount) current_state.debt = `未结清${prop.amount}元`;
  if (prop.tons) current_state.bill = `${surfaceOf(ledger, prop.objectId || "OBJ_005")}写着${prop.tons}吨`;
  const papers = list(interaction?.disclosed_refs)
    .map((id) => surfaceOf(ledger, id))
    .filter((row) => row && !PUBLIC_REASON.test(row));
  if (papers.length) current_state.papers = papers;

  const isInitiator = characterId === interaction?.initiator || characterId === assert?.actor;
  let response = { type: isInitiator ? "reply" : "witness" };
  if (delay && characterId === delay.actor) response = { type: "hold_clearance" };
  if (search) response = { type: "compare_documents" };
  if (verification?.successful_field) {
    response = {
      type: isInitiator ? "reject_second_job" : "answer_capacity",
      detail: Object.values(verification.successful_field)[0]
    };
  }
  if (spoken && isInitiator) response = { type: "speak" };

  const because = [];
  if (prop.token === "unpaid_obligation") {
    because.push("旧账还没结清");
    reason_refs.push("unpaid_obligation");
  }
  if (prop.token === "delivery_due") {
    because.push("提货单据已经递到这里");
    reason_refs.push("delivery_due");
  }
  if (prop.token === "approval_required") {
    because.push(characterId === delay?.actor ? "今晚这票货的离港章还不能盖" : "离港确认还压在驻点手里");
    reason_refs.push("approval_required");
  }
  if (prop.token === "shared_capacity_blocked" || verification) {
    because.push("第一钩还没结束");
    reason_refs.push("PUBLIC_02");
  }
  if (search) {
    because.push("两份单据吨位对不上");
    reason_refs.push("document_wording_differs");
  }

  const then = {};
  if (verification) then.second_operation = "not_started";
  if (search) then.mismatch = true;
  if (delay) then.clearance = "held";
  if (prop.token === "unpaid_obligation") then.payment = "unpaid";

  return {
    trigger: {
      type: search ? "inspection" : (isInitiator ? "issue_request" : "request_received"),
      source: isInitiator ? (locName || counterpart) : requester
    },
    current_state,
    response,
    because: privateReasons(because.length ? because : ["当前现场出现了需要当场处理的冲突"]),
    then,
    speech_mode: interaction?.render_mode || "reported",
    spoken_by: spoken ? surfaceOf(ledger, interaction?.initiator) : null,
    spoken_line: spoken?.text || null,
    failed_fields: verification?.failed_fields || null,
    successful_field: verification?.successful_field || null,
    reason_refs
  };
}

function stationPacket(ledger, character) {
  const loc = locationById(ledger, character.locationId);
  const visible = listVisibleObjectSurfaces(ledger, character.locationId, character.id)
    .filter((row) => !PUBLIC_REASON.test(row));
  const current_state = { location: loc?.name };
  const shipObject = list(ledger.objects).find((row) => record(row.fields).ship && (
    row.locationId === character.locationId || row.holder === character.id
  ));
  if (shipObject) current_state.ship = record(shipObject.fields).ship;
  if (visible.length) current_state.visible = visible;
  return {
    trigger: { type: "station_duty", source: loc?.name },
    current_state,
    response: { type: "hold_post" },
    because: [],
    then: { station: "occupied" },
    speech_mode: "reported",
    spoken_line: null,
    reason_refs: ["PUBLIC_01"]
  };
}

export function detectNarrativePacketUnderfill(narrativeIr) {
  const events = list(narrativeIr?.events || narrativeIr?.packets);
  if (!events.length) return [{ code: "narrative_packet_underfill", packet_id: null }];
  return events
    .filter((event) => !event.trigger || !event.response || event.then == null)
    .map((event) => ({ code: "narrative_packet_underfill", packet_id: event.packet_id }));
}

export function compileNarrativeIr(ledger, characterId, ctx = {}) {
  const character = characterById(ledger, characterId);
  if (!character) return null;
  const publicContext = ctx.publicContext || extractPublicContext(ledger, ctx);
  const seen = sameRoomIds(ledger, characterId);
  const runtimeLog = ctx.runtimeLog || [];
  const runtimeMap = runtimeByEvent(runtimeLog);
  const runtimeEvents = eventsForRuntime(ledger, runtimeLog).filter((event) => seen.has(event.eventId));
  const events = [];
  let seq = 0;
  const usedInteractions = new Set();
  for (const event of runtimeEvents) {
    const interaction = interactionFor(ctx.interactions || [], characterId, event);
    const window = expandWindow(event, characterId, ledger, interaction);
    if (!window) continue;
    if (interaction?.interactionId) usedInteractions.add(interaction.interactionId);
    seq += 1;
    events.push({
      packet_id: `NEP_${String(seq).padStart(3, "0")}`,
      actor: characterId,
      runtime_refs: [runtimeMap.get(event.eventId) || event.eventId].filter(Boolean),
      interaction_ref: interaction?.interactionId || null,
      ...window
    });
  }
  if (!events.length) {
    seq += 1;
    events.push({
      packet_id: `NEP_${String(seq).padStart(3, "0")}`,
      actor: characterId,
      runtime_refs: [],
      interaction_ref: null,
      ...stationPacket(ledger, character)
    });
  }
  return {
    characterId,
    name: character.name,
    roleKey: character.roleKey,
    locationName: locationById(ledger, character.locationId)?.name || character.locationId,
    playId: ctx.playIr?.playId || null,
    runtimeIds: runtimeEvents.map((event) => runtimeMap.get(event.eventId)).filter(Boolean),
    public_refs: publicContext.map((row) => row.publicId),
    events,
    packets: events,
    underfill: detectNarrativePacketUnderfill({ events })
  };
}

export function payloadForRenderer(narrativeIr, ledger) {
  if (!ledger) throw new Error("payloadForRenderer requires ledger for surface_ref");
  const events = list(narrativeIr.events || narrativeIr.packets).map((event) => ({
    trigger: event.trigger,
    current_state: event.current_state,
    response: event.response,
    because: event.because,
    then: event.then,
    speech_mode: event.speech_mode,
    spoken_by: event.spoken_by || undefined,
    spoken_line: event.spoken_line || undefined,
    failed_checks: event.failed_fields || undefined,
    found: event.successful_field || undefined
  }));
  return toRendererSurfaces(ledger, {
    name: narrativeIr.name,
    locationName: narrativeIr.locationName,
    already_has_public_briefing: true,
    do_not_restate_public_briefing: true,
    events
  });
}

export function spokenLinesOf(narrativeIr) {
  return list(narrativeIr?.events || narrativeIr?.packets)
    .map((row) => row.spoken_line)
    .filter(Boolean);
}
