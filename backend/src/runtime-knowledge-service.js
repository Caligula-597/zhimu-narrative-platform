import { throwErr } from "./api-errors.js";
import { loadRuntimeContentProvider, projectPlayerRuntimeContent } from "./runtime-content-provider.js";
import { loadRuntimeKnowledgeFacts } from "./repositories/runtime-knowledge-repository.js";

function isoNow(now) {
  return new Date(typeof now === "function" ? now() : now).toISOString();
}

function clueAccess(row, roleSlotId) {
  if (String(row.owner_role_slot_id) === String(roleSlotId)) return "owned";
  if (row.shared_with_room) return "shared_room";
  return "shared_role";
}

function publicRole(role, member) {
  if (!role) return null;
  return {
    id: role.id,
    name: role.name,
    publicProfile: role.public_profile ?? "",
    privateProfile: role.private_profile ?? "",
    playerDisplayName: member?.display_name ?? null,
    joinedAt: member?.joined_at ?? null
  };
}

function projectClue(provider, row, roleSlotId, audience) {
  const authored = provider.find("clues", row.clue_id);
  if (!authored) return null;
  const clue = {
    id: authored.id,
    name: authored.name,
    publicText: authored.public_text ?? "",
    access: clueAccess(row, roleSlotId),
    ownerRoleSlotId: row.owner_role_slot_id,
    acquiredAt: row.acquired_at,
    readAt: row.read_at ?? null,
    sharedAt: row.shared_at ?? null,
    playerNote: row.player_note ?? ""
  };
  if (audience !== "player") {
    clue.hostText = authored.host_text ?? "";
    clue.hostNote = row.host_note ?? "";
  }
  return clue;
}

export async function buildRuntimeKnowledgeProjection({
  roomId,
  roleSlotId,
  audience = "player",
  provider: providedProvider = null,
  now = Date.now(),
  runQuery
}) {
  const queryOptions = runQuery ? { runQuery } : {};
  const provider = providedProvider ?? await loadRuntimeContentProvider(roomId, queryOptions);
  if (!provider) throwErr("ROOM_NOT_FOUND");
  if (!provider.find("roles", roleSlotId)) throwErr("ROLE_SLOT_NOT_FOUND");
  const facts = await loadRuntimeKnowledgeFacts({ roomId, roleSlotId }, runQuery);
  const unlocks = facts?.unlocks ?? [];
  const unlockedSectionIds = unlocks
    .filter((row) => row.content_type === "script_section")
    .map((row) => row.content_id);
  const authored = projectPlayerRuntimeContent(provider, {
    roleSlotId,
    progress: facts?.progress ?? [],
    unlockedSectionIds
  });
  const progressBySection = new Map(
    (facts?.progress ?? []).map((row) => [String(row.script_section_id), row])
  );
  const unlockedSet = new Set(unlockedSectionIds.map(String));
  const visibleSections = audience === "player"
    ? authored.sections
    : provider.collection("sections")
        .filter((section) => String(section.role_slot_id) === String(roleSlotId))
        .sort((left, right) => Number(left.sequence) - Number(right.sequence))
        .map((section, index) => {
          const state = progressBySection.get(String(section.id)) ?? {};
          return {
            ...section,
            started_at: state.started_at ?? null,
            completed_at: state.completed_at ?? null,
            completed: Boolean(state.completed_at),
            unlocked: index === 0 || unlockedSet.has(String(section.id))
          };
        });
  const clues = (facts?.clues ?? [])
    .map((row) => projectClue(provider, row, roleSlotId, audience))
    .filter(Boolean);
  const scenes = unlocks
    .filter((row) => row.content_type === "scene")
    .map((row) => {
      const scene = provider.find("scenes", row.content_id);
      if (!scene) return null;
      return {
        id: scene.id,
        name: scene.name,
        publicText: scene.public_text ?? "",
        ...(audience === "player" ? {} : { hostText: scene.host_text ?? "" }),
        unlockedAt: row.unlocked_at
      };
    })
    .filter(Boolean);
  const investigations = (facts?.investigations ?? []).map((row) => {
    const point = provider.find("investigationPoints", row.investigation_point_id);
    const scene = point ? provider.find("scenes", point.scene_id) : null;
    return {
      pointId: row.investigation_point_id,
      pointName: point?.name ?? "已删除调查点",
      sceneId: point?.scene_id ?? null,
      sceneName: scene?.name ?? "",
      resultText: point?.result_text ?? "",
      result: row.result ?? {},
      investigatedAt: row.investigated_at
    };
  });
  const notes = (facts?.notes ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    sourceType: row.source_type,
    sourceId: row.source_id,
    createdAt: row.created_at
  }));
  const ownedClues = clues.filter((clue) => clue.access === "owned").length;

  return {
    audience,
    roomId,
    roleSlotId,
    role: publicRole(authored.role, facts?.member),
    contentBinding: provider.contentBinding,
    sections: visibleSections.map((section) => ({
      id: section.id,
      title: section.title,
      body: section.body ?? "",
      sequence: Number(section.sequence),
      chapterId: section.chapter_id ?? null,
      startedAt: section.started_at ?? null,
      completedAt: section.completed_at ?? null,
      completed: Boolean(section.completed),
      ...(audience === "player" ? {} : {
        publicationStatus: section.publication_status ?? "draft",
        unlocked: Boolean(section.unlocked)
      })
    })),
    clues,
    scenes,
    investigations,
    notes,
    ...(audience === "player" ? {} : {
      playerState: facts?.player_state ?? null,
      recentLogs: facts?.recent_logs ?? []
    }),
    summary: {
      availableSections: visibleSections.filter((section) => audience === "player" || section.unlocked).length,
      completedSections: visibleSections.filter((section) => section.completed).length,
      ownedClues,
      sharedClues: clues.length - ownedClues,
      investigations: investigations.length,
      notes: notes.length
    },
    generatedAt: isoNow(now)
  };
}
