import { query } from "./db.js";

const TYPE_LABELS = {
  role: "角色",
  section: "分幕",
  scene: "场景",
  clue: "线索",
  investigation_point: "调查点",
  rule: "规则",
  item: "物品",
  knowledge: "知识块"
};

const VIEW_BY_TYPE = {
  role: "writer",
  section: "writer",
  scene: "studio",
  clue: "clues",
  investigation_point: "studio",
  rule: "rules",
  item: "studio",
  knowledge: "writer"
};

function escapeLike(raw) {
  return String(raw).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function snippet(text, max = 120) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function mapRow(type, row) {
  return {
    type,
    typeLabel: TYPE_LABELS[type] || type,
    id: row.id,
    title: row.title,
    snippet: snippet(row.snippet),
    view: VIEW_BY_TYPE[type] || "overview",
    meta: row.meta || {}
  };
}

/**
 * World-scoped search. Owner/editor searches all draft authoring material;
 * host/viewer searches only non-draft content plus non-author knowledge chunks.
 */
export async function searchWorldContent(worldId, { q, limit = 30, type = "all", includeDraftContent = true } = {}) {
  const term = String(q || "").trim();
  if (!term) return { query: "", results: [], total: 0 };
  const capped = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const bucketLimit = type && type !== "all" ? capped : Math.min(Math.max(capped * 2, 20), 100);
  const like = `%${escapeLike(term)}%`;
  const useTs = term.length >= 2;
  const params = [worldId, like];
  let tsParamIndex = null;
  if (useTs) {
    params.push(term);
    tsParamIndex = params.length;
  }

  const typeFilter = type && type !== "all" ? type : null;
  const buckets = [];

  function pushBucket(bucketType, sql) {
    if (typeFilter && typeFilter !== bucketType) return;
    buckets.push({ bucketType, sql });
  }

  pushBucket(
    "role",
    `SELECT rs.id, rs.name AS title, COALESCE(rs.public_profile, '') AS snippet,
            jsonb_build_object('sequence', rs.sequence) AS meta,
            CASE WHEN $2 <> '' AND rs.name ILIKE $2 ESCAPE '\\' THEN 2 ELSE 0 END
            + CASE WHEN $2 <> '' AND rs.public_profile ILIKE $2 ESCAPE '\\' THEN 1 ELSE 0 END AS rank
     FROM role_slots rs WHERE rs.world_id = $1
       AND (rs.name ILIKE $2 ESCAPE '\\' OR rs.public_profile ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(rs.name,'') || ' ' || coalesce(rs.public_profile,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  pushBucket(
    "section",
    `SELECT ss.id, ss.title, left(COALESCE(ss.body, ''), 240) AS snippet,
            jsonb_build_object('roleSlotId', ss.role_slot_id, 'sequence', ss.sequence) AS meta,
            CASE WHEN ss.title ILIKE $2 ESCAPE '\\' THEN 2 WHEN ss.body ILIKE $2 ESCAPE '\\' THEN 1 ELSE 0 END AS rank
     FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1
       AND (${includeDraftContent ? "true" : "ss.publication_status IN ('testing', 'published')"})
       AND (ss.title ILIKE $2 ESCAPE '\\' OR ss.body ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(ss.title,'') || ' ' || coalesce(ss.body,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  pushBucket(
    "knowledge",
    `SELECT kc.id, kc.title, left(COALESCE(kc.body, ''), 240) AS snippet,
            jsonb_build_object('sourceType', kc.source_type, 'sourceId', kc.source_id, 'roleSlotId', kc.role_slot_id, 'chunkIndex', kc.chunk_index) AS meta,
            CASE WHEN kc.title ILIKE $2 ESCAPE '\\' THEN 3 WHEN kc.body ILIKE $2 ESCAPE '\\' THEN 2 ELSE 0 END AS rank
     FROM knowledge_chunks kc
     WHERE kc.world_id = $1
       AND (${includeDraftContent ? "true" : "kc.visibility <> 'author'"})
       AND (kc.title ILIKE $2 ESCAPE '\\' OR kc.body ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(kc.title,'') || ' ' || coalesce(kc.body,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  pushBucket(
    "scene",
    `SELECT s.id, s.name AS title, COALESCE(s.public_text, '') AS snippet,
            jsonb_build_object('nodeType', 'scene') AS meta,
            CASE WHEN s.name ILIKE $2 ESCAPE '\\' THEN 2 WHEN s.public_text ILIKE $2 ESCAPE '\\' THEN 1 ELSE 0 END AS rank
     FROM scenes s WHERE s.world_id = $1
       AND (s.name ILIKE $2 ESCAPE '\\' OR s.public_text ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(s.name,'') || ' ' || coalesce(s.public_text,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  pushBucket(
    "clue",
    `SELECT c.id, c.name AS title, COALESCE(c.public_text, '') AS snippet,
            jsonb_build_object('nodeType', 'clue') AS meta,
            CASE WHEN c.name ILIKE $2 ESCAPE '\\' THEN 2 WHEN c.public_text ILIKE $2 ESCAPE '\\' THEN 1 ELSE 0 END AS rank
     FROM clues c WHERE c.world_id = $1
       AND (c.name ILIKE $2 ESCAPE '\\' OR c.public_text ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(c.name,'') || ' ' || coalesce(c.public_text,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  pushBucket(
    "investigation_point",
    `SELECT ip.id, ip.name AS title, COALESCE(ip.description, ip.interaction_text, '') AS snippet,
            jsonb_build_object('nodeType', 'investigation_point', 'sceneId', ip.scene_id) AS meta,
            CASE WHEN ip.name ILIKE $2 ESCAPE '\\' THEN 2 ELSE 1 END AS rank
     FROM investigation_points ip WHERE ip.world_id = $1
       AND (ip.name ILIKE $2 ESCAPE '\\' OR ip.description ILIKE $2 ESCAPE '\\' OR ip.interaction_text ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(ip.name,'') || ' ' || coalesce(ip.description,'') || ' ' || coalesce(ip.interaction_text,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  pushBucket(
    "rule",
    `SELECT r.id, r.name AS title, '' AS snippet,
            jsonb_build_object('mode', r.mode) AS meta,
            CASE WHEN r.name ILIKE $2 ESCAPE '\\' THEN 2 ELSE 1 END AS rank
     FROM automation_rules r WHERE r.world_id = $1
       AND (r.name ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(r.name,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  pushBucket(
    "item",
    `SELECT i.id, i.name AS title, COALESCE(i.public_text, '') AS snippet,
            jsonb_build_object('nodeType', 'item') AS meta,
            CASE WHEN i.name ILIKE $2 ESCAPE '\\' THEN 2 ELSE 1 END AS rank
     FROM items i WHERE i.world_id = $1
       AND (i.name ILIKE $2 ESCAPE '\\' OR COALESCE(i.public_text, '') ILIKE $2 ESCAPE '\\'
            ${tsParamIndex ? `OR to_tsvector('simple', coalesce(i.name,'') || ' ' || coalesce(i.public_text,'')) @@ plainto_tsquery('simple', $${tsParamIndex})` : ""})`
  );

  if (!buckets.length) return { query: term, results: [], total: 0 };

  const hits = [];
  for (const { bucketType, sql } of buckets) {
    try {
      const part = await query(
        `SELECT '${bucketType}' AS result_type, id, title, snippet, meta, rank
         FROM (${sql}) AS bucket_rows
         ORDER BY rank DESC, title
         LIMIT ${bucketLimit}`,
        params
      );
      for (const row of part.rows) {
        hits.push({ ...row, rank: Number(row.rank) || 0 });
      }
    } catch (error) {
      if (error.code !== "42P01" && error.code !== "42703") throw error;
    }
  }

  hits.sort((a, b) => b.rank - a.rank || String(a.title).localeCompare(String(b.title), "zh-CN"));
  const results = hits.slice(0, capped).map((row) =>
    mapRow(row.result_type, {
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      meta: row.meta
    })
  );

  return {
    query: term,
    results,
    total: results.length,
    typeLabels: TYPE_LABELS
  };
}
