/** Player-home application service. Repositories own SQL; this layer owns composition. */
import {
  loadAuthorizedPlayerHomeContent,
  loadPlayerHomeContent
} from "../repositories/player-home-content-repository.js";
import { loadPlayerHomeSocial } from "../repositories/player-home-social-repository.js";
import { loadPlayerHomeSession } from "../repositories/player-home-session-repository.js";
import { loadRuntimeContentProvider } from "../runtime-content-provider.js";
import { buildRuntimeKnowledgeProjection } from "../runtime-knowledge-service.js";
import { buildRuntimeCurrentState } from "../runtime-current-state-service.js";
import { loadPlayerHomeTasks, resolvePlayerHomeProgress } from "../services/player-home-progress-service.js";

const EMPTY_SOCIAL = Object.freeze({
  notes: [], clues: [], sharedClues: [], roomMembers: [],
  suspicions: [], testimonies: [], privateActions: []
});
const EMPTY_SESSION = Object.freeze({
  voiceRooms: [], inventory: [], hostConfirm: null, currentGame: null,
  activeVotes: [], roleState: null,
  voiceRoster: [],
  voicePolicy: {
    mainRoomId: null,
    privateRoomsEnabled: false,
    startedAt: null,
    roomStatus: null
  }
});

function projectFrozenClue(provider, clue) {
  const authored = provider.find("clues", clue.id);
  if (!authored) return null;
  const ownerRole = provider.find("roles", clue.owner_role_slot_id);
  return {
    ...clue,
    name: authored.name,
    public_text: authored.public_text ?? "",
    segment_key: authored.metadata?.segmentKey ?? authored.metadata?.segment_key ?? null,
    location_id: authored.metadata?.locationId ?? authored.metadata?.location_id ?? null,
    owner_role_name: ownerRole?.name ?? clue.owner_role_name
  };
}

function projectFrozenPlayerSocial(provider, social) {
  return {
    ...social,
    clues: social.clues.map((clue) => projectFrozenClue(provider, clue)).filter(Boolean),
    sharedClues: social.sharedClues
      .map((clue) => projectFrozenClue(provider, clue))
      .filter(Boolean),
    roomMembers: social.roomMembers
      .map((member) => {
        const role = provider.find("roles", member.role_slot_id);
        return role ? { ...member, role_name: role.name } : null;
      })
      .filter(Boolean),
    suspicions: social.suspicions
      .map((suspicion) => {
        const role = provider.find("roles", suspicion.target_role_slot_id);
        return role ? { ...suspicion, target_role_name: role.name } : null;
      })
      .filter(Boolean)
  };
}

function projectFrozenPlayerSession(provider, session) {
  return {
    ...session,
    voiceRoster: (session.voiceRoster || []).map((member) => {
      if (!member.role_slot_id) return member;
      const role = provider.find("roles", member.role_slot_id);
      return role ? { ...member, role_name: role.name } : member;
    }),
    inventory: session.inventory
      .map((entry) => {
        const item = provider.find("items", entry.item_id);
        if (!item) return null;
        return {
          ...entry,
          name: item.name,
          public_text: item.public_text ?? "",
          metadata: item.metadata ?? {}
        };
      })
      .filter(Boolean)
  };
}

export async function loadPlayerHomeCore({ roomId, roleSlotId }) {
  const content = await loadPlayerHomeContent({ roomId, roleSlotId });
  const progress = await resolvePlayerHomeProgress({
    roomId,
    roleSlotId,
    sections: content.sections,
    segments: content.segments,
    includeTasks: false,
    provider: content.runtimeProvider
  });
  return {
    room: content.room,
    role: content.role,
    sections: progress.sections,
    ...EMPTY_SOCIAL,
    ...EMPTY_SESSION,
    currentActKey: progress.currentActKey,
    tasks: progress.tasks,
    segments: content.segments,
    communicationTemplates: content.communicationTemplates
  };
}

export async function loadAuthorizedPlayerHomeCore({ roomId, actorId }) {
  const content = await loadAuthorizedPlayerHomeContent({ roomId, actorId });
  if (!content) return null;
  const progress = await resolvePlayerHomeProgress({
    roomId,
    roleSlotId: content.roleSlotId,
    sections: content.sections,
    segments: content.segments,
    includeTasks: false,
    provider: content.runtimeProvider
  });
  return {
    room: content.room,
    role: content.role,
    sections: progress.sections,
    ...EMPTY_SOCIAL,
    ...EMPTY_SESSION,
    currentActKey: progress.currentActKey,
    tasks: progress.tasks,
    segments: content.segments,
    communicationTemplates: content.communicationTemplates,
    contentRevision: content.contentRevision
  };
}

export async function loadPlayerHomeSupplemental({ roomId, roleSlotId, actorId, currentActKey }) {
  const provider = await loadRuntimeContentProvider(roomId, {
    includeLiveSnapshot: true
  });
  if (!provider) return { ...EMPTY_SOCIAL, ...EMPTY_SESSION, tasks: [] };
  const [social, session, tasks, knowledge, currentState] = await Promise.all([
    loadPlayerHomeSocial({ roomId, roleSlotId }),
    loadPlayerHomeSession({ roomId, roleSlotId, actorId }),
    loadPlayerHomeTasks({ roomId, roleSlotId, currentActKey, provider }),
    buildRuntimeKnowledgeProjection({
      roomId,
      roleSlotId,
      audience: "player",
      provider
    }),
    buildRuntimeCurrentState({
      roomId,
      roleSlotId,
      audience: "player",
      provider
    })
  ]);
  if (!provider.isFrozen) {
    return { ...social, ...session, tasks, knowledge, currentState };
  }
  return {
    ...projectFrozenPlayerSocial(provider, social),
    ...projectFrozenPlayerSession(provider, session),
    tasks,
    knowledge,
    currentState
  };
}

export async function loadPlayerHomePayload({ roomId, roleSlotId, actorId }) {
  const [content, social, session] = await Promise.all([
    loadPlayerHomeContent({ roomId, roleSlotId }),
    loadPlayerHomeSocial({ roomId, roleSlotId }),
    loadPlayerHomeSession({ roomId, roleSlotId, actorId })
  ]);
  const progress = await resolvePlayerHomeProgress({
    roomId,
    roleSlotId,
    sections: content.sections,
    segments: content.segments,
    provider: content.runtimeProvider
  });
  const projectedSocial = content.runtimeProvider?.isFrozen
    ? projectFrozenPlayerSocial(content.runtimeProvider, social)
    : social;
  const projectedSession = content.runtimeProvider?.isFrozen
    ? projectFrozenPlayerSession(content.runtimeProvider, session)
    : session;

  return {
    room: content.room,
    role: content.role,
    sections: progress.sections,
    ...projectedSocial,
    ...projectedSession,
    currentActKey: progress.currentActKey,
    tasks: progress.tasks,
    segments: content.segments,
    communicationTemplates: content.communicationTemplates
  };
}
