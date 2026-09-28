// ── V4.4 Pipeline Stages ──
// Full 31-stage pipeline from the V4.4 architecture

export type V44Stage =
  // ── Phase 0: Project & Premise ──
  | "stage_0_project_spec"
  | "stage_0a_premise_candidate"
  | "stage_0b_premise_audit"
  | "stage_0c_premise_contract"
  | "stage_1_capability_router"
  // ── Phase A: World / Character Foundation ──
  | "stage_2_setting"
  | "stage_3_space_object"
  | "stage_4_identity"
  | "stage_5_background"
  | "stage_6_relationships"
  | "stage_7_motivation"
  | "stage_8_entry"
  | "stage_9_character_state"
  | "stage_10_entanglement"
  | "stage_11_outcome_compatibility"
  // ── Phase B: Conflict / Canonical Truth ──
  | "stage_12_conflict_kernel"
  | "stage_13_mystery"
  | "stage_14_mechanism"
  | "stage_15_timeline"
  | "stage_16_initial_world_state"
  // ── Phase C: Perception / Action / Runtime ──
  | "stage_17_evidence"
  | "stage_18_observation"
  | "stage_19_knowledge"
  | "stage_20_dramatic_events"
  | "stage_21_interaction_rules"
  | "stage_22_runtime_state"
  | "stage_23_capability_validation"
  | "stage_24_resolution"
  // ── Phase D: Experience ──
  | "stage_25_session_compiler"
  | "stage_26_whole_game_playability"
  | "stage_27_gm_orchestration"
  // ── Phase E: Delivery ──
  | "stage_28_host_package"
  | "stage_29_player_material"
  | "stage_30_narrative_compilation"
  | "stage_31_final_release"
  | "complete";

export const STAGE_ORDER: V44Stage[] = [
  "stage_0_project_spec",
  "stage_0a_premise_candidate",
  "stage_0b_premise_audit",
  "stage_0c_premise_contract",
  "stage_1_capability_router",
  "stage_2_setting",
  "stage_3_space_object",
  "stage_4_identity",
  "stage_5_background",
  "stage_6_relationships",
  "stage_7_motivation",
  "stage_8_entry",
  "stage_9_character_state",
  "stage_10_entanglement",
  "stage_11_outcome_compatibility",
  "stage_12_conflict_kernel",
  "stage_13_mystery",
  "stage_14_mechanism",
  "stage_15_timeline",
  "stage_16_initial_world_state",
  "stage_17_evidence",
  "stage_18_observation",
  "stage_19_knowledge",
  "stage_20_dramatic_events",
  "stage_21_interaction_rules",
  "stage_22_runtime_state",
  "stage_23_capability_validation",
  "stage_24_resolution",
  "stage_25_session_compiler",
  "stage_26_whole_game_playability",
  "stage_27_gm_orchestration",
  "stage_28_host_package",
  "stage_29_player_material",
  "stage_30_narrative_compilation",
  "stage_31_final_release",
  "complete"
];

export type Verdict = "pass" | "hold" | "fail";

export interface StageVerdict {
  stage: V44Stage;
  verdict: Verdict;
  proofObligations: ProofObligationResult[];
  caseAgainst: string[];
  counterexamples: string[];
  risks: Risk[];
  upstreamFidelity: "pass" | "fail";
  note: string;
}

export interface ProofObligationResult {
  id: string;
  description: string;
  status: "proven" | "unproven" | "refuted";
  evidence: string[];
}

export interface Risk {
  type: "local" | "critical";
  description: string;
}

export interface UnifiedFidelity {
  dramaticSubjectContinued: boolean;
  relationshipEngineAdvanced: boolean;
  priorChoiceConsequence: boolean;
  newContentDetachable: string[];
}

export interface ConfigurationVariant {
  playerCount: number;
  durationMinutes: number;
  proofStatus: "proven" | "unproven" | "unsupported";
}

export interface UpstreamReopenRequest {
  counterexampleId: string;
  brokenClaim: string;
  ownerStage: string;
  earliestInvalidStage: string;
  requestedChange: string;
  whyLocalRepairImpossible: string;
  invalidatedDownstreamStages: string[];
  requiredReplayStages: string[];
}

export interface PipelineContext {
  projectId: string;
  stage: V44Stage;
  completedStages: V44Stage[];
  verdicts: Record<string, StageVerdict>;
  data: Record<string, unknown>;
  unifiedFidelity?: UnifiedFidelity;
  upstreamReopenRequests?: UpstreamReopenRequest[];
  configVariants?: ConfigurationVariant[];
}

export interface PipelineStep {
  id: V44Stage;
  run(ctx: PipelineContext): Promise<StageVerdict>;
}

export const STAGE_LABELS: Record<V44Stage, string> = {
  stage_0_project_spec: "ProjectSpec",
  stage_0a_premise_candidate: "Premise Candidate Pool",
  stage_0b_premise_audit: "Premise Proof Audit",
  stage_0c_premise_contract: "Premise Contract",
  stage_1_capability_router: "Capability Router",
  stage_2_setting: "Setting / Social Ecology",
  stage_3_space_object: "Space / Object World",
  stage_4_identity: "Identity Model",
  stage_5_background: "Relevant Background",
  stage_6_relationships: "Existing Relationships",
  stage_7_motivation: "Core Motivational Structure",
  stage_8_entry: "Story Entry Contract",
  stage_9_character_state: "Initial Character State",
  stage_10_entanglement: "Character Entanglement",
  stage_11_outcome_compatibility: "Outcome Compatibility",
  stage_12_conflict_kernel: "Shared Incident / Conflict Kernel",
  stage_13_mystery: "Mystery Contract",
  stage_14_mechanism: "Advanced Mechanism",
  stage_15_timeline: "Canonical Historical Timeline",
  stage_16_initial_world_state: "Initial World State",
  stage_17_evidence: "World Opportunities / Evidence",
  stage_18_observation: "Observation Distribution",
  stage_19_knowledge: "Initial Character Knowledge",
  stage_20_dramatic_events: "Dramatic Events",
  stage_21_interaction_rules: "Interaction / Action Rules",
  stage_22_runtime_state: "Runtime State & Event Log",
  stage_23_capability_validation: "Capability Validation Layer",
  stage_24_resolution: "Resolution",
  stage_25_session_compiler: "Session Experience Compiler",
  stage_26_whole_game_playability: "Whole-Game Commercial Playability",
  stage_27_gm_orchestration: "GM Orchestration Model",
  stage_28_host_package: "Host Package Compiler",
  stage_29_player_material: "Player Material Compiler",
  stage_30_narrative_compilation: "Narrative Compilation",
  stage_31_final_release: "Final Release Validation",
  complete: "Complete"
};