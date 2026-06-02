import "dotenv/config";
import { query, pool } from "../src/db.js";

const worldId = "08646748-e4ae-446a-a5e7-ce59ca23ffc3";
const roomId = "a65f94eb-a987-463c-bb81-aa482367e54a";
const participants = [
  { email: "demo.lin-zhu@example.invalid", displayName: "林烛", roleName: "林烛 · 医生", sequence: 2, publicProfile: "在雾港经营诊所的医生。" },
  { email: "demo.zhou-lan@example.invalid", displayName: "周岚", roleName: "周岚 · 巡警", sequence: 3, publicProfile: "负责旧港片区的巡警。" },
  { email: "demo.wen-che@example.invalid", displayName: "闻彻", roleName: "闻彻 · 商人", sequence: 4, publicProfile: "熟悉港口货运网络的商人。" }
];

for (const participant of participants) {
  const user = await query(
    `INSERT INTO users (email, display_name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
     RETURNING id`,
    [participant.email, participant.displayName]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, public_profile, sequence)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (world_id, sequence) DO UPDATE
     SET name = EXCLUDED.name, public_profile = EXCLUDED.public_profile
     RETURNING id`,
    [worldId, participant.roleName, participant.publicProfile, participant.sequence]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
     VALUES ($1, $2, 'player', $3, 'active')
     ON CONFLICT (room_id, user_id) DO UPDATE
     SET role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
    [roomId, user.rows[0].id, role.rows[0].id]
  );
}

console.log("Seeded demo voice participants: 林烛, 周岚, 闻彻");
await pool.end();
