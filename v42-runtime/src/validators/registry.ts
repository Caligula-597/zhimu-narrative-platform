// ── V4.4 Validator Registry ──

import type { ValidatorDefinition } from "./registry-types.js";
import { checkPremise } from "./premise-validator.js";
import { checkConflictKernel } from "./conflict-kernel-validator.js";
import { checkWholeGamePlayability } from "./whole-game-playability-validator.js";

export const VALIDATOR_REGISTRY: ValidatorDefinition[] = [
  { id: "premise_validator", category: "deterministic", defaultSeverity: "hard" },
  { id: "conflict_kernel_validator", category: "deterministic", defaultSeverity: "hard" },
  { id: "whole_game_playability", category: "simulation", defaultSeverity: "hard" }
];

export { checkPremise, checkConflictKernel, checkWholeGamePlayability };