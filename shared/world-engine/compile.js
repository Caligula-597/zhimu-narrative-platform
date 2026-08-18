import {
  OPERATIONAL_ACTIONS,
  WEAK_ACTIONS,
  characterById,
  formatAction,
  list,
  locationById,
  objectById,
  objectTypeByKey,
  record,
  roleByKey
} from "./catalog.js";

function occupancyAt(event, characterId, fallbackLocation) {
  return record(event.occupancy)[characterId] || fallbackLocation;
}

function adjacentTo(schema, fromId, toId) {
  const location = list(schema?.locations).find((row) => row.id === fromId);
  return list(location?.adjacent).includes(toId);
}

function visibleFields(object, completeness) {
  const fields = record(object?.fields);
  if (completeness === "same_room") {
    const visible = { objectId: object.id, type: object.type, holder: object.holder, locationId: object.locationId };
    if (fields.color) visible.color = fields.color;
    if (fields.shape) visible.shape = fields.shape;
    if (fields.kind) visible.kind = fields.kind;
    return { visible, notVisible: fields.hidden ? ["contents"] : [] };
  }
  return {
    visible: { objectId: object.id, shape: fields.shape || object.type, locationId: object.locationId },
    notVisible: ["color", "holder", "contents", "kind"]
  };
}

export function compileObservations(ledger) {
  const observations = [];
  for (const event of list(ledger.eventLog)) {
    for (const character of list(ledger.characters)) {
      const here = occupancyAt(event, character.id, character.locationId);
      let completeness = null;
      if (here === event.locationId) completeness = "same_room";
      else if (adjacentTo(ledger.schema, here, event.locationId)) completeness = "distant";
      if (!completeness) continue;
      const visibleActors = list(event.actions)
        .map((action) => action.actor || action.patient)
        .filter(Boolean);
      const objectIds = list(event.actions).map((action) => action.objectId).filter(Boolean);
      const objects = objectIds.map((id) => objectById(ledger, id)).filter(Boolean);
      const objectViews = objects.map((object) => visibleFields(object, completeness));
      observations.push({
        observationId: `${event.eventId}:${character.id}`,
        eventId: event.eventId,
        observer: character.id,
        completeness,
        visible: {
          actors: completeness === "same_room" ? visibleActors : visibleActors.map(() => "person"),
          locationId: event.locationId,
          objects: objectViews.map((row) => row.visible)
        },
        notVisible: completeness === "same_room" ? [] : ["identity", "color", "speech_exact"]
      });
    }
  }
  return observations;
}

export function compileTraces(ledger) {
  const traces = [];
  for (const event of list(ledger.eventLog)) {
    for (const [index, action] of list(event.actions).entries()) {
      if (["borrow", "repay", "spend"].includes(action.type)) {
        traces.push({
          traceId: `${event.eventId}:A${index}:money`,
          eventId: event.eventId,
          kind: "cash_movement",
          amount: action.amount || action.cost || 0,
          actor: action.actor || action.patient,
          counterparty: action.counterparty || action.payee || null
        });
      }
      if (["give", "take", "hide", "create_object"].includes(action.type)) {
        traces.push({
          traceId: `${event.eventId}:A${index}:object`,
          eventId: event.eventId,
          kind: "object_state",
          objectId: action.objectId || null,
          actor: action.actor
        });
      }
      if (action.type === "assert") {
        traces.push({
          traceId: `${event.eventId}:A${index}:claim`,
          eventId: event.eventId,
          kind: "claim",
          actor: action.actor,
          proposition: action.proposition
        });
      }
    }
  }
  return traces;
}

export function compileKnowledge(ledger, observations = compileObservations(ledger)) {
  const knowledge = [];
  for (const observation of observations) {
    knowledge.push({
      knower: observation.observer,
      source: observation.completeness === "same_room" ? "firsthand" : "partial_observation",
      eventId: observation.eventId,
      observationId: observation.observationId,
      availableAfter: observation.eventId
    });
  }
  for (const event of list(ledger.eventLog)) {
    for (const action of list(event.actions)) {
      if (action.type !== "assert") continue;
      const audience = list(action.audience).length ? list(action.audience) : list(ledger.characters)
        .filter((row) => occupancyAt(event, row.id, row.locationId) === event.locationId)
        .map((row) => row.id);
      for (const knower of audience) {
        if (knower === action.actor) continue;
        knowledge.push({
          knower,
          source: "reported",
          eventId: event.eventId,
          claimActor: action.actor,
          proposition: action.proposition,
          availableAfter: event.eventId
        });
      }
    }
  }
  return knowledge;
}

export function compileAffordances(ledger) {
  const affordances = [];
  for (const character of list(ledger.characters)) {
    const role = roleByKey(ledger, character.roleKey);
    for (const location of list(ledger.schema?.locations)) {
      const access = list(location.access);
      if (access.includes("public") || access.includes(character.roleKey)) {
        affordances.push({
          actor: character.id,
          type: "enter",
          locationId: location.id
        });
        affordances.push({
          actor: character.id,
          type: "search",
          locationId: location.id
        });
      }
    }
    for (const object of list(ledger.objects)) {
      const caps = objectTypeByKey(ledger, object.type) || {};
      if (object.holder === character.id) {
        affordances.push({ actor: character.id, type: "hold", objectId: object.id });
        if (caps.transferable) {
          affordances.push({ actor: character.id, type: "give", objectId: object.id });
        }
        if (caps.concealable) {
          affordances.push({ actor: character.id, type: "hide", objectId: object.id });
        }
        if (caps.inspectable) {
          affordances.push({ actor: character.id, type: "show", objectId: object.id });
        }
      } else if (object.locationId === character.locationId && !object.holder) {
        affordances.push({ actor: character.id, type: "take", objectId: object.id });
      }
    }
    for (const permission of list(role?.permissions)) {
      if (permission.includes("approve") || permission === "stamp_departure" || permission === "release_vehicle") {
        affordances.push({ actor: character.id, type: "approve", permission });
      }
      if (permission.includes("hold") || permission === "kill_story") {
        affordances.push({ actor: character.id, type: "deny", permission });
        affordances.push({ actor: character.id, type: "delay", permission });
      }
    }
    if ((ledger.accounts?.[character.id]?.cash || 0) > 0) {
      affordances.push({ actor: character.id, type: "spend" });
    }
    if (list(ledger.debts).some((row) => row.debtor === character.id || row.creditor === character.id)) {
      affordances.push({ actor: character.id, type: "trade" });
    }
  }
  return affordances;
}

export function playabilityReport(ledger, affordances = compileAffordances(ledger)) {
  const types = [...new Set(affordances.map((row) => row.type))];
  const operational = types.filter((type) => OPERATIONAL_ACTIONS.includes(type));
  const onlyWeak = operational.length === 0 && types.every((type) => WEAK_ACTIONS.includes(type) || !type);
  return {
    actionTypes: types,
    operationalCount: operational.length,
    meetingOnly: onlyWeak,
    playable: operational.length >= 3
  };
}

export function compileQuery(ledger, characterId, actId = "ACT_1") {
  const character = characterById(ledger, characterId);
  if (!character) return null;
  const observations = compileObservations(ledger).filter((row) => row.observer === characterId);
  const knowledge = compileKnowledge(ledger, compileObservations(ledger)).filter((row) => row.knower === characterId);
  const seenEventIds = new Set(observations.map((row) => row.eventId));
  const experienced = list(ledger.eventLog)
    .filter((event) => seenEventIds.has(event.eventId))
    .map((event) => ({
      eventId: event.eventId,
      locationId: event.locationId,
      actions: event.actions.map((action) => formatAction(action, ledger))
    }));
  const affordances = compileAffordances(ledger).filter((row) => row.actor === characterId);
  return {
    characterId,
    actId,
    name: character.name,
    roleKey: character.roleKey,
    locationId: character.locationId,
    locationName: locationById(ledger, character.locationId)?.name || character.locationId,
    dailyProcess: ledger.dailyProcess || "",
    cash: ledger.accounts?.[characterId]?.cash || 0,
    debts: list(ledger.debts).filter((row) => row.debtor === characterId || row.creditor === characterId),
    knownEventIds: [...seenEventIds],
    knowledge,
    experienced,
    availableActions: affordances,
    notKnownEventIds: list(ledger.eventLog)
      .map((event) => event.eventId)
      .filter((id) => !seenEventIds.has(id))
  };
}

export function compileWorld(ledger) {
  const observations = compileObservations(ledger);
  const traces = compileTraces(ledger);
  const knowledge = compileKnowledge(ledger, observations);
  const affordances = compileAffordances(ledger);
  return {
    observations,
    traces,
    knowledge,
    affordances,
    playability: playabilityReport(ledger, affordances)
  };
}
