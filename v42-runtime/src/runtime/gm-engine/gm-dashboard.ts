import type { GMRuleNode } from "../../domain/gm/gm-rule.js";
import type { PlotEventNode } from "../../domain/plot/plot-event.js";
import type { SessionState } from "../state/session-state.js";
import { findTriggerableEvents } from "../plot-engine/plot-engine.js";

export interface GMDashboardState {
  currentScene: string;
  characterLocations: Record<string, string>;
  recentlyChangedStates: string[];
  availableContextualRules: GMRuleNode[];
  triggerablePlotEvents: PlotEventNode[];
  activeNPCs: string[];
  objectiveWarnings: string[];
  suggestedFallbacks: GMRuleNode[];
}

export interface ProjectDesignForGm {
  plotEvents: PlotEventNode[];
  gmRules: GMRuleNode[];
}

export function buildGMDashboard(
  design: ProjectDesignForGm,
  runtime: SessionState
): GMDashboardState {
  const contextual = design.gmRules.filter(
    (r) => r.ruleType === "contextual_rule" && runtime.activeGMRuleIds.includes(r.id)
  );
  const fallbacks = design.gmRules.filter((r) => r.ruleType === "fallback");

  return {
    currentScene: String(runtime.stateVariables.currentScene ?? ""),
    characterLocations: { ...runtime.characterLocations },
    recentlyChangedStates: [],
    availableContextualRules: contextual,
    triggerablePlotEvents: findTriggerableEvents(design.plotEvents, runtime),
    activeNPCs: [],
    objectiveWarnings: [],
    suggestedFallbacks: fallbacks
  };
}
