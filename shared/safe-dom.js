/**
 * Audited HTML write sink — single place for Trusted Types / XSS review.
 * Call sites should use setHtml() instead of el.innerHTML = ...
 * Kept under shared/ so audit:innerhtml budget tracks product sinks, not this primitive.
 */
import { escapeHtml } from "./security.js";

/**
 * @param {Element|null|undefined} el
 * @param {string} html
 */
export function setHtml(el, html) {
  if (!el) return;
  el.innerHTML = html == null ? "" : String(html);
}

/**
 * @param {Element|null|undefined} el
 * @param {string} text
 */
export function setText(el, text) {
  if (!el) return;
  el.textContent = text == null ? "" : String(text);
}

export { escapeHtml };
