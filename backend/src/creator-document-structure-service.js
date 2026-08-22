import { createHash } from "node:crypto";
import { throwErr } from "./api-errors.js";
import { analyzeNarrativeStructure, normalizeCreationType } from "./document-structure.js";
import {
  defaultMiniGameTemplatesFromHandbook,
  extractHostHandbookDigest,
  inferClueTriggerCondition
} from "./document-host-handbook.js";
import {
  insertStructuredImportChapters,
  insertStructuredImportClues,
  insertStructuredImportInvestigationLinks,
  insertStructuredImportRoleRelationships,
  insertStructuredImportRoles,
  insertStructuredImportRoleSections,
  insertStructuredImportScenes,
  insertStructuredImportSecrets,
  insertStructuredImportStoryEdges,
  loadStructuredImportChapterMap,
  loadStructuredImportRoleMap,
  lockStructuredImportWorld,
  mergeStructuredImportWorldHandbook,
  upsertStructuredImportCoreTrick
} from "./repositories/creator-document-structure-repository.js";

function lookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("zh-CN");
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

async function loadCreatedSceneClueMaps(client, worldId, source, scenes, clues) {
  const sceneImportKeys = scenes.map((candidate) => candidateImportKey(source, candidate));
  const clueImportKeys = clues.map((candidate) => candidateImportKey(source, candidate));
  const sceneRows = sceneImportKeys.length
    ? await client.query(
        `SELECT id, name, metadata FROM scenes
         WHERE world_id = $1 AND metadata->>'importKey' = ANY($2::text[])`,
        [worldId, sceneImportKeys]
      )
    : { rows: [] };
  const clueRows = clueImportKeys.length
    ? await client.query(
        `SELECT id, name, metadata FROM clues
         WHERE world_id = $1 AND metadata->>'importKey' = ANY($2::text[])`,
        [worldId, clueImportKeys]
      )
    : { rows: [] };
  const sceneIdByImportKey = new Map(sceneRows.rows.map((row) => [row.metadata?.importKey, row.id]));
  const clueIdByImportKey = new Map(clueRows.rows.map((row) => [row.metadata?.importKey, row.id]));
  return { sceneIdByImportKey, clueIdByImportKey };
}

function buildSceneClueLinks({ source, scenes, clues, sceneIdByImportKey, clueIdByImportKey }) {
  const links = [];
  const edges = [];
  const usedClues = new Set();

  function titleKey(value) {
    return String(value ?? "")
      .replace(/\s+/g, "")
      .replace(/\d+$/g, "")
      .toLocaleLowerCase("zh-CN");
  }

  const sceneIdByTitle = new Map();
  for (const candidate of scenes) {
    const id = sceneIdByImportKey.get(candidateImportKey(source, candidate));
    if (!id) continue;
    sceneIdByTitle.set(titleKey(candidate.title), id);
  }

  for (const clueCandidate of clues) {
    const clueId = clueIdByImportKey.get(candidateImportKey(source, clueCandidate));
    if (!clueId || usedClues.has(clueId)) continue;
    // Only colocate room/location-like clue cards onto same-named scenes.
    if (!/房间|客栈|家|楼|河|树|府|市|帮|下游/.test(String(clueCandidate.title || ""))) continue;
    const sceneId = sceneIdByTitle.get(titleKey(clueCandidate.title));
    if (!sceneId) continue;
    usedClues.add(clueId);
    const trigger =
      clueCandidate.meta?.triggerCondition ||
      inferClueTriggerCondition(clueCandidate.body, clueCandidate.title);
    const importKey = `${source}:title-pair:${titleKey(clueCandidate.title)}:${clueId}`;
    links.push({
      sceneId,
      clueId,
      name: `搜证 · ${clueCandidate.title}`,
      description: trigger,
      interactionText: "在此场景发起搜证以获得对应线索卡。",
      resultText: String(clueCandidate.body || "").slice(0, 2000),
      sequence: Number(clueCandidate.meta?.catalogIndex || clueCandidate.meta?.index || 0),
      importKey,
      pairKey: null,
      triggerCondition: trigger
    });
    edges.push({
      fromType: "scene",
      fromId: sceneId,
      toType: "clue",
      toId: clueId,
      relationType: "mainline",
      label: "场景线索卡"
    });
  }

  return { links, edges };
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
  const sceneCandidates = byType("scene");
  const clueCandidates = byType("clue");
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
    scenes: sceneCandidates.map((candidate) => ({
      title: candidate.title,
      body: candidate.body,
      chapterId: chapterMap.get(lookupKey(candidate.parentActTitle)) ?? null,
      importKey: candidateImportKey(source, candidate),
      pairKey: candidate.meta?.pairKey || ""
    }))
  });
  const createdClues = await insertStructuredImportClues(client, {
    worldId,
    clues: clueCandidates.map((candidate) => ({
      title: candidate.title,
      body: candidate.body,
      filename: String(document?.filename ?? ""),
      importKey: candidateImportKey(source, candidate),
      pairKey: candidate.meta?.pairKey || "",
      sourceKind: candidate.meta?.sourceKind || "",
      cardKind: candidate.meta?.cardKind || "",
      catalogIndex: candidate.meta?.catalogIndex ?? null,
      triggerCondition:
        candidate.meta?.triggerCondition || inferClueTriggerCondition(candidate.body, candidate.title),
      grantMode: candidate.meta?.grantMode || (candidate.meta?.pairKey ? "explore" : "host_confirm"),
      colocatedWithScene: Boolean(candidate.meta?.colocatedWithScene)
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

  const { sceneIdByImportKey, clueIdByImportKey } = await loadCreatedSceneClueMaps(
    client,
    worldId,
    source,
    sceneCandidates,
    clueCandidates
  );
  const { links, edges } = buildSceneClueLinks({
    source,
    scenes: sceneCandidates,
    clues: clueCandidates,
    sceneIdByImportKey,
    clueIdByImportKey
  });
  const createdPoints = await insertStructuredImportInvestigationLinks(client, { worldId, links });
  const createdEdges = await insertStructuredImportStoryEdges(client, { worldId, edges });

  const handbook = extractHostHandbookDigest(text);
  const killerName = handbook.coreTrickDraft.metadata?.killerNames?.[0];
  const killerRoleSlotId = killerName ? roleMap.get(lookupKey(killerName)) || null : null;
  const createdCoreTrick = await upsertStructuredImportCoreTrick(client, {
    worldId,
    coreTrick: handbook.coreTrickDraft,
    killerRoleSlotId
  });

  const relationshipRows = [];
  for (const rel of handbook.relationships) {
    const fromRoleSlotId = roleMap.get(lookupKey(rel.fromName));
    const toRoleSlotId = roleMap.get(lookupKey(rel.toName));
    if (!fromRoleSlotId || !toRoleSlotId || fromRoleSlotId === toRoleSlotId) continue;
    relationshipRows.push({
      fromRoleSlotId,
      toRoleSlotId,
      label: rel.label,
      relationType: rel.relationType,
      strength: rel.strength,
      visibility: rel.visibility
    });
  }
  const createdRelationships = await insertStructuredImportRoleRelationships(client, {
    worldId,
    relationships: relationshipRows
  });

  await mergeStructuredImportWorldHandbook(client, {
    worldId,
    hostHandbook: {
      source: "structured_document_import",
      flowNotes: handbook.flowNotes,
      endings: handbook.endings,
      alignments: handbook.alignments,
      importedAt: new Date().toISOString()
    },
    miniGameTemplates: defaultMiniGameTemplatesFromHandbook(text)
  });

  const created = {
    roles: createdRoles.length,
    roleSections: createdRoleSections.length,
    acts: createdChapters.length,
    scenes: createdScenes.length,
    clues: createdClues.length,
    secrets: createdSecrets.length,
    investigationPoints: createdPoints.length,
    edges: createdEdges.length,
    relationships: createdRelationships.length,
    coreTrick: createdCoreTrick ? 1 : 0,
    endings: handbook.endings.length,
    miniGames: 3
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
