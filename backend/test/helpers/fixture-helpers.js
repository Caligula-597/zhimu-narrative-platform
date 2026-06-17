import { query } from "../../src/db.js";
import { fixtureRoomId, fixtureWorldId, playerUserId as defaultPlayerUserId } from "./fixture-ids.js";

export { fixtureWorldId, fixtureRoomId } from "./fixture-ids.js";

/** Active player role in the CI fixture room. */
export async function queryFixtureRoleId(userId = defaultPlayerUserId) {
  const result = await query(
    `SELECT role_slot_id FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [fixtureRoomId, userId]
  );
  if (!result.rowCount) throw new Error("fixture role not found — run npm run bootstrap:local");
  return result.rows[0].role_slot_id;
}
