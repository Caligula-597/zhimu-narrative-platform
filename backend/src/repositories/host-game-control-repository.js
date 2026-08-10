export async function configureHostGameControlTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function lockHostGameControlRoom(client, { roomId, actorId }) {
  const result = await client.query(
    `SELECT room.id
     FROM rooms room
     JOIN room_members member
       ON member.room_id = room.id
      AND member.user_id = $2
      AND member.status = 'active'
      AND member.member_type IN ('host', 'cohost')
     WHERE room.id = $1
     FOR UPDATE OF room, member`,
    [roomId, actorId]
  );
  return result.rowCount > 0;
}

export async function insertMiniGameTimelineLog(client, {
  roomId,
  actorId,
  currentGame,
  completed = false
}) {
  const eventType = completed ? "mini_game_completed" : "mini_game_started";
  const message = completed
    ? `主持人结束小游戏：${currentGame.title}`
    : `主持人启动小游戏：${currentGame.title}`;
  await client.query(
    `INSERT INTO timeline_logs
       (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES (
       $1, $2, 'public', $3, $4,
       CASE WHEN $5
         THEN jsonb_build_object('gameId', $6::text, 'forced', true)
         ELSE jsonb_build_object('gameId', $6::text, 'gameType', $7::text)
       END
     )`,
    [
      roomId,
      actorId,
      eventType,
      message,
      completed,
      currentGame.id,
      currentGame.gameType
    ]
  );
}

export async function insertHostGameControlAudit(client, {
  roomId,
  actorId,
  action,
  targetType,
  targetId,
  metadata = {}
}) {
  await client.query(
    `INSERT INTO host_audit_log
       (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [roomId, actorId, action, targetType, String(targetId), JSON.stringify(metadata)]
  );
}

export async function mergeHostRoomSettings(client, { roomId, settings }) {
  const result = await client.query(
    `UPDATE rooms
     SET settings = (
           COALESCE(settings, '{}'::jsonb)
           || ($2::jsonb - 'runtimePresentation')
         ) || CASE
           WHEN $2::jsonb ? 'runtimePresentation' THEN jsonb_build_object(
             'runtimePresentation',
             COALESCE(settings -> 'runtimePresentation', '{}'::jsonb)
             || ($2::jsonb -> 'runtimePresentation')
           )
           ELSE '{}'::jsonb
         END,
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, settings`,
    [roomId, JSON.stringify(settings)]
  );
  return result.rows[0] ?? null;
}
