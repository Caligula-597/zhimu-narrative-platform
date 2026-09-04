/**
 * M01-FRAMING 兼容导出 —— 数据来自 Registry / framing-data。
 * 新代码请：getStoryTemplate("M01-FRAMING")
 */

import { getStoryTemplate, getStoryVariant } from "./story-mechanism-registry.js";
import {
  M01_FRAMING_VARIANTS,
  M01_PLOT_CANDIDATES,
} from "./story-mechanism-m01-framing-data.js";

export const M01_FRAMING_TEMPLATE_ID = "M01-FRAMING";
export const M01_FRAMING_MECHANISM_ID = "M01-FRAMING";
export const M01_FRAMING_FAMILY_ID = "M01";

export { M01_FRAMING_VARIANTS, M01_PLOT_CANDIDATES };

export function getM01FramingVariant(variantId) {
  const v = getStoryVariant("M01-FRAMING", variantId);
  if (!v) return null;
  // 兼容旧字段名 name / summary / beatOutline
  return {
    id: v.id,
    name: v.title,
    summary: v.description,
    defaults: v.defaults || {},
    beatOutline: {
      setup: v.beatPattern?.setup,
      crime: v.beatPattern?.crime,
      falseDirection: v.beatPattern?.falseDirection,
      contradiction: v.beatPattern?.contradiction,
      reveal: v.beatPattern?.reveal,
    },
  };
}

export function listM01FramingVariants() {
  const tpl = getStoryTemplate("M01-FRAMING");
  return (tpl?.variants || []).map((v) => ({
    id: v.id,
    name: v.title,
    summary: v.description,
  }));
}

const tpl = getStoryTemplate("M01-FRAMING");
export const M01_FRAMING = Object.freeze({
  id: M01_FRAMING_TEMPLATE_ID,
  familyId: M01_FRAMING_FAMILY_ID,
  mechanismId: M01_FRAMING_MECHANISM_ID,
  title: tpl?.title || "嫁祸型追凶",
  purpose: tpl?.purpose || "",
  roleSlots: tpl?.roleSlots || {},
  plotSlots: tpl?.plotSlots || {},
  clueSlots: (tpl?.clueSlots || []).map((c) => (typeof c === "string" ? c : c.id)),
  stagePattern: (tpl?.stagePattern || []).map((s) => (typeof s === "string" ? s : s.id)),
});
