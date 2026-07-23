/**
 * Compatibility entrypoint. Existing imports stay valid while new product
 * modules consume the complete narrative profile contract.
 */
export {
  CREATION_TYPES,
  CREATOR_TERMINOLOGY,
  creatorTerms,
  normalizeCreationType
} from "./narrative-profile.js";
