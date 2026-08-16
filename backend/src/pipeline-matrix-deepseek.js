import { createPipelineMatrixNarrativePlayerScript } from "./pipeline-matrix-narrative-generator.js";
import { createPipelineMatrixStructuredPlayerScript } from "./pipeline-matrix-structured-generator.js";

export async function createPipelineMatrixPlayerScript(input) {
  const mode = input.scriptGenerationMode ?? "structured";
  return mode === "structured"
    ? createPipelineMatrixStructuredPlayerScript(input)
    : createPipelineMatrixNarrativePlayerScript(input);
}

export { buildPipelineImportPackage } from "./pipeline-matrix-import-package.js";
export { createPipelineMatrixNarrativePlayerScript } from "./pipeline-matrix-narrative-generator.js";
export { createPipelineMatrixStructuredPlayerScript } from "./pipeline-matrix-structured-generator.js";

export {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  matrixScriptsToSections,
  pipelineScriptMinWords,
  pipelineWordTargets
} from "./pipeline-matrix-model.js";

export {
  createPipelineKnowledgeBoundaryAudit,
  createPipelineKnowledgeBoundaryAuditBatch,
  createPipelineMatrixEvaluation,
  createPipelineMatrixScriptReadthroughEvaluation
} from "./pipeline-matrix-evaluation.js";

export {
  createPipelineActOutline,
  createPipelineCharacterArchives,
  createPipelineClueNetwork,
  createPipelineHostRunbook,
  createPipelineHostRunbooksAll,
  createPipelineInfoMatrix,
  createPipelineInnocentScriptsTruthInference,
  createPipelineReasoningNovel,
  createPipelineTruthBible,
  createPipelineTruthReconstruction
} from "./pipeline-matrix-foundation.js";
