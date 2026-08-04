import { validateBlueprintCoreIdentity } from "./core-identity.js";
import { validateBlueprintEndingContract } from "./ending-contract.js";
import { validateBlueprintGenreStateResource } from "./genre-state-resource.js";
import { validateBlueprintSemanticEvidence } from "./semantic-evidence.js";

// Order is part of the error contract: issue arrays must stay deterministic.
export const BLUEPRINT_RULES = Object.freeze([
  validateBlueprintCoreIdentity,
  validateBlueprintGenreStateResource,
  validateBlueprintSemanticEvidence,
  validateBlueprintEndingContract
]);
