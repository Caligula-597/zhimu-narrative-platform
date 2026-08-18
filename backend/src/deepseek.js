/**
 * LLM client facade.
 * Story generation now lives in the V6 world engine. This module only
 * re-exports the JSON client plus retired V2.4 outline helpers still used by
 * mechanism-package validators and their tests.
 */
import { deepseekConfig } from "./deepseek-config.js";
import { requestDeepseekJson } from "./deepseek-client.js";

export { deepseekConfig, requestDeepseekJson };
export {
  normalizeStoryBrief,
  validateStorySpec,
  validateStoryOutline,
  validateStoryOutlineBlueprint,
  validateStoryOutlineAssemblyComponent,
  mergeStoryOutlineAssembly,
  validateOutlineBatchDiversity
} from "./deepseek-validators.js";
export { buildStorySpecMessages } from "./prompts/spec.js";
export {
  buildStoryOutlineAssemblyComponentMessages,
  buildStoryOutlineAssemblyMessages,
  buildStoryOutlineAssemblyMechanicalPatchPlan,
  buildStoryOutlineAssemblyPatchMessages,
  buildStoryOutlineBlueprintMessages,
  buildStoryOutlineBlueprintPatchMessages,
  buildStoryOutlineMessages
} from "./prompts/outline.js";
export {
  assemblyIssuesArePatchable,
  blueprintIssuesArePatchable
} from "./deepseek-outline-repair/issue-policy.js";
export { applyJsonPointerPatches } from "./deepseek-outline-repair/json-pointer-patch.js";
