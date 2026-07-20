import { sendErr, throwErr } from "./api-errors.js";
import {
  configureStudioVersionTransaction,
  countContentVersions,
  createContentVersion,
  deleteContentVersion,
  lockContentVersion,
  lockStudioVersionEditor,
  restoreVersionChapters,
  restoreVersionSections,
  snapshotHasForeignReferences
} from "./repositories/studio-version-repository.js";
import { buildWorldArchiveSnapshot } from "./routes/world-chapter-service.js";
import { runRevisionMutation } from "./world-revision.js";

const MAX_CONTENT_VERSIONS_PER_WORLD = 50;
const MAX_CONTENT_VERSION_BYTES = 25 * 1024 * 1024;
const MAX_VERSION_CHAPTERS = 2_000;
const MAX_VERSION_SECTIONS = 20_000;

async function assertEditor(client, { worldId, actorId }) {
  const role = await lockStudioVersionEditor(client, { worldId, actorId });
  if (!role) throwErr("WORLD_ACCESS_DENIED");
  if (!["owner", "editor"].includes(role)) throwErr("WORLD_EDITOR_REQUIRED");
}

function assertSnapshotShape(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throwErr("CONTENT_VERSION_INVALID");
  }
  if (!Array.isArray(snapshot.chapters) || !Array.isArray(snapshot.sections)) {
    throwErr("CONTENT_VERSION_INVALID");
  }
  if (snapshot.chapters.length > MAX_VERSION_CHAPTERS || snapshot.sections.length > MAX_VERSION_SECTIONS) {
    throwErr("CONTENT_VERSION_TOO_LARGE");
  }
  const publicationStatuses = new Set(["draft", "testing", "published"]);
  const chaptersValid = snapshot.chapters.every((chapter) =>
    chapter && typeof chapter.id === "string" && typeof chapter.title === "string"
    && (chapter.publication_status == null || publicationStatuses.has(chapter.publication_status))
  );
  const sectionsValid = snapshot.sections.every((section) =>
    section && typeof section.id === "string" && typeof section.title === "string"
    && typeof section.body === "string"
    && (section.publication_status == null || publicationStatuses.has(section.publication_status))
  );
  if (!chaptersValid || !sectionsValid) throwErr("CONTENT_VERSION_INVALID");
}

export function addStudioVersion({ request, reply, actorId, worldId, label }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    if (await countContentVersions(client, worldId) >= MAX_CONTENT_VERSIONS_PER_WORLD) {
      throwErr("CONTENT_VERSION_LIMIT_REACHED");
    }
    const snapshot = await buildWorldArchiveSnapshot(worldId, client);
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
    if (snapshotBytes > MAX_CONTENT_VERSION_BYTES) throwErr("CONTENT_VERSION_TOO_LARGE");
    return createContentVersion(client, { worldId, actorId, label, snapshot });
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureStudioVersionTransaction,
    shouldBumpRevision: () => false
  });
}

export function restoreStudioVersion({ request, reply, actorId, worldId, versionId }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    const version = await lockContentVersion(client, { worldId, versionId });
    if (!version) throwErr("CONTENT_VERSION_NOT_FOUND");
    const snapshot = version.snapshot;
    assertSnapshotShape(snapshot);
    if (await snapshotHasForeignReferences(client, { worldId, snapshot })) {
      throwErr("CONTENT_VERSION_INVALID");
    }
    const chaptersRestored = await restoreVersionChapters(client, {
      worldId,
      chapters: snapshot.chapters
    });
    const sectionsRestored = await restoreVersionSections(client, {
      worldId,
      sections: snapshot.sections
    });
    return {
      ok: true,
      restoredVersionId: versionId,
      chaptersRestored,
      sectionsRestored
    };
  }, { sendErr, configureClient: configureStudioVersionTransaction });
}

export function removeStudioVersion({ request, reply, actorId, worldId, versionId }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertEditor(client, { worldId, actorId });
    if (!await deleteContentVersion(client, { worldId, versionId })) {
      throwErr("CONTENT_VERSION_NOT_FOUND");
    }
    return { ok: true };
  }, {
    sendErr,
    configureClient: configureStudioVersionTransaction,
    shouldBumpRevision: () => false
  });
}
