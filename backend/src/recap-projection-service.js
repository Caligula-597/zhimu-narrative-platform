export function filterRecapForPlayer(snapshot, roleSlotId) {
  const source = snapshot || {};
  const myPerformance = (source.rolePerformances ?? [])
    .find((row) => row.roleSlotId === roleSlotId) ?? null;
  const personalNotes = (source.notes ?? [])
    .filter((row) => row.roleSlotId === roleSlotId);

  return {
    generatedAt: source.generatedAt,
    description: source.description ?? "",
    room: source.room ? {
      id: source.room.id,
      name: source.room.name,
      status: source.room.status,
      worldId: source.room.worldId,
      worldName: source.room.worldName,
      createdAt: source.room.createdAt,
      firstJoinAt: source.room.firstJoinAt,
      lastActivityAt: source.room.lastActivityAt,
    } : null,
    truth: source.truth ?? null,
    players: source.players ?? [],
    unlockedScenes: source.unlockedScenes ?? [],
    stats: source.stats ?? {},
    readingCompletions: source.readingCompletions ?? [],
    perspective: "postgame",
    highlightRoleSlotId: roleSlotId,
    roleSlotId,
    storyNarrative: source.storyNarrative ?? null,
    rolePerformances: source.rolePerformances ?? [],
    myPerformance,
    personalNotes,
    clueDiscovery: source.clueDiscovery ?? [],
    missedClues: source.undiscoveredClues ?? [],
    keyTimeline: source.keyTimeline ?? [],
    investigations: (source.investigations ?? [])
      .filter((row) => row.roleSlotId === roleSlotId),
    notes: personalNotes,
    miniGames: source.miniGames ?? [],
    privateActions: (source.privateActions ?? [])
      .filter((row) => row.roleSlotId === roleSlotId),
    hostConfirmedEvents: source.hostConfirmedEvents ?? [],
    endingTriggers: source.endingTriggers ?? [],
    conclusion: source.conclusion?.endingId ? { endingId: source.conclusion.endingId } : undefined
  };
}

export function summarizeRecap(snapshot = {}) {
  return {
    joinedPlayers: snapshot.stats?.joinedPlayers ?? 0,
    cluesDiscovered: snapshot.stats?.cluesDiscovered ?? 0,
    cluesUndiscovered: snapshot.stats?.cluesUndiscovered ?? 0,
    investigationsCompleted: snapshot.stats?.investigationsCompleted ?? 0,
    rulesTriggered: snapshot.stats?.rulesTriggered ?? 0,
    notesWritten: snapshot.stats?.notesWritten ?? 0,
    miniGamesCompleted: snapshot.stats?.miniGamesCompleted ?? 0
  };
}
