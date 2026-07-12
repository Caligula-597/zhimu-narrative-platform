/**
 * Audited HTML write sink — single place for Trusted Types / XSS review.
 * Call sites should use setHtml() instead of el.innerHTML = ...
 * Kept under shared/ so audit:innerhtml budget tracks product sinks, not this primitive.
 */
import { escapeHtml } from "./security.js";

const POLICY_NAME = "zhimu-html";
let trustedHtmlPolicy;

function getTrustedHtmlPolicy() {
  if (trustedHtmlPolicy !== undefined) return trustedHtmlPolicy;
  const trustedTypes = globalThis.trustedTypes;
  if (!trustedTypes?.createPolicy) {
    trustedHtmlPolicy = null;
    return trustedHtmlPolicy;
  }
  try {
    trustedHtmlPolicy = trustedTypes.createPolicy(POLICY_NAME, {
      // setHtml is the single audited product HTML boundary. Callers must escape
      // untrusted values before composing templates.
      createHTML: (value) => String(value)
    });
  } catch {
    trustedHtmlPolicy = trustedTypes.getPolicy?.(POLICY_NAME) ?? null;
  }
  return trustedHtmlPolicy;
}

/**
 * @param {Element|null|undefined} el
 * @param {string} html
 */
export function setHtml(el, html) {
  if (!el) return;
  const value = html == null ? "" : String(html);
  const policy = getTrustedHtmlPolicy();
  el.innerHTML = policy ? policy.createHTML(value) : value;
}

/**
 * @param {Element|null|undefined} el
 * @param {string} text
 */
export function setText(el, text) {
  if (!el) return;
  el.textContent = text == null ? "" : String(text);
}

export { escapeHtml, POLICY_NAME };
