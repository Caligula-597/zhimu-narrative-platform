import { transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { transactionWithEvents } from "./transaction-events.js";
import { submitMiniGameAnswer } from "./room-mini-games.js";
import { evaluateRoomRulesWithClient } from "./rule-engine.js";
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
  startReadableSection
} from "./repositories/player-progress-repository.js";

export async function submitPlayerMiniGame({ roomId, gameId, actorId, answer }) {
  const result = await transactionWithEvents(async (client, queueEvent) => {
    await configurePlayerProgressTransaction(client);
    const submitted = await submitMiniGameAnswer(client, {
      roomId,
      gameId,
      actorUserId: actorId,
      answer
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
      { currentGame: submitted.game, correct: submitted.correct }
    );
    return submitted;
  });

  if (!result?.found) throwErr("NOT_FOUND", "Mini game not found");
  return {
    ok: true,
    correct: result.correct,
    currentGame: result.game,
    attemptsLeft: result.game?.attemptsLeft ?? null,
    attempts_left: result.game?.attemptsLeft ?? null
  };
}

export async function startPlayerSection({ roomId, roleSlotId, sectionId }) {
  const progress = await startReadableSection({ roomId, roleSlotId, sectionId });
  if (!progress) throwErr("SECTION_LOCKED");
  return {
    ok: true,
    startedAt: progress.started_at,
    completedAt: progress.completed_at
  };
}

export async function completePlayerSection({ roomId, roleSlotId, sectionId, actorId }) {
  return transactionWithEvents(async (client, queueEvent) => {
    await configurePlayerProgressTransaction(client);
    const section = await findReadableSection(client, { roomId, roleSlotId, sectionId });
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
    const sourceAvailable = await isNotebookSourceAvailable(client, {
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
