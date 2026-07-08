/** Compact relationship graph SVG for creator cockpit. */
import { escapeHtml } from "../utils/format.js";

export function renderRelationshipGraph(roles, relationships) {
  if (!roles.length) return `<div class="empty-state">请先创建角色席位。</div>`;
  const n = roles.length;
  const nodes = roles.map((role, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(angle) * 38;
    const y = 50 + Math.sin(angle) * 38;
    return { role, x, y };
  });
  const byId = new Map(nodes.map((node) => [node.role.id, node]));
  const edges = (relationships || []).map((rel) => {
    const from = byId.get(rel.from_role_slot_id || rel.fromRoleSlotId);
    const to = byId.get(rel.to_role_slot_id || rel.toRoleSlotId);
    if (!from || !to) return "";
    const label = rel.label || rel.relation_type || rel.relationType || "";
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    return `<line class="rel-edge" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" /><text class="rel-label" x="${mx}" y="${my}" text-anchor="middle">${escapeHtml(label)}</text>`;
  }).join("");
  const nodeMarkup = nodes.map(({ role, x, y }) => `<g class="rel-node"><circle cx="${x}" cy="${y}" r="5.5" /><text x="${x}" y="${y + 9}" text-anchor="middle">${escapeHtml(role.name.slice(0, 4))}</text></g>`).join("");
  return `<svg class="relationship-graph" viewBox="0 0 100 100" aria-label="角色关系图">${edges}${nodeMarkup}</svg>`;
}
