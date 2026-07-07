/**
 * Content platform runtime routes — world/room structural models.
 *
 * Scope: world_segments, truth claims, role relationships, room votes/ballots,
 * private actions, role state, creator analytics, quality reports, run reports.
 *
 * Player-facing experience features (tasks, suspicions, testimonies, tags,
 * segment remedies) live in batch-b-routes.js — see docs/CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md.
 */
import { query, transaction } from "../db.js";
import { syncWorldSegmentsFromChapters } from "../world-segments-seed.js";
import { transactionWithEvents } from "../transaction-events.js";
import { requireActor } from "../request-actor.js";
import { requireRoomRole, requireWorldRole, requireWorldReader } from "./route-guards.js";
import { sendErr, throwErr } from "../api-errors.js";
import { normalizeSegmentOperations } from "../segment-contract.js";
import { logHostAction } from "../audit-log.js";
import {
  createPrivateActionSchema,
  createRoleRelationshipSchema,
  createRoomVoteSchema,
  createSegmentSchema,
  createTruthClaimSchema,
  createQualityReportSchema,
  privateActionIdParams,
  roomIdParams,
  segmentIdParams,
  submitVoteBallotSchema,
  updatePrivateActionSchema,
  updateRoleStateSchema,
  updateRoomVoteStatusSchema,
  updateSegmentSchema,
  voteIdParams,
  worldIdParams
} from "./schemas.js";

async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) {
    throwErr("HOST_ROLE_REQUIRED");
  }
  return membership;
}

async function requireRoomPlayer(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  return membership;
}

async function roomWorldId(roomId) {
  const result = await query(`SELECT world_id FROM rooms WHERE id = $1`, [roomId]);
  if (!result.rowCount) throwErr("ROOM_NOT_FOUND");
  return result.rows[0].world_id;
}

async function assertRoleInRoomWorld(runQuery, roomId, roleSlotId) {
  if (!roleSlotId) return;
  const result = await runQuery(
    `SELECT 1 FROM role_slots rs JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id = $2`,
    [roomId, roleSlotId]
  );
  if (!result.rowCount) throwErr("ROLE_SLOT_WORLD_MISMATCH");
}

async function replaceSegmentRefs(client, segmentId, refs = []) {
  await client.query(`DELETE FROM world_segment_refs WHERE segment_id = $1`, [segmentId]);
  for (const ref of refs) {
    await client.query(
      `INSERT INTO world_segment_refs (segment_id, ref_type, ref_id, role_slot_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        segmentId,
        ref.refType,
        ref.refId,
        ref.roleSlotId ?? null,
        JSON.stringify(ref.metadata ?? {})
      ]
    );
  }
}

async function fetchSegmentRefs(client, segmentId) {
  const result = await client.query(
    `SELECT ref_type, ref_id, role_slot_id, metadata
     FROM world_segment_refs WHERE segment_id = $1 ORDER BY created_at`,
    [segmentId]
  );
  return result.rows.map((row) => ({
    refType: row.ref_type,
    refId: row.ref_id,
    roleSlotId: row.role_slot_id,
    metadata: row.metadata ?? {}
  }));
}

function segmentRow(row) {
  return {
    id: row.id,
    worldId: row.world_id,
    segmentKey: row.segment_key,
    title: row.title,
    sequence: row.sequence,
    chapterId: row.chapter_id,
    story: row.story ?? {},
    mechanics: row.mechanics ?? {},
    operations: normalizeSegmentOperations(row.operations ?? {}),
    quality: row.quality ?? {},
    metadata: row.metadata ?? {},
    refs: row.refs ?? []
  };
}

function voteRow(row, { includeResults = false } = {}) {
  const vote = {
    id: row.id,
    roomId: row.room_id,
    segmentId: row.segment_id,
    title: row.title,
    prompt: row.prompt,
    voteType: row.vote_type,
    visibility: row.visibility,
    status: row.status,
    settings: row.settings ?? {},
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    publishedAt: row.published_at,
    options: row.options ?? []
  };
  if (includeResults) vote.ballots = row.ballots ?? [];
  return vote;
}

async function listVotes(runQuery, roomId, { host = false, roleSlotId = null } = {}) {
  const result = await runQuery(
    `SELECT rv.*,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', rvo.id,
              'roleSlotId', rvo.role_slot_id,
              'label', rvo.label,
              'description', rvo.description,
              'sequence', rvo.sequence,
              'metadata', rvo.metadata
            )) FILTER (WHERE rvo.id IS NOT NULL), '[]'::json) AS options,
            COALESCE(json_agg(DISTINCT jsonb_build_object(
              'id', rvb.id,
              'roleSlotId', rvb.role_slot_id,
              'optionId', rvb.option_id,
              'freeText', rvb.free_text,
              'evidence', rvb.evidence,
              'metadata', rvb.metadata,
              'submittedAt', rvb.submitted_at
            )) FILTER (WHERE rvb.id IS NOT NULL), '[]'::json) AS ballots
     FROM room_votes rv
     LEFT JOIN room_vote_options rvo ON rvo.vote_id = rv.id
     LEFT JOIN room_vote_ballots rvb ON rvb.vote_id = rv.id
       AND ($2::boolean OR rv.status = 'published' OR rv.visibility = 'public' OR rvb.role_slot_id = $3)
     WHERE rv.room_id = $1
       AND ($2::boolean OR rv.status IN ('open', 'closed', 'published'))
     GROUP BY rv.id
     ORDER BY rv.created_at DESC`,
    [roomId, host, roleSlotId]
  );
  return result.rows.map((row) => voteRow(row, { includeResults: host || row.status === "published" || row.visibility === "public" }));
}

export async function registerContentPlatformRoutes(app) {
  app.get("/api/worlds/:worldId/segments", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const result = await query(
      `SELECT ws.*,
              COALESCE(json_agg(jsonb_build_object(
                'refType', wsr.ref_type,
                'refId', wsr.ref_id,
                'roleSlotId', wsr.role_slot_id,
                'metadata', wsr.metadata
              ) ORDER BY wsr.created_at) FILTER (WHERE wsr.id IS NOT NULL), '[]'::json) AS refs
       FROM world_segments ws
       LEFT JOIN world_segment_refs wsr ON wsr.segment_id = ws.id
       WHERE ws.world_id = $1
       GROUP BY ws.id
       ORDER BY ws.sequence, ws.created_at`,
      [worldId]
    );
    return { segments: result.rows.map(segmentRow) };
  });

  app.post("/api/worlds/:worldId/segments/sync-from-graph", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const segmentsSynced = await transaction((client) => syncWorldSegmentsFromChapters(client, worldId));
    return { segmentsSynced };
  });

  app.post("/api/worlds/:worldId/segments", { schema: createSegmentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    const created = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO world_segments
          (world_id, segment_key, title, sequence, chapter_id, story, mechanics, operations, quality, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
         RETURNING *`,
        [
          worldId,
          body.segmentKey,
          body.title,
          body.sequence ?? 1,
          body.chapterId ?? null,
          JSON.stringify(body.story ?? {}),
          JSON.stringify(body.mechanics ?? {}),
          JSON.stringify(normalizeSegmentOperations(body.operations ?? {})),
          JSON.stringify(body.quality ?? {}),
          JSON.stringify(body.metadata ?? {})
        ]
      );
      await replaceSegmentRefs(client, result.rows[0].id, body.refs ?? []);
      return result.rows[0];
    });
    return reply.code(201).send({ segment: segmentRow({ ...created, refs: request.body?.refs ?? [] }) });
  });

  app.patch("/api/worlds/:worldId/segments/:segmentId", { schema: updateSegmentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, segmentId } = request.params;
    await requireWorldRole(actorId, worldId);
    const existing = await query(`SELECT * FROM world_segments WHERE id = $1 AND world_id = $2`, [segmentId, worldId]);
    if (!existing.rowCount) return sendErr(reply, "NOT_FOUND", "Segment not found");
    const next = { ...existing.rows[0] };
    const body = request.body ?? {};
    const updated = await transaction(async (client) => {
      const result = await client.query(
        `UPDATE world_segments SET
           segment_key = $3,
           title = $4,
           sequence = $5,
           chapter_id = $6,
           story = $7::jsonb,
           mechanics = $8::jsonb,
           operations = $9::jsonb,
           quality = $10::jsonb,
           metadata = $11::jsonb,
           updated_at = now()
         WHERE id = $1 AND world_id = $2
         RETURNING *`,
        [
          segmentId,
          worldId,
          body.segmentKey ?? next.segment_key,
          body.title ?? next.title,
          body.sequence ?? next.sequence,
          body.chapterId === undefined ? next.chapter_id : body.chapterId,
          JSON.stringify(body.story ?? next.story ?? {}),
          JSON.stringify(body.mechanics ?? next.mechanics ?? {}),
          JSON.stringify(normalizeSegmentOperations(body.operations ?? next.operations ?? {})),
          JSON.stringify(body.quality ?? next.quality ?? {}),
          JSON.stringify(body.metadata ?? next.metadata ?? {})
        ]
      );
      if (body.refs) await replaceSegmentRefs(client, segmentId, body.refs);
      return result.rows[0];
    });
    const refs = body.refs ?? (await fetchSegmentRefs(query, segmentId));
    return { segment: segmentRow({ ...updated, refs }) };
  });

  app.get("/api/worlds/:worldId/truth-claims", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const result = await query(
      `SELECT * FROM world_truth_claims WHERE world_id = $1 ORDER BY created_at DESC`,
      [worldId]
    );
    return { claims: result.rows };
  });

  app.post("/api/worlds/:worldId/truth-claims", { schema: createTruthClaimSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    const result = await query(
      `INSERT INTO world_truth_claims
        (world_id, claim_key, title, claim, reveal_stage, confidence, evidence, contradictions, role_visibility, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
       RETURNING *`,
      [
        worldId,
        body.claimKey ?? null,
        body.title,
        body.claim,
        body.revealStage ?? null,
        body.confidence ?? "canon",
        JSON.stringify(body.evidence ?? []),
        JSON.stringify(body.contradictions ?? []),
        JSON.stringify(body.roleVisibility ?? {}),
        JSON.stringify(body.metadata ?? {})
      ]
    );
    return reply.code(201).send({ claim: result.rows[0] });
  });

  app.get("/api/worlds/:worldId/role-relationships", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const result = await query(
      `SELECT wrr.*, fr.name AS from_role_name, tr.name AS to_role_name
       FROM world_role_relationships wrr
       JOIN role_slots fr ON fr.id = wrr.from_role_slot_id
       JOIN role_slots tr ON tr.id = wrr.to_role_slot_id
       WHERE wrr.world_id = $1
       ORDER BY fr.sequence, tr.sequence, wrr.relation_type`,
      [worldId]
    );
    return { relationships: result.rows };
  });

  app.post("/api/worlds/:worldId/role-relationships", { schema: createRoleRelationshipSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    const roles = await query(
      `SELECT count(*)::int AS count FROM role_slots
       WHERE world_id = $1 AND id = ANY($2::uuid[])`,
      [worldId, [body.fromRoleSlotId, body.toRoleSlotId]]
    );
    if (roles.rows[0].count !== 2) return sendErr(reply, "ROLE_SLOT_WORLD_MISMATCH");
    const result = await query(
      `INSERT INTO world_role_relationships
        (world_id, from_role_slot_id, to_role_slot_id, relation_type, label, strength, visibility, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (world_id, from_role_slot_id, to_role_slot_id, relation_type)
       DO UPDATE SET label = EXCLUDED.label, strength = EXCLUDED.strength,
                     visibility = EXCLUDED.visibility, metadata = EXCLUDED.metadata, updated_at = now()
       RETURNING *`,
      [
        worldId,
        body.fromRoleSlotId,
        body.toRoleSlotId,
        body.relationType ?? "relationship",
        body.label ?? "",
        body.strength ?? null,
        body.visibility ?? "host",
        JSON.stringify(body.metadata ?? {})
      ]
    );
    return reply.code(201).send({ relationship: result.rows[0] });
  });

  app.get("/api/worlds/:worldId/creator-analytics", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const sections = await query(
      `SELECT ss.id, ss.title, rs.name AS role_name,
              count(rp.*)::int AS started_count,
              count(rp.completed_at)::int AS completed_count
       FROM script_sections ss
       JOIN role_slots rs ON rs.id = ss.role_slot_id
       LEFT JOIN rooms r ON r.world_id = rs.world_id
       LEFT JOIN reading_progress rp ON rp.room_id = r.id AND rp.script_section_id = ss.id
       WHERE rs.world_id = $1
       GROUP BY ss.id, ss.title, rs.name
       ORDER BY completed_count ASC, started_count DESC
       LIMIT 50`,
      [worldId]
    );
    const clues = await query(
      `SELECT c.id, c.name,
              count(co.*)::int AS acquired_count,
              count(co.read_at)::int AS read_count
       FROM clues c
       LEFT JOIN rooms r ON r.world_id = c.world_id
       LEFT JOIN clue_ownership co ON co.room_id = r.id AND co.clue_id = c.id
       WHERE c.world_id = $1
       GROUP BY c.id, c.name
       ORDER BY acquired_count ASC, read_count ASC
       LIMIT 50`,
      [worldId]
    );
    const feedback = await query(
      `SELECT f.kind, f.status, count(*)::int AS count
       FROM feedback f
       JOIN rooms r ON r.id = f.room_id
       WHERE r.world_id = $1
       GROUP BY f.kind, f.status
       ORDER BY f.kind, f.status`,
      [worldId]
    );
    const suggestions = [];
    for (const row of sections.rows) {
      if (row.started_count > 0 && row.completed_count === 0) {
        suggestions.push({
          type: "section_completion",
          severity: "medium",
          title: `分幕「${row.title}」有开始但无人完成`,
          detail: "建议检查文本长度、任务提示或解锁顺序。",
          ref: { sectionId: row.id, roleName: row.role_name }
        });
      }
    }
    for (const row of clues.rows) {
      if (row.acquired_count === 0) {
        suggestions.push({
          type: "clue_hit_rate",
          severity: "medium",
          title: `线索「${row.name}」尚无获取记录`,
          detail: "建议检查线索发放规则、调查点或主持手动发放路径。",
          ref: { clueId: row.id }
        });
      }
    }
    return {
      sections: sections.rows,
      clues: clues.rows,
      feedback: feedback.rows,
      suggestions: suggestions.slice(0, 20)
    };
  });

  app.get("/api/worlds/:worldId/quality-reports", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `SELECT id, world_id, source, prompt_version, report, issue_count, score, created_at
       FROM world_quality_reports
       WHERE world_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [worldId]
    );
    return {
      reports: result.rows.map((row) => ({
        id: row.id,
        worldId: row.world_id,
        source: row.source,
        promptVersion: row.prompt_version,
        report: row.report ?? {},
        issueCount: row.issue_count,
        score: row.score,
        createdAt: row.created_at
      }))
    };
  });

  app.post("/api/worlds/:worldId/quality-reports", { schema: createQualityReportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    const issueCount = body.issueCount ?? (Array.isArray(body.report?.issues) ? body.report.issues.length : 0);
    const result = await query(
      `INSERT INTO world_quality_reports
        (world_id, source, prompt_version, report, issue_count, score, created_by_user_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING id, world_id, source, prompt_version, report, issue_count, score, created_at`,
      [
        worldId,
        body.source ?? "manual",
        body.promptVersion ?? null,
        JSON.stringify(body.report ?? {}),
        issueCount,
        body.score ?? null,
        actorId
      ]
    );
    const row = result.rows[0];
    return reply.code(201).send({
      report: {
        id: row.id,
        worldId: row.world_id,
        source: row.source,
        promptVersion: row.prompt_version,
        report: row.report ?? {},
        issueCount: row.issue_count,
        score: row.score,
        createdAt: row.created_at
      }
    });
  });

  app.get("/api/rooms/:roomId/votes", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    const votes = await listVotes(query, roomId, { roleSlotId: membership.role_slot_id });
    return { votes };
  });

  app.post("/api/rooms/:roomId/votes/:voteId/ballots", { schema: submitVoteBallotSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, voteId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    const body = request.body ?? {};
    const vote = await query(`SELECT status FROM room_votes WHERE id = $1 AND room_id = $2`, [voteId, roomId]);
    if (!vote.rowCount) return sendErr(reply, "NOT_FOUND", "Vote not found");
    if (vote.rows[0].status !== "open") return sendErr(reply, "BAD_REQUEST", "Vote is not open");
    if (body.optionId) {
      const option = await query(`SELECT 1 FROM room_vote_options WHERE id = $1 AND vote_id = $2`, [body.optionId, voteId]);
      if (!option.rowCount) return sendErr(reply, "BAD_REQUEST", "Vote option not found");
    }
    await transactionWithEvents(async (client, queueEvent) => {
      await client.query(
        `INSERT INTO room_vote_ballots (vote_id, room_id, role_slot_id, option_id, free_text, evidence, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
         ON CONFLICT (vote_id, role_slot_id)
         DO UPDATE SET option_id = EXCLUDED.option_id, free_text = EXCLUDED.free_text,
                       evidence = EXCLUDED.evidence, metadata = EXCLUDED.metadata, submitted_at = now()`,
        [
          voteId,
          roomId,
          membership.role_slot_id,
          body.optionId ?? null,
          body.freeText ?? "",
          JSON.stringify(body.evidence ?? []),
          JSON.stringify(body.metadata ?? {})
        ]
      );
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'vote_ballot_submitted', '玩家提交了投票/指认', jsonb_build_object('voteId', $3::text, 'roleSlotId', $4::text))`,
        [roomId, actorId, voteId, membership.role_slot_id]
      );
      queueEvent(roomId, "room.vote_updated", { voteId, action: "ballot_submitted" });
    });
    return { ok: true };
  });

  app.get("/api/rooms/:roomId/host/votes", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const votes = await listVotes(query, roomId, { host: true });
    return { votes };
  });

  app.post("/api/rooms/:roomId/host/votes", { schema: createRoomVoteSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    let vote;
    await transactionWithEvents(async (client, queueEvent) => {
      const result = await client.query(
        `INSERT INTO room_votes (room_id, segment_id, created_by_user_id, title, prompt, vote_type, visibility, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING *`,
        [
          roomId,
          body.segmentId ?? null,
          actorId,
          body.title,
          body.prompt ?? "",
          body.voteType ?? "accusation",
          body.visibility ?? "secret_until_published",
          JSON.stringify(body.settings ?? {})
        ]
      );
      vote = result.rows[0];
      const options = body.options?.length
        ? body.options
        : (await client.query(
            `SELECT rs.id AS "roleSlotId", rs.name AS label, rs.sequence
             FROM rooms r JOIN role_slots rs ON rs.world_id = r.world_id
             WHERE r.id = $1 ORDER BY rs.sequence`,
            [roomId]
          )).rows;
      for (const [index, option] of options.entries()) {
        await client.query(
          `INSERT INTO room_vote_options (vote_id, role_slot_id, label, description, sequence, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            vote.id,
            option.roleSlotId ?? null,
            option.label,
            option.description ?? "",
            option.sequence ?? index + 1,
            JSON.stringify(option.metadata ?? {})
          ]
        );
      }
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'public', 'vote_created', $3, jsonb_build_object('voteId', $4::text))`,
        [roomId, actorId, `主持人开启投票/指认：「${body.title}」`, vote.id]
      );
      queueEvent(roomId, "room.vote_created", { voteId: vote.id, title: vote.title, status: vote.status });
    });
    await logHostAction({
      roomId,
      actorUserId: actorId,
      action: "vote_created",
      targetType: "vote",
      targetId: vote.id
    });
    return reply.code(201).send({ vote });
  });

  app.patch("/api/rooms/:roomId/host/votes/:voteId", { schema: updateRoomVoteStatusSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, voteId } = request.params;
    const { status } = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const result = await transactionWithEvents(async (client, queueEvent) => {
      const updated = await client.query(
        `UPDATE room_votes SET status = $3,
             closed_at = CASE WHEN $3 IN ('closed', 'published', 'cancelled') THEN COALESCE(closed_at, now()) ELSE closed_at END,
             published_at = CASE WHEN $3 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
             updated_at = now()
         WHERE id = $1 AND room_id = $2
         RETURNING *`,
        [voteId, roomId, status]
      );
      if (!updated.rowCount) return null;
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'public', 'vote_status_updated', $3, jsonb_build_object('voteId', $4::text, 'status', $5::text))`,
        [roomId, actorId, `投票/指认状态更新为 ${status}`, voteId, status]
      );
      queueEvent(roomId, "room.vote_updated", { voteId, action: status });
      return updated.rows[0];
    });
    if (!result) return sendErr(reply, "NOT_FOUND", "Vote not found");
    return { vote: result };
  });

  app.get("/api/rooms/:roomId/private-actions", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    const result = await query(
      `SELECT * FROM room_private_actions
       WHERE room_id = $1 AND (
         actor_role_slot_id = $2
         OR (visibility = 'actor_target_host' AND target_role_slot_id = $2)
       )
       ORDER BY created_at DESC`,
      [roomId, membership.role_slot_id]
    );
    return { actions: result.rows };
  });

  app.post("/api/rooms/:roomId/private-actions", { schema: createPrivateActionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    const body = request.body ?? {};
    await assertRoleInRoomWorld(query, roomId, body.targetRoleSlotId);
    let action;
    await transactionWithEvents(async (client, queueEvent) => {
      const result = await client.query(
        `INSERT INTO room_private_actions
          (room_id, segment_id, actor_role_slot_id, target_role_slot_id, action_type, title, body, payload, visibility, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
         RETURNING *`,
        [
          roomId,
          body.segmentId ?? null,
          membership.role_slot_id,
          body.targetRoleSlotId ?? null,
          body.actionType,
          body.title,
          body.body ?? "",
          JSON.stringify(body.payload ?? {}),
          body.visibility ?? "actor_host",
          actorId
        ]
      );
      action = result.rows[0];
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'private_action_submitted', $3, jsonb_build_object('actionId', $4::text, 'actionType', $5::text, 'roleSlotId', $6::text))`,
        [roomId, actorId, `玩家提交了秘密行动：「${body.title}」`, action.id, body.actionType, membership.role_slot_id]
      );
      queueEvent(roomId, "room.private_action_submitted", { actionId: action.id, actionType: body.actionType });
    });
    return reply.code(201).send({ action });
  });

  app.get("/api/rooms/:roomId/host/private-actions", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const result = await query(
      `SELECT rpa.*, ars.name AS actor_role_name, trs.name AS target_role_name
       FROM room_private_actions rpa
       JOIN role_slots ars ON ars.id = rpa.actor_role_slot_id
       LEFT JOIN role_slots trs ON trs.id = rpa.target_role_slot_id
       WHERE rpa.room_id = $1
       ORDER BY rpa.created_at DESC`,
      [roomId]
    );
    return { actions: result.rows };
  });

  app.patch("/api/rooms/:roomId/host/private-actions/:actionId", { schema: updatePrivateActionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, actionId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const result = await transactionWithEvents(async (client, queueEvent) => {
      const updated = await client.query(
        `UPDATE room_private_actions
         SET status = $3, host_response = COALESCE($4, host_response),
             resolved_by_user_id = CASE WHEN $3 IN ('accepted', 'rejected', 'resolved', 'cancelled') THEN $5 ELSE resolved_by_user_id END,
             resolved_at = CASE WHEN $3 IN ('accepted', 'rejected', 'resolved', 'cancelled') THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
             updated_at = now()
         WHERE id = $1 AND room_id = $2
         RETURNING *`,
        [actionId, roomId, body.status, body.hostResponse ?? null, actorId]
      );
      if (!updated.rowCount) return null;
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
         VALUES ($1, $2, 'host', 'private_action_status_updated', $3, jsonb_build_object('actionId', $4::text, 'status', $5::text))`,
        [roomId, actorId, `秘密行动状态更新为 ${body.status}`, actionId, body.status]
      );
      queueEvent(roomId, "room.private_action_updated", { actionId, status: body.status });
      return updated.rows[0];
    });
    if (!result) return sendErr(reply, "NOT_FOUND", "Private action not found");
    return { action: result };
  });

  app.patch("/api/rooms/:roomId/host/players/:roleSlotId/state", { schema: updateRoleStateSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    await assertRoleInRoomWorld(query, roomId, roleSlotId);
    const result = await transactionWithEvents(async (client, queueEvent) => {
      const updated = await client.query(
        `INSERT INTO room_role_states (room_id, role_slot_id, faction_key, public_alias, hidden_identity, variables, updated_by_user_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, now())
         ON CONFLICT (room_id, role_slot_id)
         DO UPDATE SET faction_key = COALESCE(EXCLUDED.faction_key, room_role_states.faction_key),
                       public_alias = COALESCE(EXCLUDED.public_alias, room_role_states.public_alias),
                       hidden_identity = COALESCE(EXCLUDED.hidden_identity, room_role_states.hidden_identity),
                       variables = room_role_states.variables || EXCLUDED.variables,
                       updated_by_user_id = EXCLUDED.updated_by_user_id,
                       updated_at = now()
         RETURNING *`,
        [
          roomId,
          roleSlotId,
          body.factionKey ?? null,
          body.publicAlias ?? null,
          body.hiddenIdentity ?? null,
          JSON.stringify(body.variables ?? {}),
          actorId
        ]
      );
      queueEvent(roomId, "room.role_state_updated", { roleSlotId });
      return updated.rows[0];
    });
    await logHostAction({
      roomId,
      actorUserId: actorId,
      action: "role_state_updated",
      targetType: "role_slot",
      targetId: roleSlotId,
      metadata: { factionKey: body.factionKey ?? null }
    });
    return { state: result };
  });

  app.get("/api/rooms/:roomId/run-report", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const worldId = await roomWorldId(roomId);
    const reading = await query(
      `SELECT ss.id, ss.title, count(rp.*)::int AS started_count, count(rp.completed_at)::int AS completed_count
       FROM script_sections ss
       JOIN role_slots rs ON rs.id = ss.role_slot_id
       LEFT JOIN reading_progress rp ON rp.script_section_id = ss.id AND rp.room_id = $1
       WHERE rs.world_id = $2
       GROUP BY ss.id, ss.title
       ORDER BY completed_count ASC, started_count DESC`,
      [roomId, worldId]
    );
    const clues = await query(
      `SELECT c.id, c.name, count(co.*)::int AS acquired_count, count(co.read_at)::int AS read_count
       FROM clues c
       LEFT JOIN clue_ownership co ON co.clue_id = c.id AND co.room_id = $1
       WHERE c.world_id = $2
       GROUP BY c.id, c.name
       ORDER BY acquired_count ASC, read_count ASC`,
      [roomId, worldId]
    );
    const votes = await listVotes(query, roomId, { host: true });
    const suggestions = [];
    for (const clue of clues.rows) {
      if (clue.acquired_count === 0) {
        suggestions.push({
          type: "clue_missing",
          title: `线索「${clue.name}」本场未被获取`,
          detail: "复盘时建议检查发放条件，或在下一版前移提示。"
        });
      }
    }
    return { reading: reading.rows, clues: clues.rows, votes, suggestions };
  });
}
