/** Compact relationship graph SVG for creator cockpit. */
import { escapeHtml } from "../utils/format.js";

export function renderRelationshipGraph(roles, relationships) {
  if (!roles.length) return `<div class="empty-state">请先创建角色席位。</div>`;
  const width = 720;
  const height = 420;
  const centerX = width / 2;
  const centerY = height / 2;
  const n = roles.length;
  const nodes = roles.map((role, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * Math.min(280, 210 + n * 8);
    const y = centerY + Math.sin(angle) * Math.min(145, 105 + n * 6);
    return { role, x, y };
  });
  const byId = new Map(nodes.map((node) => [node.role.id, node]));
  const edges = (relationships || []).map((rel) => {
    const from = byId.get(rel.from_role_slot_id || rel.fromRoleSlotId);
    const to = byId.get(rel.to_role_slot_id || rel.toRoleSlotId);
    if (!from || !to) return "";
    const label = rel.label || rel.relation_type || rel.relationType || "";
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;
    const unitX = dx / distance;
    const unitY = dy / distance;
    const x1 = from.x + unitX * 34;
    const y1 = from.y + unitY * 34;
    const x2 = to.x - unitX * 42;
    const y2 = to.y - unitY * 42;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const labelWidth = Math.min(168, Math.max(56, String(label || "关系").length * 14 + 24));
    const strength = Number.isInteger(rel.strength) ? Math.min(10, Math.abs(rel.strength)) : 0;
    return `<g class="rel-connection"><line class="rel-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#relationship-arrow)" style="stroke-width:${2 + strength * 0.12}" /><g class="rel-label-badge"><rect x="${mx - labelWidth / 2}" y="${my - 14}" width="${labelWidth}" height="28" rx="14" /><text class="rel-label" x="${mx}" y="${my + 5}" text-anchor="middle">${escapeHtml(label || "关系")}</text></g></g>`;
  }).join("");
  const nodeMarkup = nodes.map(({ role, x, y }) => `<g class="rel-node"><circle cx="${x}" cy="${y}" r="32" /><text x="${x}" y="${y + 6}" text-anchor="middle">${escapeHtml(role.name.slice(0, 4))}</text></g>`).join("");
  return `<svg class="relationship-graph" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="角色关系图"><defs><marker id="relationship-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>${edges}${nodeMarkup}</svg>`;
}
