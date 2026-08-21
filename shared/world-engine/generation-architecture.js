/**
 * Frozen generation architecture V9.0 — three-pass production.
 * World is generated once. Role prose may be edited repeatedly.
 * Pass 1: coverage and integrity. Pass 2: editorial progress. Pass 3: fairness/fun QA.
 * Do not mix the three. Do not send QA failures to the editor.
 * World Engine event store remains WORLD_ENGINE_VERSION 6.
 */

export const GENERATION_ARCHITECTURE_VERSION = "9.0";
export const WORLD_ENGINE_CONTRACT = 6;

export const POWERS = Object.freeze({
  world_engine: "fact",
  creative_search: "candidate",
  author: "select",
  writer: "coverage_integrity",
  editor: "narrative_progress",
  gates: "detect",
  game_qa: "fairness_and_fun"
});

export const PASSES = Object.freeze([
  "world_design",
  "host_truth_sheet",
  "draft",
  "whole_cast_read",
  "editorial",
  "fairness_qa",
  "interestingness_qa",
  "structural_repair",
  "final_host_manual"
]);

export const WORLD_DESIGN_PIPELINE = Object.freeze([
  "dramatic_premise",
  "human_world",
  "characters_relationships",
  "event_ecology",
  "canonical_truth",
  "game_form",
  "hypothesis_evidence",
  "experience_knowledge",
  "current_situation"
]);

export const DRAFT_OPTIMIZE = Object.freeze([
  "coverage",
  "perspective_integrity",
  "cross_role_consistency",
  "character_coherence"
]);

export const NARRATIVE_PROGRESS_KINDS = Object.freeze([
  "life_event",
  "relationship_change",
  "time_advances",
  "situation_change",
  "new_person",
  "old_fact_new_meaning",
  "character_action",
  "player_judgment_material"
]);

export const INFO_KIND = Object.freeze({
  FACT_REQUIRED: "FACT_REQUIRED",
  INTERPRETATION_OPTIONAL: "INTERPRETATION_OPTIONAL"
});

export const LLM_ROLES = Object.freeze([
  "event_search",
  "epistemic_proposal",
  "view_selector",
  "writer",
  "editor",
  "renderer",
  "semantic_verifier",
  "editorial_diagnoser",
  "fairness_qa",
  "interestingness_qa",
  "host_truth_sheet",
  "host_manual",
  "corpus_labeler"
]);

export const FORBIDDEN_LLM_ROLES = Object.freeze([
  "situation_writer",
  "gameplay_writer",
  "truth_rewriter",
  "language_optimizer",
  "relationship_fixer",
  "act_designer",
  "fun_rewriter",
  "secret_injector",
  "fairness_editor"
]);

export const IR_LAYERS = Object.freeze([
  "dramatic_premise",
  "human_world",
  "character_relationship_ir",
  "event_ecology",
  "canonical_truth",
  "game_form",
  "hypothesis_evidence",
  "experience_knowledge",
  "current_situation",
  "world_ir",
  "play_ir",
  "epistemic_ir",
  "runtime_log",
  "interaction_ir",
  "narrative_ir",
  "host_truth_sheet",
  "role_draft",
  "editorial_diagnosis",
  "edit_provenance"
]);

export const EDITOR_FORBIDDEN_MUTATIONS = Object.freeze([
  "new_world_event",
  "new_important_relationship",
  "new_secret",
  "change_who_knows_what",
  "change_who_saw_what",
  "change_evidence_source",
  "new_inference_answer"
]);

export const EDITOR_ALLOWED_OPS = Object.freeze([
  "delete",
  "compress",
  "move",
  "rewrite",
  "merge",
  "reorder_information",
  "reshape_paragraph",
  "adjust_dialogue_or_report",
  "adjust_voice"
]);

export const COLLISION_TYPES = Object.freeze([
  "deadline_collision",
  "contested_object",
  "permission_dependency",
  "unpaid_obligation",
  "shared_capacity",
  "delivery_dependency",
  "access_bottleneck",
  "ownership_conflict"
]);

export const EXPAND_FLAGS = Object.freeze([
  "state_change",
  "knowledge_change",
  "new_observation",
  "unexpected_result",
  "failed_precondition",
  "object_transfer",
  "permission_collision",
  "decision_branch",
  "decision_point",
  "epistemic_change",
  "play_collision_touch",
  "relationship_change"
]);

export const DIRECT_DIALOGUE_REASONS = Object.freeze([
  "exact_wording_evidence",
  "relationship_turn",
  "public_commitment",
  "threat_or_offer",
  "ambiguous_claim",
  "identity_reveal"
]);

export const INTERACTION_RENDER_MODES = Object.freeze(["reported", "direct"]);

export const EDITORIAL_ROLE_CODES = Object.freeze([
  "semantic_redundancy",
  "background_overexplanation",
  "author_interpretation",
  "premature_summary",
  "procedural_overcoverage",
  "dialogue_redundancy",
  "timeline_like_narration",
  "profession_metaphor",
  "repeated_emotional_thesis",
  "weak_paragraph_progression",
  "event_to_explanation_redundancy"
]);

export const EDITORIAL_CAST_CODES = Object.freeze([
  "cross_role_repetition",
  "voice_homogenization",
  "same_background_reexplained",
  "same_event_same_angle",
  "shared_fact_overexposure",
  "role_length_uniformity",
  "role_structure_uniformity",
  "cross_role_phrase_duplication",
  "same_public_fact_reexplained_in_private_views",
  "private_view_homogenization"
]);

export const FAIRNESS_CODES = Object.freeze([
  "truth_unreachable",
  "evidence_not_independent",
  "single_point_of_failure",
  "hypothesis_not_separable",
  "late_reveal_dependency",
  "overpowered_role",
  "underpowered_role"
]);

export const INTERESTINGNESS_CODES = Object.freeze([
  "no_judgment_required",
  "fact_has_only_one_reading",
  "new_info_never_reframes_old",
  "no_reason_to_withhold",
  "no_personal_stakes",
  "past_does_not_affect_present_talk",
  "no_midplay_rejudgment",
  "no_aha_misread",
  "no_secondary_table_matter"
]);

export const HARD_WORLD_CODES = Object.freeze([
  "illegal_world_state",
  "thematic_collision",
  "opening_state_saturation",
  "historical_reveal_dominance",
  "invented_speech_act",
  "excessive_direct_qa",
  "render_mode_violation",
  "unsupported_interpretation",
  "runtime_event_backfill",
  "acquisition_channel_drift",
  "affordance_backfill",
  "internal_identifier_leak",
  "unsupported_world_detail",
  "unsupported_surface_detail",
  "narrative_packet_underfill",
  "literary_surface_backfill",
  "runtime_scene_expansion",
  "host_info_leaked_to_player"
]);

export const GATE_CODES = Object.freeze([
  ...HARD_WORLD_CODES,
  "procedural_reexpansion",
  "unearned_compression",
  "cross_role_shared_fact_repetition",
  ...EDITORIAL_ROLE_CODES.filter((code) => code !== "procedural_overcoverage"),
  "procedural_overcoverage",
  ...EDITORIAL_CAST_CODES,
  ...FAIRNESS_CODES,
  ...INTERESTINGNESS_CODES
]);

export const REWORK_LAYER = Object.freeze({
  illegal_world_state: "event_store",
  thematic_collision: "collision_selection",
  opening_state_saturation: "act_entry",
  historical_reveal_dominance: "act_entry_or_narrative_candidate",
  procedural_overcoverage: "editorial_pass",
  procedural_reexpansion: "editorial_pass",
  invented_speech_act: "interaction_ir",
  excessive_direct_qa: "interaction_render_mode",
  render_mode_violation: "interaction_render_mode",
  unsupported_interpretation: "editorial_pass",
  runtime_event_backfill: "runtime_log",
  acquisition_channel_drift: "editorial_pass",
  unearned_compression: "editorial_pass",
  affordance_backfill: "world_substrate",
  internal_identifier_leak: "surface_ref_resolver",
  unsupported_world_detail: "editorial_pass",
  unsupported_surface_detail: "editorial_pass",
  cross_role_phrase_duplication: "editorial_pass",
  cross_role_shared_fact_repetition: "editorial_pass",
  same_public_fact_reexplained_in_private_views: "editorial_pass",
  narrative_packet_underfill: "narrative_event_packet_compiler",
  private_view_homogenization: "editorial_pass",
  literary_surface_backfill: "editorial_pass",
  runtime_scene_expansion: "editorial_pass",
  host_info_leaked_to_player: "draft_pass",
  semantic_redundancy: "editorial_pass",
  background_overexplanation: "editorial_pass",
  author_interpretation: "editorial_pass",
  premature_summary: "editorial_pass",
  dialogue_redundancy: "editorial_pass",
  timeline_like_narration: "editorial_pass",
  profession_metaphor: "editorial_pass",
  repeated_emotional_thesis: "editorial_pass",
  weak_paragraph_progression: "editorial_pass",
  event_to_explanation_redundancy: "editorial_pass",
  cross_role_repetition: "editorial_pass",
  voice_homogenization: "editorial_pass",
  same_background_reexplained: "editorial_pass",
  same_event_same_angle: "editorial_pass",
  shared_fact_overexposure: "editorial_pass",
  role_length_uniformity: "editorial_pass",
  role_structure_uniformity: "editorial_pass",
  truth_unreachable: "hypothesis_evidence",
  evidence_not_independent: "hypothesis_evidence",
  single_point_of_failure: "experience_knowledge",
  hypothesis_not_separable: "hypothesis_evidence",
  late_reveal_dependency: "game_form",
  overpowered_role: "experience_knowledge",
  underpowered_role: "experience_knowledge",
  no_judgment_required: "game_form",
  fact_has_only_one_reading: "epistemic_ir",
  new_info_never_reframes_old: "hypothesis_evidence",
  no_reason_to_withhold: "character_relationship_ir",
  no_personal_stakes: "characters_relationships",
  past_does_not_affect_present_talk: "characters_relationships",
  no_midplay_rejudgment: "experience_knowledge",
  no_aha_misread: "epistemic_ir",
  no_secondary_table_matter: "event_ecology"
});

export const DEFINITION_OF_DONE = Object.freeze([
  "canonical_truth_frozen_before_prose",
  "no_role_prose_in_world_design",
  "draft_optimizes_only_four_integrity_checks",
  "whole_cast_read_before_editorial",
  "editor_cannot_mutate_world_or_knowledge",
  "interpretation_optional_may_be_deleted",
  "fact_required_must_be_preserved",
  "qa_after_editorial_not_on_noisy_draft",
  "qa_failure_routes_upstream_not_to_editor",
  "structural_repair_rewrites_only_affected_roles",
  "host_truth_sheet_before_drafts",
  "final_host_manual_after_qa",
  "corpus_anomaly_enters_editorial_first",
  "same_world_divergent_perspectives"
]);

export const SEMANTIC_TOKENS = Object.freeze([
  "payment_pending",
  "approval_required",
  "delivery_due",
  "deadline_approaching",
  "shared_capacity_blocked",
  "access_bottleneck",
  "document_wording_differs",
  "ownership_disputed",
  "verification_failed",
  "verification_succeeded",
  "unpaid_obligation",
  "routine_transaction_completed",
  "verification_exchange"
]);

export const VIEW_SELECTOR_SLOTS = Object.freeze([
  "current_work",
  "colliding_pressure",
  "prior_incident",
  "current_relationship",
  "personal_obligation",
  "secondary_story"
]);

export const EVENT_SEARCH_CONSTRAINTS = Object.freeze({
  maxActionsPerCandidate: 4,
  forbidProseFactField: true,
  requireTypedActions: true
});

export const EDIT_PROVENANCE_FIELDS = Object.freeze([
  "source_span",
  "reason",
  "used_facts",
  "used_events",
  "removed",
  "preserved",
  "knowledge_changed"
]);

const EDITORIAL_SET = new Set([...EDITORIAL_ROLE_CODES, ...EDITORIAL_CAST_CODES]);
const QA_SET = new Set([...FAIRNESS_CODES, ...INTERESTINGNESS_CODES]);

export function isSemanticToken(token) {
  return SEMANTIC_TOKENS.includes(token);
}

export function isAllowedLlmRole(role) {
  return LLM_ROLES.includes(role);
}

export function reworkLayerFor(code) {
  return REWORK_LAYER[code] || null;
}

export function isResourceCollision(type) {
  return COLLISION_TYPES.includes(type);
}

export function isEditorialCode(code) {
  return EDITORIAL_SET.has(code);
}

export function isQaCode(code) {
  return QA_SET.has(code);
}

export function editorMayDelete(infoKind) {
  return infoKind === INFO_KIND.INTERPRETATION_OPTIONAL;
}

export function qaFailureMayGoToEditor() {
  return false;
}

export function routeAnomaly(code, { afterEditorial = false } = {}) {
  if (QA_SET.has(code)) return "game_design_upstream";
  if (!afterEditorial && EDITORIAL_SET.has(code)) return "editorial_pass";
  if (!afterEditorial && (code === "unearned_compression" || code === "procedural_reexpansion")) {
    return "editorial_pass";
  }
  return REWORK_LAYER[code] || null;
}

export function corpusAnomalyFirstRoute() {
  return "editorial_diagnosis";
}

export function affectedRolesFromRefs(refs, index) {
  const ids = new Set();
  for (const ref of refs || []) {
    for (const roleId of index?.[ref] || []) ids.add(roleId);
  }
  return [...ids];
}
