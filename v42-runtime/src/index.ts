// V4.4 Proof-Driven Unified Architecture — Rev.2
// Includes: Exact ProjectSpec, Unified Dramatic Contract, Premise Witness Sandbox,
// P-P13~P-P18, Unified Fidelity, Upstream Reopen, Configuration Variants

export { ExactProjectSpec, ConfigurationVariant, createDefaultProjectSpec } from "./domain/project-spec.js";
export { PremiseCandidate } from "./domain/premise-candidate.js";
export { CapabilityProfile, CapabilityLevel, CapabilityJustification, createDefaultCapabilityProfile, createDefaultJustifications } from "./domain/capability-profile.js";
export { UnifiedDramaticContract, UnifiedFidelity, createDefaultUnifiedDramaticContract } from "./domain/unified-dramatic-contract.js";
export { PremiseWitness, createPremiseWitness } from "./domain/premise-witness.js";
export { UpstreamReopenRequest, createUpstreamReopenRequest } from "./domain/upstream-reopen.js";
export { V44Orchestrator, V44OrchestratorResult } from "./core/orchestrator/v44-orchestrator.js";
export { STAGE_ORDER, STAGE_LABELS, type V44Stage, type Verdict, type StageVerdict, type PipelineContext, type UnifiedFidelity as UF, type ConfigurationVariant as CV, type UpstreamReopenRequest as URR } from "./core/pipeline/types.js";
export { Proof, ProofPack, createProofPack, addProof, finalizeProofPack } from "./core/pipeline/proof/proof-types.js";
export { verifyProofPack, VerificationResult } from "./core/pipeline/proof/verifier.js";
export { StageReviewReport, formatReviewReport, fromStageVerdict, buildPassVerdict, buildHoldVerdict } from "./core/pipeline/review/review-report.js";
export { CaseAgainst, buildCaseAgainst } from "./core/pipeline/review/case-against.js";
export { checkPremise, PremiseProofResult } from "./validators/premise-validator.js";
export { checkConflictKernel, ConflictKernelProof } from "./validators/conflict-kernel-validator.js";
export { checkWholeGamePlayability, FiveTableSimulationResult } from "./validators/whole-game-playability-validator.js";
export { VALIDATOR_REGISTRY } from "./validators/registry.js";
export { FailureFixture, REGRESSION_FIXTURES, FIXTURE_006, FIXTURE_007, FIXTURE_008 } from "./domain/fixture/failure-fixture.js";