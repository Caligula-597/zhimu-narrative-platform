const DEFAULT_CHUNK_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 160;

export function splitKnowledgeText(text, { maxChars = DEFAULT_CHUNK_CHARS, overlapChars = DEFAULT_OVERLAP_CHARS } = {}) {
  const clean = String(text ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  function pushCurrent() {
    const body = current.trim();
    if (body) chunks.push(body);
    current = "";
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      pushCurrent();
      for (let start = 0; start < paragraph.length; start += Math.max(1, maxChars - overlapChars)) {
        chunks.push(paragraph.slice(start, start + maxChars).trim());
      }
      continue;
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxChars) {
      pushCurrent();
      current = paragraph;
    } else {
      current = next;
    }
  }
  pushCurrent();

  return chunks.filter(Boolean);
}

export async function replaceKnowledgeChunks(client, {
  worldId,
  sourceType,
  sourceId = null,
  roleSlotId = null,
  visibility = "author",
  title = "",
  text,
  metadata = {}
}) {
  await client.query(
    `DELETE FROM knowledge_chunks
     WHERE world_id = $1
       AND source_type = $2
       AND source_id IS NOT DISTINCT FROM $3::uuid
       AND role_slot_id IS NOT DISTINCT FROM $4::uuid`,
    [worldId, sourceType, sourceId, roleSlotId]
  );

  const chunks = splitKnowledgeText(text);
  const inserted = [];
  for (const [index, body] of chunks.entries()) {
    const result = await client.query(
      `INSERT INTO knowledge_chunks
        (world_id, source_type, source_id, role_slot_id, visibility, chunk_index, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id, chunk_index`,
      [worldId, sourceType, sourceId, roleSlotId, visibility, index, title, body, JSON.stringify(metadata)]
    );
    inserted.push(result.rows[0]);
  }
  return { chunkCount: inserted.length, chunks: inserted };
}

export async function searchKnowledgeChunks(client, {
  worldId,
  queryText,
  roleSlotId = null,
  includeAuthorOnly = false,
  limit = 8
}) {
  const term = String(queryText ?? "").trim();
  if (!term) return [];
  const capped = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const like = `%${term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const result = await client.query(
    `SELECT id, source_type, source_id, role_slot_id, visibility, chunk_index, title,
            left(body, 1200) AS body,
            CASE WHEN title ILIKE $2 ESCAPE '\\' THEN 3 ELSE 0 END
              + CASE WHEN body ILIKE $2 ESCAPE '\\' THEN 2 ELSE 0 END AS rank
     FROM knowledge_chunks
     WHERE world_id = $1
       AND (title ILIKE $2 ESCAPE '\\' OR body ILIKE $2 ESCAPE '\\'
            OR to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,'')) @@ plainto_tsquery('simple', $3))
       AND (
         $4::boolean = true
         OR visibility = 'public'
         OR (visibility = 'role' AND role_slot_id IS NOT DISTINCT FROM $5::uuid)
       )
     ORDER BY rank DESC, updated_at DESC
     LIMIT $6`,
    [worldId, like, term, Boolean(includeAuthorOnly), roleSlotId, capped]
  );
  return result.rows;
}
