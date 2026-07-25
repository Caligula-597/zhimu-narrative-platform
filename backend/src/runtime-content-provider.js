import { query } from "./db.js";
import { projectRoomContentBinding } from "../../shared/room-content-binding.js";
import { buildWorldSnapshot } from "./routes/world-chapter-service.js";
import { loadRuntimeContentRecord } from "./repositories/runtime-content-repository.js";
import { assertWorldReleaseSnapshot } from "./world-release-contract.js";

const RUNTIME_COLLECTIONS = Object.freeze([
  "chapters",
  "roles",
  "sections",
  "scenes",
  "clues",
  "investigationPoints",
  "items",
  "edges",
  "rules",
  "segments",
  "segmentRefs",
  "playerTasks"
]);

function publicRoom(record) {
  return {
    id: record.room_id,
    worldId: record.world_id,
    name: record.room_name,
    status: record.room_status
  };
}

function liveSnapshotMetadata(record, snapshot) {
  return {
    schemaVersion: null,
    sourceRevision: Number(record.current_content_revision ?? 1),
    narrativeProfile: snapshot.world?.settings?.narrativeProfile ?? null,
    ...snapshot
  };
}

function runtimeContent(snapshot, provider) {
  const content = {
    schemaVersion: snapshot.schemaVersion ?? null,
    sourceRevision: Number(snapshot.sourceRevision ?? provider.sourceRevision),
    narrativeProfile: snapshot.narrativeProfile ?? null,
    world: snapshot.world ?? null
  };
  for (const field of RUNTIME_COLLECTIONS) content[field] = provider.collection(field);
  return content;
}

export function createRuntimeContentProvider(record, { liveSnapshot = null } = {}) {
  if (!record?.room_id || !record?.world_id) {
    throw new TypeError("Runtime content record is missing its room or world");
  }

  const released = Boolean(record.release_id);
  const snapshot = released
    ? assertWorldReleaseSnapshot(record.release_snapshot)
    : liveSnapshotMetadata(record, liveSnapshot ?? {});
  const runtimeSource = released ? "release_snapshot" : "live_draft";
  const binding = projectRoomContentBinding(record, { runtimeSource });
  const indexes = new Map();

  function collection(field) {
    const value = snapshot[field];
    return Array.isArray(value) ? value : [];
  }

  function find(field, id) {
    if (!id) return null;
    if (!indexes.has(field)) {
      indexes.set(field, new Map(collection(field).map((item) => [String(item.id), item])));
    }
    return indexes.get(field).get(String(id)) ?? null;
  }

  const provider = {
    room: publicRoom(record),
    worldId: record.world_id,
    runtimeSource,
    isFrozen: released,
    sourceRevision: released
      ? Number(record.release_source_revision)
      : Number(record.current_content_revision ?? 1),
    currentDraftRevision: Number(record.current_content_revision ?? 1),
    contentBinding: binding,
    snapshot,
    collection,
    find
  };
  provider.toResponse = () => ({
    room: provider.room,
    contentBinding: provider.contentBinding,
    content: runtimeContent(snapshot, provider)
  });
  return provider;
}

export async function loadRuntimeContentProvider(roomId, {
  runQuery = query,
  includeLiveSnapshot = true
} = {}) {
  const record = await loadRuntimeContentRecord(roomId, runQuery);
  if (!record) return null;
  let liveSnapshot = null;
  if (!record.release_id && includeLiveSnapshot) {
    liveSnapshot = await buildWorldSnapshot(record.world_id, { query: runQuery });
  }
  return createRuntimeContentProvider(record, { liveSnapshot });
}

function sectionIsPublished(section, roomStatus) {
  return section.publication_status === "published"
    || (roomStatus === "testing" && section.publication_status === "testing");
}

function projectPlayerSegment(segment) {
  return {
    id: segment.id,
    segment_key: segment.segment_key,
    title: segment.title,
    sequence: segment.sequence,
    chapter_id: segment.chapter_id,
    player_tasks: segment.story?.playerTasks ?? segment.player_tasks ?? [],
    end_condition: segment.mechanics?.endCondition ?? segment.end_condition ?? null,
    player_tips: segment.operations?.playerTips ?? segment.player_tips ?? []
  };
}

export function projectPlayerRuntimeContent(provider, {
  roleSlotId,
  roomStatus = provider.room.status,
  progress = [],
  unlockedSectionIds = []
}) {
  const role = provider.find("roles", roleSlotId);
  const progressBySection = new Map(
    progress.map((row) => [String(row.script_section_id ?? row.id), row])
  );
  const unlocked = new Set(unlockedSectionIds.map(String));
  const roleSections = provider.collection("sections")
    .filter((section) => String(section.role_slot_id) === String(roleSlotId))
    .filter((section) => sectionIsPublished(section, roomStatus))
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));
  const firstSequence = roleSections[0]?.sequence;
  const sections = roleSections
    .filter((section) => section.sequence === firstSequence || unlocked.has(String(section.id)))
    .map((section) => {
      const state = progressBySection.get(String(section.id)) ?? {};
      return {
        ...section,
        started_at: state.started_at ?? null,
        completed_at: state.completed_at ?? null,
        completed: Boolean(state.completed_at)
      };
    });

  return {
    role,
    sections,
    segments: provider.collection("segments").map(projectPlayerSegment)
  };
}
