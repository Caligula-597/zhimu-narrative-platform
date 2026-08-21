import { list } from "./catalog.js";

export function projectRuntimeLog(ledger, actId = "ACT_1") {
  const during = list(ledger.eventLog).filter((event) => event.phase === "during_act");
  return during.map((event, index) => ({
    runtimeId: `RT_${String(index + 1).padStart(3, "0")}`,
    actId,
    eventId: event.eventId,
    locationId: event.locationId,
    source: "canonical_event"
  }));
}

export function eventsForRuntime(ledger, runtimeLog) {
  const ids = new Set(list(runtimeLog).map((row) => row.eventId));
  return list(ledger.eventLog).filter((event) => ids.has(event.eventId));
}
