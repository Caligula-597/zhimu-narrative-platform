import { query } from "../db.js";

export async function findBillingCheckoutAccount(userId) {
  const result = await query(
    `SELECT email, user_kind FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}
