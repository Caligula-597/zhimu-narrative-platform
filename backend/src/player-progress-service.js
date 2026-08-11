import { transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { transactionWithEvents } from "./transaction-events.js";
import { submitMiniGameAnswer } from "./room-mini-games.js";
import { evaluateRoomRulesWithClient } from "./rule-engine.js";
import { loadRuntimeContentProvider } from "./runtime-content-provider.js";
import {
  completeReadingProgress,
  configurePlayerProgressTransaction,
  createNotebookEntry,
  deleteNotebookEntry,
  findReadableSection,
  insertMiniGameTimeline,
  insertReadingCompletedTimeline,
  isNotebookSourceAvailable,
  listPlayerTimeline,
  startReadingProgress
} from "./repositories/player-progress-repository.js";

function sectionIsPublished(section, roomStatus) {
  return section.publication_status === "published"
    || (roomStatus === "testing" && section.publication_status === "testing");
}

async function findRuntimeReadableSection(client, { roomId, roleSlotId, sectionId }) {
  const runQuery = client.query.bind(client);
  const provider = await loadRuntimeContentProvider(roomId, {
    runQuery,
    includeLiveSnapshot: false
  });
  if (!provider) return null;
  if (!provider.isFrozen) {
    return findReadableSection(client, { roomId, roleSlotId, sectionId });
  }

  const section = provider.find("sections", sectionId);
  if (
    !section
    || String(section.role_slot_id) !== String(roleSlotId)
    || !sectionIsPublished(section, provider.room.status)
  ) {
    return null;
  }
  const roleSections = provider.collection("sections")
    .filter((candidate) => String(candidate.role_slot_id) === String(roleSlotId))
    .filter((candidate) => sectionIsPublished(candidate, provider.room.status))
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  if (section.sequence === roleSections[0]?.sequence) return section;
  const unlocked = await client.query(
    `SELECT 1
     FROM room_content_unlocks
     WHERE room_id = $1
       AND content_type = 'script_section'
       AND content_id = $2`,
    [roomId, sectionId]
  );
  return unlocked.rowCount ? section : null;
}

export async function submitPlayerMiniGame({ roomId, gameId, actorId, answer, expectedRevision }) {
  const result = await transactionWithEvents(async (client, queueEvent) => {
    await configurePlayerProgressTransaction(client);
    const submitted = await submitMiniGameAnswer(client, {
      roomId,
      gameId,
      actorUserId: actorId,
      answer,
      expectedRevision
    });
    if (!submitted.found) return submitted;

    await insertMiniGameTimeline(client, {
      roomId,
      actorId,
      gameId,
      correct: submitted.correct,
      completed: submitted.completed
    });
    queueEvent(
      roomId,
      submitted.completed ? "room.game_completed" : "room.game_updated",
      { currentGame: submitted.game, correct: submitted.correct, timedOut: submitted.timedOut }
    );
    return submitted;
  });

  if (!result?.found) throwErr("NOT_FOUND", "Mini game not found");
  return {
    ok: true,
    correct: result.correct,
    currentGame: result.game,
    attemptsLeft: result.game?.attemptsLeft ?? null,
    attempts_left: result.game?.attemptsLeft ?? null,
    timedOut: Boolean(result.timedOut)
  };
}

export async function startPlayerSection({ roomId, roleSlotId, sectionId }) {
  return transaction(async (client) => {
    await configurePlayerProgressTransaction(client);
    const section = await findRuntimeReadableSection(client, {
      roomId,
      roleSlotId,
      sectionId
    });
    if (!section) throwErr("SECTION_LOCKED");
    const progress = await startReadingProgress(client, { roomId, roleSlotId, sectionId });
    return {
      ok: true,
      startedAt: progress.started_at,
      completedAt: progress.completed_at
    };
  });
}

export async function completePlayerSection({ roomId, roleSlotId, sectionId, actorId }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configurePlayerProgressTransaction(client);
    const section = await findRuntimeReadableSection(client, { roomId, roleSlotId, sectionId });
    if (!section) throwErr("SECTION_LOCKED");

    const progress = await completeReadingProgress(client, { roomId, roleSlotId, sectionId });
    if (!progress) throwErr("SECTION_LOCKED");
    if (!progress.newlyCompleted) return { ok: true, executedRules: [] };

    await insertReadingCompletedTimeline(client, { roomId, actorId, sectionId });
    queueEvent(roomId, "room.section_completed", { sectionId, roleSlotId });
    const executedRules = await evaluateRoomRulesWithClient(client, queueEvent, roomId);
    return { ok: true, executedRules };
  });
}

export async function addPlayerNotebookEntry({
  roomId,
  roleSlotId,
  actorId,
  sourceType,
  sourceId,
  title,
  body
}) {
  return transaction(async (client) => {
    await configurePlayerProgressTransaction(client);
    const sourceAvailable = sourceType === "script_section"
      ? Boolean(await findRuntimeReadableSection(client, {
          roomId,
          roleSlotId,
          sectionId: sourceId
        }))
      : await isNotebookSourceAvailable(client, {
          roomId,
          roleSlotId,
          sourceType,
          sourceId
        });
    if (!sourceAvailable) throwErr("NOTEBOOK_SOURCE_INVALID");
    return createNotebookEntry(client, {
      roomId,
      roleSlotId,
      actorId,
      sourceType,
      sourceId,
      title,
      body
    });
  });
}

export async function removePlayerNotebookEntry({ roomId, roleSlotId, entryId }) {
  const deleted = await deleteNotebookEntry({ roomId, roleSlotId, entryId });
  if (!deleted) throwErr("NOTEBOOK_ENTRY_NOT_FOUND");
  return { ok: true };
}

export async function getPlayerTimeline({ roomId, roleSlotId, actorId }) {
  const items = await listPlayerTimeline({ roomId, actorId });
  return { roomId, roleSlotId, items };
}
