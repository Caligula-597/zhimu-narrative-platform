/**
 * Shared collapsible card template — pure HTML renderer used by main app and host.
 *
 * Caller responsibilities:
 * - compute `open` boolean via end-specific isPanelOpen (state access differs per end)
 * - wire toggle-collapse-panel action to end-specific togglePanelInDom
 *
 * Uses escapeHtml from shared/security.js for attribute escaping (covers & < > " ').
 */
import { escapeHtml } from "../security.js";

/**
 * Render a collapsible card panel as HTML string.
 * @param {object} opts
 * @param {string} opts.id - panel id (used for data-collapse-panel + data-panel-id)
 * @param {string} opts.title - heading text
 * @param {string} [opts.subtitle=""] - optional sub-heading
 * @param {string} [opts.body=""] - panel body HTML
 * @param {string} [opts.headerExtra=""] - extra actions HTML in header
 * @param {boolean} [opts.defaultOpen=true] - default open state (for data-default-open attr)
 * @param {boolean} opts.open - current open state (caller computes via isPanelOpen)
 * @param {string} [opts.className="card"] - article class
 * @param {string} [opts.style=""] - inline style
 * @param {boolean} [opts.nested=false] - if true, adds collapse-panel-nested class
 * @returns {string}
 */
export function renderCollapsibleCard({
  id,
  title,
  subtitle = "",
  body = "",
  headerExtra = "",
  defaultOpen = true,
  open,
  className = "card",
  style = "",
  nested = false
} = {}) {
  const nestedClass = nested ? " collapse-panel-nested" : "";
  return `<article class="${className} collapse-panel${open ? " is-open" : " is-collapsed"}${nestedClass}" data-collapse-panel="${escapeHtml(id)}" style="${style}">
    <div class="collapse-panel-head">
      <button type="button" class="collapse-panel-toggle" data-action="toggle-collapse-panel" data-panel-id="${escapeHtml(id)}" data-default-open="${defaultOpen ? "1" : "0"}" aria-expanded="${open}">
        <span class="collapse-panel-chevron" aria-hidden="true">${open ? "▾" : "▸"}</span>
        <div class="collapse-panel-titles">
          <h3>${escapeHtml(title)}</h3>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        </div>
      </button>
      ${headerExtra ? `<div class="collapse-panel-actions">${headerExtra}</div>` : ""}
    </div>
    <div class="collapse-panel-body">${body}</div>
  </article>`;
}
