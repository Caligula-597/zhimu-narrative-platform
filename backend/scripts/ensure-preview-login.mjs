/**
 * Ensure a local preview account can email/password login.
 * Usage: DATABASE_URL=... node backend/scripts/ensure-preview-login.mjs
 */
import { hashPassword } from "../src/auth.js";
import { pool } from "../src/db.js";

const email = process.env.PREVIEW_LOGIN_EMAIL || "preview@zhimu.local";
const password = process.env.PREVIEW_LOGIN_PASSWORD || "preview123";
const displayName = process.env.PREVIEW_LOGIN_NAME || "本地预览";
const previewUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const qinglouWorldId = process.env.PREVIEW_WORLD_ID || "3af6c758-93fa-4081-84f4-5e8ca907afa3";

const { passwordHash, passwordSalt } = await hashPassword(password);

await pool.query(
  `INSERT INTO users (id, email, display_name, password_hash, password_salt, user_kind, email_verified_at)
   VALUES ($1, $2, $3, $4, $5, 'registered', now())
   ON CONFLICT (email) DO UPDATE SET
     password_hash = EXCLUDED.password_hash,
     password_salt = EXCLUDED.password_salt,
     email_verified_at = COALESCE(users.email_verified_at, now()),
     display_name = EXCLUDED.display_name,
     user_kind = 'registered'`,
  [previewUserId, email, displayName, passwordHash, passwordSalt]
);

const user = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
const userId = user.rows[0].id;

await pool.query(
  `INSERT INTO user_plans (user_id, plan_code) VALUES ($1, 'beta')
   ON CONFLICT (user_id) DO UPDATE SET plan_code = 'beta', updated_at = now()`,
  [userId]
);

await pool.query(
  `UPDATE users
   SET password_hash = $1,
       password_salt = $2,
       email_verified_at = COALESCE(email_verified_at, now())
   WHERE email = 'host@zhimu.local'`,
  [passwordHash, passwordSalt]
);

await pool.query(
  `INSERT INTO world_members (world_id, user_id, role)
   VALUES ($1, $2, 'owner')
   ON CONFLICT (world_id, user_id) DO UPDATE SET role = 'owner'`,
  [qinglouWorldId, userId]
);

console.log(
  JSON.stringify(
    {
      email,
      password,
      displayName,
      userId,
      worldId: qinglouWorldId,
      alsoUnlocked: "host@zhimu.local"
    },
    null,
    2
  )
);

await pool.end();
