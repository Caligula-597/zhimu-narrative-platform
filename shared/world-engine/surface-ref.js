import { characterById, list, locationById, objectById, record } from "./catalog.js";

export const INTERNAL_ID_SOURCE = String.raw`\b(?:OBJ|CHAR|LOC|EVT|RT|INT|COL|NEP|PUBLIC|DEBT)_[0-9A-Z]{2,}\b`;

const KIND_SURFACE = {
  berth_sheet: "今晚泊位表",
  warehouse_key: "仓库钥匙",
  warehouse_ledger: "四号库那本仓单",
  delivery_bill: "华通3号提货单",
  crane: "主吊机",
  key: "仓库钥匙",
  document: "那份单据"
};

const DROP_KEYS = new Set([
  "ref",
  "machine_ref",
  "packet_id",
  "actor",
  "characterId",
  "playId",
  "roleKey",
  "runtime_refs",
  "interaction_ref",
  "public_refs",
  "reason_refs"
]);

function internalIdRe() {
  return new RegExp(INTERNAL_ID_SOURCE, "u");
}

export function hasInternalIdentifier(text) {
  return internalIdRe().test(String(text || ""));
}

export function surfaceOf(ledger, ref) {
  const id = String(ref || "");
  if (!id) return "";
  if (id.startsWith("CHAR_")) return characterById(ledger, id)?.name || "有人";
  if (id.startsWith("LOC_")) return locationById(ledger, id)?.name || "现场";
  if (id.startsWith("OBJ_")) {
    const object = objectById(ledger, id);
    const fields = record(object?.fields);
    if (fields.surface) return fields.surface;
    if (fields.kind && KIND_SURFACE[fields.kind]) return KIND_SURFACE[fields.kind];
    if (object?.type && KIND_SURFACE[object.type]) return KIND_SURFACE[object.type];
    return "那件货";
  }
  return id.replace(internalIdRe(), "").trim() || "那件事";
}

export function replaceMachineRefs(ledger, value) {
  if (typeof value === "string") {
    return value.replace(new RegExp(INTERNAL_ID_SOURCE, "gu"), (id) => surfaceOf(ledger, id) || "那件事");
  }
  if (Array.isArray(value)) return value.map((item) => replaceMachineRefs(ledger, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (key === "ref" || key.endsWith("_ref") || key === "machine_ref") return [key, item];
      return [key, replaceMachineRefs(ledger, item)];
    }));
  }
  return value;
}

function dropMachineKeys(value) {
  if (Array.isArray(value)) return value.map(dropMachineKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !DROP_KEYS.has(key) && !key.endsWith("_ref") && !key.endsWith("Id"))
      .map(([key, item]) => [key, dropMachineKeys(item)]));
  }
  return value;
}

export function toRendererSurfaces(ledger, value) {
  return dropMachineKeys(replaceMachineRefs(ledger, value));
}

export function stripIdsFromPayload(payload) {
  return !hasInternalIdentifier(JSON.stringify(payload));
}

export function detectInternalIdentifierLeak(text) {
  return hasInternalIdentifier(text);
}

export function listVisibleObjectSurfaces(ledger, locationId, holderId = null) {
  return list(ledger.objects)
    .filter((row) => row.locationId === locationId || (holderId && row.holder === holderId))
    .map((row) => {
      const fields = record(row.fields);
      const surface = surfaceOf(ledger, row.id);
      const extra = [];
      if (fields.ship) extra.push(`船名${fields.ship}`);
      if (fields.tons != null) extra.push(`${fields.tons}吨`);
      return extra.length ? `${surface}（${extra.join("，")}）` : surface;
    });
}
