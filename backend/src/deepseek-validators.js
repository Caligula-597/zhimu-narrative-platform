/** Public DeepSeek validation compatibility facade. */

export { normalizeStoryBrief, validateStorySpec } from "./deepseek-validation/input-contract.js";
export { validateStoryOutlineBlueprint } from "./deepseek-validation/blueprint-validator.js";
export { validateStoryOutlineAssemblyComponent } from "./deepseek-validation/assembly-component-validator.js";
export { mergeStoryOutlineAssembly } from "./deepseek-validation/assembly-merge.js";
export { validateStoryOutline } from "./deepseek-validation/legacy-outline-reader.js";
export { validateOutlineBatchDiversity } from "./outline-quality-validator.js";
export { validateDeepseekProposal } from "./deepseek-validation/proposal-validator.js";
export {
  validateRoleMatrix,
  validateRoleScriptFromNarrative,
  validateRoleSection,
  validateRolesFromNarrative,
  validateRolesMeta
} from "./deepseek-validation/role-validators.js";
export {
  chapterNarrativeMinChars,
  validateChapterNarrative,
  validateManuscriptSynopsis
} from "./deepseek-validation/manuscript-validators.js";
export { validateStoryEvaluation } from "./deepseek-validation/evaluation-validator.js";
