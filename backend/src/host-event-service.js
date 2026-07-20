import { wakeDueDelayedHostEvents } from "./host-delay-wake.js";
import { listPendingHostEvents } from "./repositories/host-event-repository.js";
import {
  eventSourceLabel,
  extractTriggerPlayers,
  summarizeHostAction
} from "./routes/host-helpers.js";

export async function getPendingHostEvents(roomId) {
  await wakeDueDelayedHostEvents();
  return presentPendingHostEvents(await listPendingHostEvents(roomId));
}

export function presentPendingHostEvents(events) {
  return events.map((event) => ({
    ...event,
    source_label: eventSourceLabel(event),
    action_summaries: (event.actions ?? []).map(summarizeHostAction),
    trigger_players: extractTriggerPlayers(event.rule_conditions)
  }));
}
