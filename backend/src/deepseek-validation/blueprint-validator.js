import { throwErr } from "../api-errors.js";
import { OUTLINE_VERSION } from "../story-outline-contract/vocabulary.js";
import { BLUEPRINT_RULES } from "./blueprint/rules/index.js";
import { createBlueprintValidationContext } from "./blueprint/validation-context.js";

export function validateStoryOutlineBlueprint(raw, spec, { brief = null } = {}) {
  const context = createBlueprintValidationContext(raw, spec, brief);
  for (const validateRulePack of BLUEPRINT_RULES) validateRulePack(context);

  const issues = context.issues.toArray();
  if (issues.length) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 创作蓝图未通过机械合同（" + issues.length + " 项）", {
      outlineVersion: OUTLINE_VERSION,
      outlineRevision: context.expectedRevision,
      repairMode: "restart-full-draft",
      generationAcceptanceMode: "reject-and-restart-full-draft",
      issues
    });
  }
  return context.value;
}
