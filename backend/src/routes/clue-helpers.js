export function formatClueCellLabel(cell) {
  if (!cell.owned && !cell.visible) return "未拥有";
  const parts = [];
  if (cell.owned) parts.push("已拥有");
  if (cell.read) parts.push("已读");
  if (cell.sharedWithRoom) parts.push("已公开");
  if (cell.sharedWithRoles) parts.push("已私享");
  if (!cell.owned && cell.visible) parts.push(cell.read ? "已读(分享)" : "可见");
  return parts.join("·") || "—";
}

export async function fetchPlayerClues(query, roomId, roleSlotId) {
  const owned = await query(
    `SELECT c.id, c.name, c.public_text, co.acquired_at, co.read_at,
            co.shared_with_room, co.shared_with_roles, co.player_note, co.shared_at,
            true AS is_owner, co.role_slot_id AS owner_role_slot_id,
            rs.name AS owner_role_name, u.display_name AS owner_player_name
     FROM clue_ownership co
     JOIN clues c ON c.id = co.clue_id
     JOIN role_slots rs ON rs.id = co.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = co.room_id AND rm.role_slot_id = co.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE co.room_id = $1 AND co.role_slot_id = $2
     ORDER BY co.acquired_at DESC`,
    [roomId, roleSlotId]
  );

  const shared = await query(
    `SELECT c.id, c.name, c.public_text, co.acquired_at, co.shared_at,
            co.player_note, co.shared_with_room, co.shared_with_roles,
            false AS is_owner, co.role_slot_id AS owner_role_slot_id,
            rs.name AS owner_role_name, u.display_name AS owner_player_name,
            CASE WHEN co.shared_with_room THEN 'room' ELSE 'roles' END AS shared_scope,
            EXISTS (
              SELECT 1 FROM clue_read_receipts crr
              WHERE crr.room_id = $1 AND crr.clue_id = c.id AND crr.role_slot_id = $2
            ) AS read_by_me,
            (SELECT crr.read_at FROM clue_read_receipts crr
             WHERE crr.room_id = $1 AND crr.clue_id = c.id AND crr.role_slot_id = $2
             LIMIT 1) AS read_at
     FROM clue_ownership co
     JOIN clues c ON c.id = co.clue_id
     JOIN role_slots rs ON rs.id = co.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = co.room_id AND rm.role_slot_id = co.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE co.room_id = $1
       AND co.role_slot_id <> $2
       AND (
         co.shared_with_room = true
         OR $2::uuid = ANY(COALESCE(co.shared_with_roles, '{}'))
       )
     ORDER BY co.shared_at DESC NULLS LAST, co.acquired_at DESC`,
    [roomId, roleSlotId]
  );

  return { owned: owned.rows, shared: shared.rows };
}

export function buildHostClueMatrix({ clues, players, ownership, receipts }) {
  const ownMap = new Map();
  const ownersByClue = new Map();
  for (const row of ownership) {
    ownMap.set(`${row.clue_id}:${row.role_slot_id}`, row);
    if (!ownersByClue.has(row.clue_id)) ownersByClue.set(row.clue_id, []);
    ownersByClue.get(row.clue_id).push(row);
  }
  const receiptSet = new Set(receipts.map((row) => `${row.clue_id}:${row.role_slot_id}`));

  const sharedClueIds = new Set(
    ownership.filter((row) => row.shared_with_room).map((row) => row.clue_id)
  );

  function visibleViaRoles(clueId, roleSlotId) {
    for (const owner of ownersByClue.get(clueId) || []) {
      const roles = owner.shared_with_roles || [];
      if (Array.isArray(roles) && roles.includes(roleSlotId)) return true;
    }
    return false;
  }

  const cells = {};
  for (const clue of clues) {
    cells[clue.id] = {};
    for (const player of players) {
      const key = `${clue.id}:${player.role_slot_id}`;
      const own = ownMap.get(key);
      const read = own?.read_flag || receiptSet.has(key);
      const roleShared = visibleViaRoles(clue.id, player.role_slot_id);
      const visible = Boolean(own) || sharedClueIds.has(clue.id) || roleShared;
      cells[clue.id][player.role_slot_id] = {
        owned: Boolean(own),
        read,
        sharedWithRoom: Boolean(own?.shared_with_room),
        sharedWithRoles: roleShared && !own,
        visible,
        playerNote: own?.player_note || "",
        hostNote: own?.host_note || ""
      };
    }
  }

  const summaries = clues.map((clue) => {
    const parts = players.map((player) => {
      const cell = cells[clue.id][player.role_slot_id];
      const who = player.player_display_name || player.role_name;
      return `${who}${formatClueCellLabel(cell)}`;
    });
    return { clueId: clue.id, clueName: clue.name, summary: parts.join("，") };
  });

  return { clues, players, cells, summaries };
}

export async function fetchHostClueMatrix(query, roomId) {
  const [clues, players, ownership, receipts] = await Promise.all([
    query(
      `SELECT c.id, c.name FROM clues c
       JOIN rooms r ON r.world_id = c.world_id
       WHERE r.id = $1
       ORDER BY c.name`,
      [roomId]
    ),
    query(
      `SELECT rs.id AS role_slot_id, rs.name AS role_name,
              u.display_name AS player_display_name,
              (rm.user_id IS NOT NULL) AS joined
       FROM role_slots rs
       JOIN rooms r ON r.world_id = rs.world_id
       LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
       LEFT JOIN users u ON u.id = rm.user_id
       WHERE r.id = $1
       ORDER BY rs.sequence`,
      [roomId]
    ),
    query(
      `SELECT co.clue_id, co.role_slot_id, co.read_at IS NOT NULL AS read_flag,
              co.shared_with_room, co.shared_with_roles, co.player_note, co.host_note
       FROM clue_ownership co
       WHERE co.room_id = $1`,
      [roomId]
    ),
    query(
      `SELECT clue_id, role_slot_id, read_at FROM clue_read_receipts WHERE room_id = $1`,
      [roomId]
    )
  ]);

  return buildHostClueMatrix({
    clues: clues.rows,
    players: players.rows,
    ownership: ownership.rows,
    receipts: receipts.rows
  });
}
