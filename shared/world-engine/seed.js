import {
  ALLOWED_CONTENT_KEYS,
  ERA_KEYS,
  GENRE_KEYS,
  VENUE_KEYS,
  WORLD_ENGINE_VERSION,
  intInRange,
  list,
  record,
  text
} from "./catalog.js";
import { getVenueTemplate } from "./templates.js";

export function normalizeSeed(input = {}) {
  const source = record(input);
  const venueKey = VENUE_KEYS.includes(source.venueKey) ? source.venueKey : "photo_studio";
  const era = ERA_KEYS.includes(source.era) ? source.era : "contemporary";
  const genres = list(source.genres).filter((item) => GENRE_KEYS.includes(item)).slice(0, 6);
  const allowed = list(source.allowed).filter((item) => ALLOWED_CONTENT_KEYS.includes(item)).slice(0, 20);
  return {
    version: WORLD_ENGINE_VERSION,
    title: text(source.title, 80),
    inspiration: text(source.inspiration, 800),
    banned: text(source.banned, 800),
    venueKey,
    era,
    playerCount: intInRange(source.playerCount, 4, 8, 6),
    dramaLevel: intInRange(source.dramaLevel, 1, 6, 3),
    genres: genres.length ? genres : ["profession", "mystery"],
    allowed
  };
}

export function createLedgerFromSeed(input = {}) {
  const seed = normalizeSeed(input);
  const template = getVenueTemplate(seed.venueKey);
  const slots = template.roleSlots.slice(0, seed.playerCount);
  const characters = slots.map((slot, index) => ({
    id: `CHAR_${String(index + 1).padStart(3, "0")}`,
    name: slot.defaultName,
    roleKey: slot.roleKey,
    locationId: slot.startLocationId
  }));
  const objects = (template.initialObjects || []).map((object, index) => ({
    id: object.id || `OBJ_${String(index + 1).padStart(3, "0")}`,
    type: object.type,
    holder: object.holder || null,
    locationId: object.locationId,
    fields: record(object.fields)
  }));
  const accounts = {};
  for (const character of characters) {
    accounts[character.id] = { cash: template.startingCash };
  }
  return {
    version: WORLD_ENGINE_VERSION,
    seed,
    schema: structuredClone(template.schema),
    characters,
    objects,
    accounts,
    debts: [],
    eventLog: [],
    transforms: [],
    authorNotes: [],
    loweredTypes: [],
    candidates: null,
    epistemicCandidates: null,
    scripts: {},
    nextEventSeq: 1,
    dailyProcess: template.dailyProcess
  };
}

export function listVenueOptions() {
  return VENUE_KEYS.map((key) => {
    const template = getVenueTemplate(key);
    return {
      key,
      label: template.label,
      summary: template.summary,
      roleCount: template.roleSlots.length
    };
  });
}
