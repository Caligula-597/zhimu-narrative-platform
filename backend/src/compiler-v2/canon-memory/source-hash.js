import { createHash } from "node:crypto";
import { CANON_COMPILER_VERSION } from "./constants.js";

export function hashSourceSection(section = {}) {
  const body = String(section.originalText || section.text || "").trim();
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 24);
}

/**
 * Content-addressed cache key for a section capsule LLM call.
 */
export function capsuleCacheKey(section, { model = "default", tier = "capsule" } = {}) {
  const h = hashSourceSection(section);
  const sid = String(section.id || section.sourceSectionId || "").trim();
  return createHash("sha256")
    .update(`${CANON_COMPILER_VERSION}\n${tier}\n${model}\n${sid}\n${h}`)
    .digest("hex")
    .slice(0, 32);
}

export function outlineCacheKey(sections, { model = "default" } = {}) {
  const digest = sections
    .map((s) => `${s.id}:${hashSourceSection(s)}`)
    .join("\n");
  return createHash("sha256")
    .update(`${CANON_COMPILER_VERSION}\noutline\n${model}\n${digest}`)
    .digest("hex")
    .slice(0, 32);
}
