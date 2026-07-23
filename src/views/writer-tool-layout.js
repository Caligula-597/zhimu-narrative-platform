import { escapeHtml } from "../utils/format.js";

function classTokens(value = "") {
  return String(value)
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter(Boolean)
    .join(" ");
}

function requiredDataToken(value, field) {
  const token = String(value || "");
  if (!/^[a-z0-9-]+$/.test(token)) throw new Error(`Invalid ${field}: ${token}`);
  return token;
}

export function writerToolFactsHtml(facts = []) {
  const rows = facts
    .filter((fact) => fact && fact.label != null)
    .map((fact) => {
      const hook = fact.hook ? requiredDataToken(fact.hook, "writer tool fact hook") : "";
      return `<div><dt>${escapeHtml(fact.label)}</dt><dd${hook ? ` data-${hook}` : ""}>${escapeHtml(fact.value ?? "—")}</dd></div>`;
    })
    .join("");
  return rows ? `<dl class="writer-metadata-facts">${rows}</dl>` : "";
}

export function writerToolGuidanceHtml({ title, text, className = "" } = {}) {
  if (!title && !text) return "";
  const extraClass = classTokens(className);
  return `<div class="writer-metadata-guidance${extraClass ? ` ${extraClass}` : ""}">
    <strong>${escapeHtml(title || "说明")}</strong>
    <p>${escapeHtml(text || "")}</p>
  </div>`;
}

/**
 * `bodyHtml` is an internal, already escaped fragment owned by the calling view.
 * User and API values belong in the typed title/intro/facts/guidance fields.
 */
export function writerToolContextPanelHtml({
  kicker,
  title,
  intro,
  facts = [],
  bodyHtml = "",
  className = ""
} = {}) {
  const extraClass = classTokens(className);
  return `<aside class="writer-tool-context${extraClass ? ` ${extraClass}` : ""}">
    ${kicker ? `<p class="section-kicker">${escapeHtml(kicker)}</p>` : ""}
    <h2>${escapeHtml(title || "")}</h2>
    ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
    ${writerToolFactsHtml(facts)}
    ${bodyHtml}
  </aside>`;
}

/**
 * Shared Writer tool surface. `bodyHtml` is composed by the owning domain view.
 */
export function writerToolSurfaceHtml({
  type,
  bodyHtml = "",
  className = ""
} = {}) {
  const safeType = requiredDataToken(type, "writer tool type");
  const extraClass = classTokens(className);
  return `<section class="writer-tool-workspace${extraClass ? ` ${extraClass}` : ""}" data-writer-tool-workspace data-writer-tool="${safeType}">
    ${bodyHtml}
  </section>`;
}

export function writerToolGridPageHtml({
  type,
  contextHtml = "",
  contentHtml = "",
  className = "",
  wide = false,
  backAction = "writer-tool-close",
  backLabel = "返回创作中心"
} = {}) {
  const safeAction = requiredDataToken(backAction, "writer tool back action");
  return writerToolSurfaceHtml({
    type,
    className,
    bodyHtml: `<button type="button" class="workspace-back-btn" data-action="${safeAction}">← ${escapeHtml(backLabel)}</button>
    <div class="writer-tool-grid${wide ? " writer-tool-grid-wide" : ""}">
      ${contextHtml}
      ${contentHtml}
    </div>`
  });
}
