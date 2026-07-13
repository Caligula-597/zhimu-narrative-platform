export function filterRecapForPlayer(snapshot, roleSlotId) {
  const myPerformance = (snapshot.rolePerformances ?? [])
    .find((row) => row.roleSlotId === roleSlotId) ?? null;
  const personalNotes = (snapshot.notes ?? [])
    .filter((row) => row.roleSlotId === roleSlotId);

  return {
    ...snapshot,
    perspective: "postgame",
    highlightRoleSlotId: roleSlotId,
    roleSlotId,
    storyNarrative: snapshot.storyNarrative ?? null,
    rolePerformances: snapshot.rolePerformances ?? [],
    myPerformance,
    personalNotes,
    clueDiscovery: snapshot.clueDiscovery ?? [],
    missedClues: snapshot.undiscoveredClues ?? [],
    keyTimeline: snapshot.keyTimeline ?? [],
    investigations: (snapshot.investigations ?? [])
      .filter((row) => row.roleSlotId === roleSlotId),
    notes: personalNotes,
    hostConfirmedEvents: snapshot.hostConfirmedEvents ?? [],
    endingTriggers: snapshot.endingTriggers ?? []
  };
}

export function summarizeRecap(snapshot = {}) {
  return {
    joinedPlayers: snapshot.stats?.joinedPlayers ?? 0,
    cluesDiscovered: snapshot.stats?.cluesDiscovered ?? 0,
    cluesUndiscovered: snapshot.stats?.cluesUndiscovered ?? 0,
    investigationsCompleted: snapshot.stats?.investigationsCompleted ?? 0,
    rulesTriggered: snapshot.stats?.rulesTriggered ?? 0,
    notesWritten: snapshot.stats?.notesWritten ?? 0
  };
}
