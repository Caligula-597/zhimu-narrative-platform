/**
 * Audited HTML write sink — single place for Trusted Types / XSS review.
 * Call sites should use setHtml() instead of el.innerHTML = ...
 * Kept under shared/ so audit:innerhtml budget tracks product sinks, not this primitive.
 *
 * createHTML is intentionally not a full sanitizer: callers must escapeHtml untrusted
 * values. The policy still applies defense-in-depth checks and refuses fail-open when
 * the Trusted Types API is present but the named policy cannot be created.
 */
import { escapeHtml } from "./security.js";

const POLICY_NAME = "zhimu-html";
let trustedHtmlPolicy;

/**
 * Reject classic executable vectors that would slip through if a caller forgot escapeHtml.
 * Does not attempt to be a general HTML sanitizer.
 * @param {string} html
 */
export function assertSafeProductHtml(html) {
  const value = String(html ?? "");
  if (/<\s*script[\s>/]/i.test(value)) {
    throw new TypeError(`${POLICY_NAME} rejected <script> markup`);
  }
  if (/<\s*iframe[\s>/]/i.test(value)) {
    throw new TypeError(`${POLICY_NAME} rejected <iframe> markup`);
  }
  if (/<\s*object[\s>/]/i.test(value)) {
    throw new TypeError(`${POLICY_NAME} rejected <object> markup`);
  }
  if (/<\s*embed[\s>/]/i.test(value)) {
    throw new TypeError(`${POLICY_NAME} rejected <embed> markup`);
  }
  if (/\s+on[a-z]+\s*=/i.test(value)) {
    throw new TypeError(`${POLICY_NAME} rejected inline event handler attribute`);
  }
  if (/javascript\s*:/i.test(value)) {
    throw new TypeError(`${POLICY_NAME} rejected javascript: URL`);
  }
  return value;
}

function getTrustedHtmlPolicy() {
  if (trustedHtmlPolicy !== undefined) return trustedHtmlPolicy;
  const trustedTypes = globalThis.trustedTypes;
  if (!trustedTypes?.createPolicy) {
    trustedHtmlPolicy = null;
    return trustedHtmlPolicy;
  }
  try {
    trustedHtmlPolicy = trustedTypes.createPolicy(POLICY_NAME, {
      createHTML: (value) => assertSafeProductHtml(value)
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
  const value = assertSafeProductHtml(html == null ? "" : String(html));
  const policy = getTrustedHtmlPolicy();
  if (policy) {
    el.innerHTML = policy.createHTML(value);
    return;
  }
  // Fail closed when the TT API exists but our policy is unavailable — never
  // silently assign a raw string under an enforced Trusted Types document.
  if (globalThis.trustedTypes?.createPolicy) {
    throw new TypeError(`${POLICY_NAME} policy unavailable; refusing raw HTML assignment`);
  }
  el.innerHTML = value;
}

/**
 * @param {Element|null|undefined} el
 * @param {string} text
 */
export function setText(el, text) {
  if (!el) return;
  el.textContent = text == null ? "" : String(text);
}

export function resetTrustedHtmlPolicyForTests() {
  trustedHtmlPolicy = undefined;
}

export { escapeHtml, POLICY_NAME };
