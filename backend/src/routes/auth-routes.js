import { query } from "../db.js";
import { createSession, deleteSession, hashPassword, verifyPassword } from "../auth.js";
import { sendErr, throwErr } from "../api-errors.js";
import { bearerToken, requireActor } from "../request-actor.js";

const authBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 320 },
    password: { type: "string", minLength: 8, maxLength: 128 }
  }
};

async function ensureStorageQuota(userId) {
  await query(
    `INSERT INTO storage_quotas (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = storage_quotas.updated_at`,
    [userId]
  );
}

export async function registerAuthRoutes(app) {
  app.post("/api/auth/register", {
    schema: {
      body: {
        ...authBodySchema,
        required: ["email", "displayName", "password"],
        properties: {
          ...authBodySchema.properties,
          displayName: { type: "string", minLength: 2, maxLength: 40 }
        }
      }
    }
  }, async (request, reply) => {
    const email = request.body.email.trim().toLowerCase();
    const displayName = request.body.displayName.trim();
    const password = request.body.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendErr(reply, "EMAIL_INVALID");
    if (displayName.length < 2) return sendErr(reply, "DISPLAY_NAME_INVALID");
    const { passwordHash, passwordSalt } = await hashPassword(password);
    const created = await query(
      `INSERT INTO users (email, display_name, password_hash, password_salt)
       VALUES ($1,$2,$3,$4) RETURNING id, email, display_name`,
      [email, displayName, passwordHash, passwordSalt]
    ).catch((error) => {
      if (error.code === "23505") throwErr("EMAIL_ALREADY_REGISTERED");
      throw error;
    });
    await ensureStorageQuota(created.rows[0].id);
    const session = await createSession(created.rows[0].id);
    return reply.code(201).send({ user: created.rows[0], ...session });
  });

  app.post("/api/auth/login", { schema: { body: authBodySchema } }, async (request, reply) => {
    const email = request.body.email.trim().toLowerCase();
    const password = request.body.password;
    const result = await query(`SELECT id, email, display_name, password_hash, password_salt FROM users WHERE email = $1`, [email]);
    if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash, result.rows[0].password_salt))) {
      return sendErr(reply, "INVALID_CREDENTIALS");
    }
    const session = await createSession(result.rows[0].id);
    return { user: { id: result.rows[0].id, email: result.rows[0].email, display_name: result.rows[0].display_name }, ...session };
  });

  app.get("/api/auth/me", async (request) => {
    const actorId = requireActor(request);
    const result = await query(`SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = $1`, [actorId]);
    if (!result.rowCount) throwErr("USER_NOT_FOUND");
    return result.rows[0];
  });

  app.post("/api/auth/logout", async (request) => {
    await deleteSession(bearerToken(request));
    return { ok: true };
  });
}
