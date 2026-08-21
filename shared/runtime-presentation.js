import {
  normalizeRuntimeTabletopCheck,
  normalizeTabletopCheckTemplate,
  projectRuntimeTabletopCheck
} from "./tabletop-flow.js";
import {
  evaluateTabletopEndingRules,
  normalizeTabletopVariables,
  projectTabletopEnding
} from "./tabletop-outcomes.js";
import { normalizeLocationDiscoveryCopy } from "./location-discovery.js";

const MAX_LOCATIONS = 24;

function text(value = "", max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function number(value, min = 0, max = 1, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function sourceSettings(world = {}) {
  return world?.settings && typeof world.settings === "object" ? world.settings : {};
}

function sourceControl(roomSettings = {}) {
  const value = roomSettings?.runtimePresentation;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sourceDesign(world = {}) {
  const settings = sourceSettings(world);
  const value = settings.tabletopMapDesign;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeLocations(design) {
  const defaultTarget = Math.round(number(design?.system?.dice?.defaultTarget, -9999, 9999, 12));
  return (Array.isArray(design?.locations) ? design.locations : [])
    .slice(0, MAX_LOCATIONS)
    .map((location, index) => ({
      id: text(location?.id, 80) || `location-${index + 1}`,
      name: text(location?.name, 80) || `地点 ${index + 1}`,
      type: text(location?.type, 40) || "场景",
      description: text(location?.description, 500),
      hostNotes: text(location?.hostNotes, 500),
      segmentKey: text(location?.segmentKey, 120),
      discovery: normalizeLocationDiscoveryCopy(location?.discovery),
      x: number(location?.x, 0.04, 0.96, 0.5),
      y: number(location?.y, 0.05, 0.95, 0.5),
      z: Math.round(number(location?.z, 0, 8, 0)),
      encounterNpcIds: Array.isArray(location?.encounterNpcIds)
        ? [...new Set(location.encounterNpcIds.map((id) => text(id, 80)).filter(Boolean))].slice(0, 12)
        : [],
      checks: (Array.isArray(location?.checks) ? location.checks : [])
        .slice(0, 6)
        .map((check, checkIndex) => normalizeTabletopCheckTemplate(check, { defaultTarget, index: checkIndex }))
    }));
}

function normalizeRoutes(design, visibleIds) {
  const seen = new Set();
  return (Array.isArray(design?.routes) ? design.routes : [])
    .map((route) => Array.isArray(route) ? route.slice(0, 2).map((id) => text(id, 80)) : [])
    .filter(([from, to]) => {
      if (!from || !to || from === to || !visibleIds.has(from) || !visibleIds.has(to)) return false;
      const key = [from, to].sort().join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function projectParty(design) {
  const system = design?.system && typeof design.system === "object" ? design.system : {};
  const players = Array.isArray(system.players)
    ? system.players
    : system.player && typeof system.player === "object" ? [system.player] : [];
  return players.slice(0, 12).map((player, index) => ({
    id: text(player?.id, 80) || `player-${index + 1}`,
    name: text(player?.name, 60) || `玩家 ${index + 1}`,
    role: text(player?.role, 80),
    hp: Math.round(number(player?.hp, 0, 9999, 0)),
    maxHp: Math.max(1, Math.round(number(player?.maxHp, 1, 9999, 1)))
  }));
}

function projectDice(design) {
  const dice = design?.system?.dice || {};
  return {
    count: Math.round(number(dice.count, 1, 10, 1)),
    sides: Math.round(number(dice.sides, 2, 1000, 20)),
    modifier: Math.round(number(dice.modifier, -999, 999, 0)),
    defaultTarget: Math.round(number(dice.defaultTarget, -9999, 9999, 10))
  };
}

function normalizeActiveEncounter(value, design, locations) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.status !== "active") return null;
  const locationId = text(value.locationId, 80);
  const location = locations.find((item) => item.id === locationId);
  if (!location) return null;
  const configuredNpcIds = new Set(location.encounterNpcIds || []);
  const knownNpcIds = new Set((Array.isArray(design?.system?.npcs) ? design.system.npcs : [])
    .map((npc) => text(npc?.id, 80))
    .filter(Boolean));
  const requestedNpcIds = Array.isArray(value.npcIds) && value.npcIds.length
    ? value.npcIds
    : location.encounterNpcIds || [];
  const npcIds = [...new Set(requestedNpcIds
    .map((id) => text(id, 80))
    .filter((id) => configuredNpcIds.has(id) && knownNpcIds.has(id)))]
    .slice(0, 12);
  if (!npcIds.length) return null;
  return {
    locationId,
    npcIds,
    status: "active",
    startedAt: text(value.startedAt, 40)
  };
}

function normalizePublishedEnding(value, design) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = text(value.id, 80);
  const exists = (Array.isArray(design?.endings) ? design.endings : [])
    .some((ending) => text(ending?.id, 80) === id);
  if (!id || !exists) return null;
  return { id, publishedAt: text(value.publishedAt, 40) };
}

function projectActiveEncounter(encounter, design, locations) {
  if (!encounter) return null;
  const location = locations.find((item) => item.id === encounter.locationId);
  if (!location) return null;
  const npcById = new Map((Array.isArray(design?.system?.npcs) ? design.system.npcs : [])
    .map((npc) => [text(npc?.id, 80), npc]));
  const npcs = encounter.npcIds.map((id) => npcById.get(id)).filter(Boolean).map((npc, index) => ({
    id: text(npc?.id, 80) || `npc-${index + 1}`,
    name: text(npc?.name, 60) || `NPC ${index + 1}`,
    role: text(npc?.role, 80),
    hp: Math.round(number(npc?.hp, 0, 9999, 0)),
    maxHp: Math.max(1, Math.round(number(npc?.maxHp, 1, 9999, 1)))
  }));
  if (!npcs.length) return null;
  return {
    locationId: location.id,
    locationName: location.name,
    status: "active",
    startedAt: encounter.startedAt,
    npcs
  };
}

function projectHostDetails(design, locations, variables, endingEvaluation) {
  const system = design?.system && typeof design.system === "object" ? design.system : {};
  const endingSummary = (ending) => ending ? {
    id: ending.id,
    name: ending.name,
    summary: ending.summary,
    tone: ending.tone,
    priority: ending.priority,
    readiness: ending.readiness,
    eligible: ending.eligible,
    logic: ending.logic,
    conditions: ending.conditions.map((condition) => ({
      id: condition.id,
      variableId: condition.variableId,
      variableLabel: condition.variableLabel,
      operator: condition.operator,
      threshold: condition.threshold,
      current: condition.current,
      matched: condition.matched
    }))
  } : null;
  return {
    locations,
    variables,
    endingCount: Array.isArray(design?.endings) ? design.endings.length : 0,
    endingCandidates: endingEvaluation.candidates.map(endingSummary),
    closestEnding: endingSummary(endingEvaluation.closest),
    npcs: (Array.isArray(system.npcs) ? system.npcs : []).slice(0, 24).map((npc, index) => ({
      id: text(npc?.id, 80) || `npc-${index + 1}`,
      name: text(npc?.name, 60) || `NPC ${index + 1}`,
      role: text(npc?.role, 80),
      hp: Math.round(number(npc?.hp, 0, 9999, 0)),
      maxHp: Math.max(1, Math.round(number(npc?.maxHp, 1, 9999, 1)))
    }))
  };
}

export function normalizeRuntimePresentationControl(value = {}, { design = null, currentBeat = null } = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const locations = normalizeLocations(design);
  const locationIds = new Set(locations.map((location) => location.id));
  const activeSegmentKey = text(source.activeSegmentKey, 120) || text(currentBeat?.key, 120);
  const matchedLocation = locations.find((location) => location.segmentKey && location.segmentKey === activeSegmentKey);
  const requestedLocationId = text(source.activeLocationId, 80);
  const activeLocationId = locationIds.has(requestedLocationId)
    ? requestedLocationId
    : matchedLocation?.id || locations[0]?.id || "";
  const revealed = new Set(
    (Array.isArray(source.revealedLocationIds) ? source.revealedLocationIds : [])
      .map((id) => text(id, 80))
      .filter((id) => locationIds.has(id))
  );
  if (activeLocationId) revealed.add(activeLocationId);
  const activeCheck = normalizeRuntimeTabletopCheck(source.activeCheck, {
    defaultDice: design?.system?.dice,
    locationIds
  });
  const activeEncounter = normalizeActiveEncounter(source.activeEncounter, design, locations);
  const variables = normalizeTabletopVariables(design?.variables, source.variableValues);
  const publishedEnding = normalizePublishedEnding(source.publishedEnding, design);
  return {
    activeSegmentKey,
    activeLocationId,
    revealedLocationIds: [...revealed],
    mapVisible: source.mapVisible == null ? Boolean(locations.length) : Boolean(source.mapVisible),
    activeCheck,
    activeEncounter,
    variableValues: variables.map((variable) => ({ id: variable.id, value: variable.value })),
    publishedEnding,
    updatedAt: text(source.updatedAt, 40)
  };
}

export function projectRuntimePresentation({ world = {}, roomSettings = {}, currentBeat = null, audience = "player" } = {}) {
  const design = sourceDesign(world);
  const control = normalizeRuntimePresentationControl(sourceControl(roomSettings), { design, currentBeat });
  if (!design) {
    return {
      activeSegmentKey: control.activeSegmentKey,
      updatedAt: control.updatedAt || null,
      map: null
    };
  }
  const allLocations = normalizeLocations(design);
  const variables = normalizeTabletopVariables(design.variables, control.variableValues);
  const endingEvaluation = evaluateTabletopEndingRules(design.endings, variables);
  const publishedEnding = projectTabletopEnding(
    endingEvaluation.candidates.find((ending) => ending.id === control.publishedEnding?.id),
    control.publishedEnding?.publishedAt
  );
  const hostAudience = audience !== "player";
  const revealedIds = new Set(control.revealedLocationIds);
  const locations = hostAudience
    ? allLocations
    : control.mapVisible ? allLocations.filter((location) => revealedIds.has(location.id)) : [];
  const visibleIds = new Set(locations.map((location) => location.id));
  const activeLocation = locations.find((location) => location.id === control.activeLocationId) || null;
  return {
    activeSegmentKey: control.activeSegmentKey,
    updatedAt: control.updatedAt || null,
    map: {
      title: text(design.title, 80) || "跑团地图",
      visible: hostAudience ? control.mapVisible : Boolean(control.mapVisible && locations.length),
      activeLocationId: control.activeLocationId,
      revealedLocationIds: hostAudience ? control.revealedLocationIds : locations.map((location) => location.id),
      activeLocation,
      locations: locations.map((location) => hostAudience ? location : {
        id: location.id,
        name: location.name,
        type: location.type,
        description: location.description,
        segmentKey: location.segmentKey,
        discovery: location.discovery,
        x: location.x,
        y: location.y,
        z: location.z
      }),
      routes: normalizeRoutes(design, visibleIds),
      party: projectParty(design),
      dice: projectDice(design),
      activeCheck: projectRuntimeTabletopCheck(control.activeCheck, { audience }),
      activeEncounter: projectActiveEncounter(control.activeEncounter, design, allLocations),
      publishedEnding,
      host: hostAudience ? projectHostDetails(design, allLocations, variables, endingEvaluation) : null
    }
  };
}
