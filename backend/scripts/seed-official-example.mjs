/** Seed catalog-public official example world for local dev / E2E / CI. */
import { FIXTURE } from "./fixture-constants.mjs";

export const OFFICIAL_EXAMPLE_FIXTURE = {
  worldId: "33333333-3333-4333-8444-555555550003",
  worldName: "官方示例 · 小体验",
  summary: "内测与 CI 用的公开示例剧本：阅读、探索与线索流程。"
};

export async function seedOfficialExampleWorld(client) {
  const { worldId, worldName, summary } = OFFICIAL_EXAMPLE_FIXTURE;
  await client.query(
    `INSERT INTO worlds (id, owner_user_id, name, summary, status, catalog_public, catalog_review_status)
     VALUES ($1, $2, $3, $4, 'testing', true, 'approved')
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       summary = EXCLUDED.summary,
       status = 'testing',
       catalog_public = true,
       catalog_review_status = 'approved'`,
    [worldId, FIXTURE.hostUserId, worldName, summary]
  );
  await client.query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')
     ON CONFLICT (world_id, user_id) DO NOTHING`,
    [worldId, FIXTURE.hostUserId]
  );

  const chapter = await client.query(
    `INSERT INTO chapters (world_id, title, sequence, publication_status)
     VALUES ($1, '序章', 1, 'testing')
     ON CONFLICT (world_id, sequence) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [worldId]
  );
  const chapterId = chapter.rows[0].id;

  for (const [sequence, name] of [
    [1, "体验角色 A"],
    [2, "体验角色 B"]
  ]) {
    const role = await client.query(
      `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (world_id, sequence) DO UPDATE
       SET name = EXCLUDED.name, public_profile = EXCLUDED.public_profile
       RETURNING id`,
      [worldId, name, `${name}的公开人设。`, `${name}的私密背景。`, sequence]
    );
    const script = await client.query(
      `INSERT INTO character_scripts (role_slot_id, title)
       SELECT $1, $2
       WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
       RETURNING id`,
      [role.rows[0].id, `${name} 剧本`]
    );
    const scriptId = script.rowCount
      ? script.rows[0].id
      : (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1`, [role.rows[0].id])).rows[0].id;
    await client.query(
      `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
       SELECT $1, $2, $3, '第一幕', $4, 1, 'testing'
       WHERE NOT EXISTS (
         SELECT 1 FROM script_sections WHERE role_slot_id = $2 AND sequence = 1
       )`,
      [scriptId, role.rows[0].id, chapterId, `${name}：欢迎来到织幕官方示例。读完后点「标记阅读完成」。`]
    );
  }

  return worldId;
}
