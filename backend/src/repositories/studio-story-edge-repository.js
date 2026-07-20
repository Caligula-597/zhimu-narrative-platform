export async function insertStoryEdge(client, {
  worldId,
  fromType,
  fromId,
  toType,
  toId,
  relationType,
  label
}) {
  const result = await client.query(
    `INSERT INTO story_graph_edges
      (world_id, from_type, from_id, to_type, to_id, relation_type, label)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [worldId, fromType, fromId, toType, toId, relationType, label]
  );
  return result.rows[0];
}
