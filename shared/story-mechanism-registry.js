/**
 * STORY_MECHANISM_TEMPLATE_REGISTRY
 *
 * catalog 37 STORY ID 必须命中；GAME 不得入册。
 * M01-FRAMING 为生产专用完整模板（额外条目）。
 */

import {
  CATALOG_STORY_TEMPLATE_IDS,
  CONTENT_MATURITY,
  buildAllStoryTemplates,
} from "./story-mechanism-templates-data.js";
import { FAMILY_MECHANISM_ROLE } from "./story-mechanism-contracts.js";

const TEMPLATES = buildAllStoryTemplates();
const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export const STORY_MECHANISM_TEMPLATE_REGISTRY = Object.freeze({
  version: 1,
  templates: TEMPLATES,
});

export function listStoryTemplates({ familyId, contentMaturity } = {}) {
  return TEMPLATES.filter((t) => {
    if (familyId && t.familyId !== familyId) return false;
    if (contentMaturity && t.contentMaturity !== contentMaturity) return false;
    return true;
  });
}

export function getStoryTemplate(templateId) {
  return BY_ID.get(String(templateId ?? "")) || null;
}

export function getStoryVariant(templateId, variantId) {
  const tpl = getStoryTemplate(templateId);
  if (!tpl) return null;
  return tpl.variants.find((v) => v.id === String(variantId)) || null;
}

export function listStoryFamilies() {
  return [...new Set(TEMPLATES.map((t) => t.familyId))].sort();
}

export function contentMaturityTable() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    familyId: t.familyId,
    title: t.title,
    contentMaturity: t.contentMaturity,
    variantCount: t.variants.length,
    inCatalog: CATALOG_STORY_TEMPLATE_IDS.includes(t.id),
  }));
}

/**
 * Registry 完整性校验。
 * @returns {string[]} problems
 */
export function validateStoryRegistry(catalogStoryIds = CATALOG_STORY_TEMPLATE_IDS) {
  const problems = [];
  const seen = new Set();
  for (const t of TEMPLATES) {
    if (seen.has(t.id)) problems.push(`重复 template id: ${t.id}`);
    seen.add(t.id);
    if (FAMILY_MECHANISM_ROLE[t.familyId] !== "STORY_MECHANISM") {
      problems.push(`非 STORY 家族误入 registry: ${t.id} (${t.familyId})`);
    }
    if (!t.variants?.length) problems.push(`缺少 variants: ${t.id}`);
    if (!t.roleSlots || !Object.keys(t.roleSlots).length) {
      problems.push(`缺少 roleSlots: ${t.id}`);
    }
    if (!Object.values(CONTENT_MATURITY).includes(t.contentMaturity)) {
      problems.push(`非法 contentMaturity: ${t.id} ${t.contentMaturity}`);
    }
  }
  for (const id of catalogStoryIds) {
    if (!BY_ID.has(id)) problems.push(`catalog STORY 缺少 Narrative Template: ${id}`);
  }
  return problems;
}

export { CATALOG_STORY_TEMPLATE_IDS, CONTENT_MATURITY };
