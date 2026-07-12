/** Player-home application service. Repositories own SQL; this layer owns composition. */
import {
  loadAuthorizedPlayerHomeContent,
  loadPlayerHomeContent
} from "../repositories/player-home-content-repository.js";
import { loadPlayerHomeSocial } from "../repositories/player-home-social-repository.js";
import { loadPlayerHomeSession } from "../repositories/player-home-session-repository.js";
import { loadPlayerHomeTasks, resolvePlayerHomeProgress } from "../services/player-home-progress-service.js";

const EMPTY_SOCIAL = Object.freeze({
  notes: [], clues: [], sharedClues: [], roomMembers: [],
  suspicions: [], testimonies: [], privateActions: []
});
const EMPTY_SESSION = Object.freeze({
  voiceRooms: [], inventory: [], hostConfirm: null, currentGame: null,
  activeVotes: [], roleState: null
});

export async function loadPlayerHomeCore({ roomId, roleSlotId }) {
  const content = await loadPlayerHomeContent({ roomId, roleSlotId });
  const progress = await resolvePlayerHomeProgress({
    roomId, roleSlotId, sections: content.sections, segments: content.segments, includeTasks: false
  });
  return {
    room: content.room,
    role: content.role,
    sections: progress.sections,
    ...EMPTY_SOCIAL,
    ...EMPTY_SESSION,
    currentActKey: progress.currentActKey,
    tasks: progress.tasks,
    segments: content.segments
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
    includeTasks: false
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
    contentRevision: content.contentRevision
  };
}

export async function loadPlayerHomeSupplemental({ roomId, roleSlotId, actorId, currentActKey }) {
  const [social, session, tasks] = await Promise.all([
    loadPlayerHomeSocial({ roomId, roleSlotId }),
    loadPlayerHomeSession({ roomId, roleSlotId, actorId }),
    loadPlayerHomeTasks({ roomId, roleSlotId, currentActKey })
  ]);
  return { ...social, ...session, tasks };
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
    segments: content.segments
  });

  return {
    room: content.room,
    role: content.role,
    sections: progress.sections,
    ...social,
    ...session,
    currentActKey: progress.currentActKey,
    tasks: progress.tasks,
    segments: content.segments
  };
}
