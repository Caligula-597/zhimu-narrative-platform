import type { PlotEventNode } from "../../domain/plot/plot-event.js";
import type { SessionState } from "../state/session-state.js";
import type { StateMutation, TriggerRule } from "../../domain/shared/state.js";

function getPath(state: SessionState, path: string): unknown {
  if (path.startsWith("stateVariables.")) {
    return state.stateVariables[path.slice("stateVariables.".length)];
  }
  return state.stateVariables[path];
}

export function evaluatePredicate(
  state: SessionState,
  predicate: { path: string; operator: string; value?: unknown }
): boolean {
  const current = getPath(state, predicate.path);
  switch (predicate.operator) {
    case "exists":
      return current !== undefined && current !== null;
    case "equals":
      return current === predicate.value;
    case "not_equals":
      return current !== predicate.value;
    case "contains":
      return Array.isArray(current) && current.includes(predicate.value);
    case "greater_than":
      return typeof current === "number" && typeof predicate.value === "number"
        && current > predicate.value;
    case "less_than":
      return typeof current === "number" && typeof predicate.value === "number"
        && current < predicate.value;
    default:
      return false;
  }
}

export function evaluateTrigger(
  trigger: TriggerRule,
  state: SessionState
): boolean {
  if (trigger.predicates.length === 0) return trigger.type === "manual_gm";
  return trigger.predicates.every((p) => evaluatePredicate(state, p));
}

export function applyMutations(
  state: SessionState,
  mutations: StateMutation[]
): SessionState {
  const next: SessionState = structuredClone(state);
  for (const m of mutations) {
    const key = m.path.startsWith("stateVariables.")
      ? m.path.slice("stateVariables.".length)
      : m.path;
    const cur = next.stateVariables[key];
    switch (m.operation) {
      case "set":
        next.stateVariables[key] = m.value;
        break;
      case "increment":
        next.stateVariables[key] =
          (typeof cur === "number" ? cur : 0) +
          (typeof m.value === "number" ? m.value : 1);
        break;
      case "append":
        next.stateVariables[key] = Array.isArray(cur) ? [...cur, m.value] : [m.value];
        break;
      case "add":
        next.stateVariables[key] = m.value;
        break;
      case "remove":
        delete next.stateVariables[key];
        break;
      default:
        break;
    }
  }
  return next;
}

export function findTriggerableEvents(
  events: PlotEventNode[],
  state: SessionState
): PlotEventNode[] {
  return events.filter((event) => {
    if (!event.repeatable && state.firedPlotEventIds.includes(event.id)) {
      return false;
    }
    return evaluateTrigger(event.trigger, state);
  });
}

export function executePlotEvent(
  event: PlotEventNode,
  state: SessionState
): SessionState {
  let next = applyMutations(state, event.invariantEffects);
  const branch = event.reactiveBranches.find((b) =>
    b.conditions.every((c) => evaluatePredicate(next, c))
  );
  if (branch) {
    next = applyMutations(next, branch.effects);
  }
  if (!next.firedPlotEventIds.includes(event.id)) {
    next = {
      ...next,
      firedPlotEventIds: [...next.firedPlotEventIds, event.id]
    };
  }
  return next;
}
