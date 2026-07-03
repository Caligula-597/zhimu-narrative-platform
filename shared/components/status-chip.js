/**
 * Shared status chip — tone + label HTML for main / play / host / site.
 */
import { escapeHtml } from "../security.js";

/** Allowed tone class names (matches shared/styles/status-chip.css). */
export const STATUS_CHIP_TONES = new Set(["draft", "testing", "published", "danger", "ok"]);

/**
 * @param {{ tone?: string, label: string, className?: string }} options
 * @returns {string}
 */
export function renderStatusChip({ tone = "draft", label, className = "" }) {
  const safeTone = STATUS_CHIP_TONES.has(tone) ? tone : "draft";
  const extra = className ? ` ${escapeHtml(className)}` : "";
  return `<span class="status-chip ${safeTone}${extra}">${escapeHtml(label)}</span>`;
}

/**
 * Row wrapper for multiple chips (play player home, etc.).
 * @param {string} innerHtml
 * @returns {string}
 */
export function renderStatusChipRow(innerHtml) {
  return `<div class="status-chips">${innerHtml}</div>`;
}
