/**
 * B4: Faceted world tags for catalog filtering.
 */
import { query } from "./db.js";
import { throwErr } from "./api-errors.js";

const TAG_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const TAG_VALUE_MAX = 64;

function sanitizeTagKey(key) {
  const normalized = String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 32);
  if (!TAG_KEY_PATTERN.test(normalized)) throwErr("BAD_REQUEST", "Invalid tag key");
  return normalized;
}

function sanitizeTagValue(value) {
  return String(value ?? "")
    .trim()
    .slice(0, TAG_VALUE_MAX);
}

export async function listWorldTags(worldId) {
  const { rows } = await query(
    `SELECT id, tag_key, tag_value, created_at FROM world_tags WHERE world_id = $1 ORDER BY tag_key, tag_value`,
    [worldId]
  );
  return rows;
}

export async function replaceWorldTags(worldId, tags = [], runQuery = query) {
  await runQuery(`DELETE FROM world_tags WHERE world_id = $1`, [worldId]);
  const inserted = [];
  const seen = new Set();
  for (const row of tags) {
    const tagKey = sanitizeTagKey(row.tagKey ?? row.tag_key ?? row.key);
    const tagValue = sanitizeTagValue(row.tagValue ?? row.tag_value ?? row.value);
    if (!tagValue) continue;
    const dedupe = `${tagKey}:${tagValue}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const { rows } = await runQuery(
      `INSERT INTO world_tags (world_id, tag_key, tag_value) VALUES ($1, $2, $3)
       RETURNING id, tag_key, tag_value`,
      [worldId, tagKey, tagValue]
    );
    inserted.push(rows[0]);
  }
  return inserted;
}

export async function listCatalogTagFacets() {
  const { rows } = await query(
    `SELECT tag_key, tag_value, count(*)::int AS world_count
     FROM world_tags wt
     JOIN worlds w ON w.id = wt.world_id
     WHERE w.catalog_public = true AND w.status <> 'archived'
     GROUP BY tag_key, tag_value
     ORDER BY tag_key, world_count DESC, tag_value`
  );
  const facets = {};
  for (const row of rows) {
    if (!facets[row.tag_key]) facets[row.tag_key] = [];
    facets[row.tag_key].push({ value: row.tag_value, worldCount: row.world_count });
  }
  return facets;
}

export function parseCatalogTagFilters(queryParams = {}) {
  const filters = [];
  for (const [key, value] of Object.entries(queryParams)) {
    if (!key.startsWith("tag_") || value == null || value === "") continue;
    const tagKey = key.slice(4);
    if (!TAG_KEY_PATTERN.test(tagKey)) continue;
    const values = String(value)
      .split(",")
      .map((v) => sanitizeTagValue(v))
      .filter(Boolean);
    if (!values.length) continue;
    filters.push({ tagKey, values });
  }
  return filters;
}

export function buildCatalogTagFilterSql(filters, paramStart = 1) {
  if (!filters.length) return { sql: "", params: [] };
  const params = [];
  const clauses = filters.map((filter) => {
    const keyParam = paramStart + params.length;
    params.push(filter.tagKey);
    const valueParams = filter.values.map((v) => {
      params.push(v);
      return `$${paramStart + params.length}`;
    });
    return `EXISTS (
      SELECT 1 FROM world_tags wt
      WHERE wt.world_id = w.id
        AND wt.tag_key = $${keyParam}
        AND wt.tag_value IN (${valueParams.join(", ")})
    )`;
  });
  return { sql: clauses.join(" AND "), params };
}

export async function attachTagsToWorldRows(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const { rows: tagRows } = await query(
    `SELECT world_id, tag_key, tag_value FROM world_tags WHERE world_id = ANY($1::uuid[])`,
    [ids]
  );
  const byWorld = new Map();
  for (const tag of tagRows) {
    if (!byWorld.has(tag.world_id)) byWorld.set(tag.world_id, []);
    byWorld.get(tag.world_id).push({ tagKey: tag.tag_key, tagValue: tag.tag_value });
  }
  return rows.map((row) => ({ ...row, tags: byWorld.get(row.id) || [] }));
}
