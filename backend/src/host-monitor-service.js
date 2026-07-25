import { query } from "./db.js";
import { updateClueOwnershipHostNote } from "./repositories/host-monitor-repository.js";
import { buildHostClueMatrix, fetchHostClueMatrix } from "./routes/clue-helpers.js";
import { fetchHostPlayers } from "./routes/host-helpers.js";
import { assertRoleInRoomWorld } from "./routes/host-route-guards.js";
import { buildRuntimeKnowledgeProjection } from "./runtime-knowledge-service.js";
import { loadRuntimeContentProvider } from "./runtime-content-provider.js";
import { assessPlayerProgress } from "./player-progress-assessment.js";
import {
  loadRuntimeHostClueFacts,
  loadRuntimeHostPlayerFacts
} from "./repositories/runtime-host-repository.js";

function sectionIsPublished(section, roomStatus) {
  return section.publication_status === "published"
    || (roomStatus === "testing" && section.publication_status === "testing");
}

export async function getHostPlayers(roomId) {
  const provider = await loadRuntimeContentProvider(roomId, {
    includeLiveSnapshot: false
  });
  if (!provider?.isFrozen) return fetchHostPlayers(query, roomId);
  const roles = [...provider.collection("roles")]
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  const runtimePlayers = await loadRuntimeHostPlayerFacts(
    roomId,
    roles.map((role) => role.id)
  );
  const playerByRole = new Map(
    runtimePlayers.map((player) => [String(player.role_slot_id), player])
  );
  return roles
    .map((role) => {
      const player = playerByRole.get(String(role.id)) ?? {
        role_slot_id: role.id,
        joined: false,
        room_status: provider.room.status
      };
      const sections = provider.collection("sections")
        .filter((section) => String(section.role_slot_id) === String(role.id))
        .sort((left, right) => Number(left.sequence) - Number(right.sequence));
      const published = sections.filter((section) => sectionIsPublished(section, provider.room.status));
      const firstSequence = published[0]?.sequence;
      const roleProgress = (player.progress ?? [])
        .filter((entry) => provider.find("sections", entry.script_section_id));
      const unlocked = new Set((player.unlocked_section_ids ?? []).map(String));
      const latestCompleted = roleProgress
        .filter((entry) => entry.completed_at)
        .sort((left, right) => new Date(right.completed_at) - new Date(left.completed_at))[0];
      const projected = {
        ...player,
        role_name: role.name,
        public_profile: role.public_profile,
        private_profile: role.private_profile,
        join_label: player.joined ? "已加入" : "席位空置",
        total_sections: sections.length,
        available_sections: published.filter(
          (section) => section.sequence === firstSequence || unlocked.has(String(section.id))
        ).length,
        started_sections: roleProgress.filter((entry) => entry.started_at).length,
        completed_sections: roleProgress.filter((entry) => entry.completed_at).length,
        last_completed_section_title: latestCompleted
          ? provider.find("sections", latestCompleted.script_section_id)?.title ?? null
          : null
      };
      const assessment = assessPlayerProgress(projected);
      delete projected.progress;
      delete projected.unlocked_section_ids;
      return {
        ...projected,
        maybe_stuck: assessment.maybeStuck,
        stuck_code: assessment.code,
        stuck_label: assessment.label,
        stuck_detail: assessment.detail,
        recommended_action: assessment.recommendedAction,
        suggested_nudge: assessment.suggestedNudge || null
      };
    });
}

export async function getHostClueMatrix(roomId) {
  const provider = await loadRuntimeContentProvider(roomId, {
    includeLiveSnapshot: false
  });
  if (!provider?.isFrozen) return fetchHostClueMatrix(query, roomId);
  const facts = await loadRuntimeHostClueFacts(roomId);
  const memberByRole = new Map(
    facts.members.map((member) => [String(member.role_slot_id), member])
  );
  const players = [...provider.collection("roles")]
    .sort((left, right) => Number(left.sequence) - Number(right.sequence))
    .map((role) => ({
      role_slot_id: role.id,
      role_name: role.name,
      player_display_name: memberByRole.get(String(role.id))?.player_display_name ?? null,
      joined: Boolean(memberByRole.get(String(role.id))?.joined)
    }));
  const clues = provider.collection("clues")
    .map((clue) => ({ id: clue.id, name: clue.name }));
  return buildHostClueMatrix({
    clues,
    players,
    ownership: facts.ownership.filter((entry) => provider.find("clues", entry.clue_id)),
    receipts: facts.receipts.filter((entry) => provider.find("clues", entry.clue_id))
  });
}

export async function setHostClueNote({ roomId, roleSlotId, clueId, hostNote }) {
  await assertRoleInRoomWorld(query, roomId, roleSlotId);
  return updateClueOwnershipHostNote(query, { roomId, roleSlotId, clueId, hostNote });
}

function knowledgeToLegacyHostDetail(knowledge) {
  if (!knowledge) return null;
  return {
    role: knowledge.role ? {
      id: knowledge.role.id,
      name: knowledge.role.name,
      public_profile: knowledge.role.publicProfile,
      private_profile: knowledge.role.privateProfile,
      player_display_name: knowledge.role.playerDisplayName,
      joined_at: knowledge.role.joinedAt,
      host_notes: knowledge.playerState?.variables?.hostNotes ?? ""
    } : null,
    sections: knowledge.sections.map((section) => ({
      id: section.id,
      title: section.title,
      sequence: section.sequence,
      publication_status: section.publicationStatus,
      started_at: section.startedAt,
      completed_at: section.completedAt,
      completed: section.completed,
      unlocked: section.unlocked
    })),
    clues: knowledge.clues.map((clue) => ({
      id: clue.id,
      name: clue.name,
      public_text: clue.publicText,
      acquired_at: clue.acquiredAt,
      read_at: clue.readAt,
      shared_with_room: clue.access === "shared_room",
      player_note: clue.playerNote,
      host_note: clue.hostNote,
      shared_at: clue.sharedAt
    })),
    notes: knowledge.notes.map((note) => ({
      id: note.id,
      title: note.title,
      body: note.body,
      source_type: note.sourceType,
      created_at: note.createdAt
    })),
    investigations: knowledge.investigations.map((item) => ({
      point_name: item.pointName,
      scene_name: item.sceneName,
      investigated_at: item.investigatedAt
    })),
    recentLogs: (knowledge.recentLogs ?? []).map((log) => ({
      event_type: log.event_type,
      message: log.message,
      metadata: log.metadata,
      created_at: log.created_at
    })),
    unlockedScenes: knowledge.scenes,
    knowledge
  };
}

export async function getHostPlayerDetail(roomId, roleSlotId) {
  const knowledge = await buildRuntimeKnowledgeProjection({
    roomId,
    roleSlotId,
    audience: "host"
  });
  return knowledgeToLegacyHostDetail(knowledge);
}

export async function getHostProgress(roomId) {
  const players = await getHostPlayers(roomId);
  return players.map((player) => ({
    role_slot_id: player.role_slot_id,
    name: player.role_name,
    total_sections: player.total_sections,
    completed_sections: player.completed_sections,
    current_scene_id: player.current_scene_id,
    updated_at: player.last_activity_at
  }));
}
