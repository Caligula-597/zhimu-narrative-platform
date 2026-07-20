import { createHash } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { analyzeNarrativeStructure, normalizeCreationType } from "./document-structure.js";
import {
  insertStructuredImportChapters,
  insertStructuredImportClues,
  insertStructuredImportRoles,
  insertStructuredImportRoleSections,
  insertStructuredImportScenes,
  insertStructuredImportSecrets,
  loadStructuredImportChapterMap,
  loadStructuredImportRoleMap,
  lockStructuredImportWorld
} from "./repositories/creator-document-structure-repository.js";

function lookupKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function uniqueCandidatesByTitle(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = lookupKey(candidate.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceKey(document, creationType) {
  return `structured-document:sha256:${createHash("sha256")
    .update(`${creationType}\n${String(document?.filename ?? "")}\n${String(document?.text ?? "")}`)
    .digest("hex")}`;
}

function candidateImportKey(source, candidate) {
  return `${source}:${candidate.id}`;
}

function claimKey(source, candidate) {
  return `document-secret-${createHash("sha256").update(`${source}:${candidate.id}`).digest("hex").slice(0, 32)}`;
}

export async function importStructuredCreatorDocumentWithClient(client, {
  worldId,
  document,
  creationType,
  rightsConfirmed
}) {
  if (!rightsConfirmed) throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
  const text = String(document?.text ?? "").trim();
  if (!text) throwErr("DOCUMENT_EMPTY");
  const normalizedType = normalizeCreationType(creationType);
  const structure = analyzeNarrativeStructure(text, {
    filename: document?.filename,
    creationType: normalizedType
  });
  if (!structure.candidateCount) throwErr("DOCUMENT_STRUCTURE_EMPTY");
  if (!await lockStructuredImportWorld(client, worldId)) throwErr("WORLD_NOT_FOUND");

  const source = sourceKey(document, normalizedType);
  const byType = (type) => structure.candidates.filter((candidate) => candidate.type === type);
  const roleCandidates = byType("role");
  const actCandidates = byType("act");
  const uniqueRoleCandidates = uniqueCandidatesByTitle(roleCandidates);
  const uniqueActCandidates = uniqueCandidatesByTitle(actCandidates);

  const createdRoles = await insertStructuredImportRoles(client, {
    worldId,
    roles: uniqueRoleCandidates.map((candidate) => ({
      name: candidate.title,
      importKey: candidateImportKey(source, candidate)
    }))
  });
  const createdChapters = await insertStructuredImportChapters(client, {
    worldId,
    chapters: uniqueActCandidates.map((candidate) => ({
      title: candidate.title,
      body: candidate.body,
      importKey: candidateImportKey(source, candidate)
    }))
  });

  const roleMap = await loadStructuredImportRoleMap(client, worldId);
  const chapterMap = await loadStructuredImportChapterMap(client, worldId);
  const roleSections = [...roleCandidates, ...actCandidates.filter((candidate) => candidate.roleName)].flatMap((candidate) => {
    const roleSlotId = roleMap.get(lookupKey(candidate.type === "role" ? candidate.title : candidate.roleName));
    if (!roleSlotId || !candidate.body) return [];
    return [{
      roleSlotId,
      chapterId: candidate.type === "act" ? chapterMap.get(lookupKey(candidate.title)) ?? null : null,
      title: candidate.type === "act" ? candidate.title : candidate.sourceHeading || candidate.title,
      body: candidate.body,
      filename: String(document?.filename ?? ""),
      importKey: candidateImportKey(source, candidate)
    }];
  });
  const createdRoleSections = await insertStructuredImportRoleSections(client, {
    worldId,
    sections: roleSections
  });

  const createdScenes = await insertStructuredImportScenes(client, {
    worldId,
    scenes: byType("scene").map((candidate) => ({
      title: candidate.title,
      body: candidate.body,
      chapterId: chapterMap.get(lookupKey(candidate.parentActTitle)) ?? null,
      importKey: candidateImportKey(source, candidate)
    }))
  });
  const createdClues = await insertStructuredImportClues(client, {
    worldId,
    clues: byType("clue").map((candidate) => ({
      title: candidate.title,
      body: candidate.body,
      filename: String(document?.filename ?? ""),
      importKey: candidateImportKey(source, candidate)
    }))
  });
  const createdSecrets = await insertStructuredImportSecrets(client, {
    worldId,
    secrets: byType("secret").map((candidate) => ({
      title: candidate.title,
      body: candidate.body,
      filename: String(document?.filename ?? ""),
      parentActTitle: candidate.parentActTitle,
      roleName: candidate.roleName,
      claimKey: claimKey(source, candidate),
      importKey: candidateImportKey(source, candidate)
    }))
  });

  const created = {
    roles: createdRoles.length,
    roleSections: createdRoleSections.length,
    acts: createdChapters.length,
    scenes: createdScenes.length,
    clues: createdClues.length,
    secrets: createdSecrets.length
  };
  return {
    target: "structured",
    sourceKey: source,
    creationType: normalizedType,
    detected: structure.counts,
    created,
    changed: Object.values(created).some((count) => count > 0),
    safety: {
      publicationStatus: "draft",
      importedClueVisibility: "host",
      existingContentOverwritten: false
    }
  };
}
