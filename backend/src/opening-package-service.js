import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { sendErr, throwErr } from "./api-errors.js";
import { uploadWorldAssetFromBuffer } from "./asset-upload-helpers.js";
import { configureCreatorDocumentTransaction, lockDocumentEditor, upsertImportSourceSnapshot } from "./repositories/creator-document-repository.js";
import {
  insertStructuredImportClues,
  insertStructuredImportRoles,
  insertStructuredImportRoleSections,
  loadStructuredImportRoleMap,
  lockStructuredImportWorld,
  mergeStructuredImportWorldHandbook
} from "./repositories/creator-document-structure-repository.js";
import { createStudioClue, updateStudioClue } from "./repositories/studio-scene-clue-repository.js";
import {
  defaultMiniGameTemplatesFromHandbook,
  extractHostHandbookDigest,
  extractHostHandbookManuscript,
  inferClueTriggerCondition
} from "./document-host-handbook.js";
import { decodeDocumentBuffer, parseCreatorDocument } from "./document-parser.js";
import { runDocumentProcessing } from "./document-processing-guard.js";
import { normalizeCreationType } from "./document-structure.js";
import { runRevisionMutation } from "./world-revision.js";

const IMAGE_EXTENSIONS = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"]
]);

function lookupKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function matchKey(value) {
  return String(value ?? "")
    .replace(/\.[^.]+$/i, "")
    .replace(/[\s_]*(角色本|剧本|线索|clue|card|jpg|png|jpeg|webp|gif)/gi, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("zh-CN");
}

function filenameStem(filename) {
  return String(filename ?? "")
    .replace(/\.[^.]+$/i, "")
    .replace(/[_\s]*(角色本|剧本|role)$/i, "")
    .trim();
}

function fileExtension(filename) {
  return String(filename ?? "").toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

function packageSourceKey(slot, filename, text) {
  const normalizedType = "murder_mystery";
  return `opening-package:${slot}:sha256:${createHash("sha256")
    .update(`${normalizedType}\n${filename}\n${text}`)
    .digest("hex")}`;
}

function expandZipDocxEntries(file) {
  const extension = fileExtension(file.filename);
  if (extension !== ".zip") return [file];
  const buffer = decodeDocumentBuffer(file);
  const zip = new AdmZip(buffer);
  const entries = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith(".docx")) continue;
    const name = entry.entryName.split("/").pop() || entry.entryName;
    entries.push({
      filename: name,
      contentBase64: entry.getData().toString("base64"),
      roleName: file.roleName || ""
    });
  }
  if (!entries.length) throwErr("DOCUMENT_EMPTY", "ZIP 内未找到 .docx 文件");
  return entries;
}

function expandZipImageEntries(file) {
  const extension = fileExtension(file.filename);
  if (extension !== ".zip") return [file];
  const buffer = decodeDocumentBuffer(file);
  const zip = new AdmZip(buffer);
  const entries = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.split("/").pop() || entry.entryName;
    const ext = fileExtension(name);
    if (!IMAGE_EXTENSIONS.has(ext)) continue;
    entries.push({
      filename: name,
      contentBase64: entry.getData().toString("base64")
    });
  }
  if (!entries.length) throwErr("DOCUMENT_EMPTY", "ZIP 内未找到图片文件");
  return entries;
}

async function parseDocxSlot(file, creationType) {
  const parsed = await runDocumentProcessing(() => parseCreatorDocument({
    filename: file.filename,
    contentBase64: file.contentBase64,
    creationType,
    rightsConfirmed: true
  }));
  return parsed;
}

function summarizeDocxSlot(parsed, label) {
  const structure = parsed?.structure || {};
  return {
    label,
    filename: parsed?.filename || "",
    characterCount: Number(parsed?.characterCount || 0),
    sectionCount: Number(parsed?.sectionCount || 0),
    structureCounts: structure.counts || {},
    candidateCount: Number(structure.candidateCount || 0),
    ready: Boolean(parsed?.text?.trim())
  };
}

export async function previewOpeningPackage(payload = {}) {
  if (payload?.rightsConfirmed !== true) throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
  const creationType = normalizeCreationType(payload?.creationType);
  if (!payload?.hostHandbook?.filename) throwErr("OPENING_PACKAGE_HOST_REQUIRED");

  const hostParsed = await parseDocxSlot(payload.hostHandbook, creationType);
  const roleFiles = (payload.roleScripts || []).flatMap(expandZipDocxEntries);
  const roleSummaries = [];
  for (const file of roleFiles) {
    const parsed = await parseDocxSlot(file, creationType);
    roleSummaries.push({
      ...summarizeDocxSlot(parsed, file.roleName || filenameStem(file.filename)),
      roleName: file.roleName || filenameStem(file.filename)
    });
  }

  let clueTextSummary = null;
  if (payload.clueTextDoc?.filename) {
    const parsed = await parseDocxSlot(payload.clueTextDoc, creationType);
    const clueCount = (parsed?.structure?.candidates || []).filter((item) => item.type === "clue").length;
    clueTextSummary = { ...summarizeDocxSlot(parsed, "线索文字版"), clueCount };
  }

  const imageFiles = (payload.clueImages || []).flatMap(expandZipImageEntries);
  const imageSummaries = imageFiles.map((file) => ({
    filename: file.filename,
    extension: fileExtension(file.filename),
    matchKey: matchKey(file.filename)
  }));

  return {
    target: "opening_package_preview",
    creationType,
    hostHandbook: summarizeDocxSlot(hostParsed, "主持手册"),
    roleScripts: roleSummaries,
    clueTextDoc: clueTextSummary,
    clueImages: imageSummaries,
    checklist: {
      hostHandbook: true,
      roleScripts: roleSummaries.length > 0,
      clueTextDoc: Boolean(clueTextSummary),
      clueImages: imageSummaries.length > 0
    },
    ready: hostParsed?.text?.trim()
  };
}

async function loadClueNameMap(client, worldId) {
  const result = await client.query(
    `SELECT id, name, metadata FROM clues WHERE world_id = $1`,
    [worldId]
  );
  const byKey = new Map();
  for (const row of result.rows) {
    const key = matchKey(row.name);
    if (key && !byKey.has(key)) byKey.set(key, row);
  }
  return byKey;
}

function roleSectionsFromDocument(document, roleSlotId, source, filename, roleName) {
  const sections = Array.isArray(document?.sections) ? document.sections : [];
  const usable = sections.filter((section) => String(section?.body || "").trim());
  if (!usable.length) {
    const body = String(document?.text || "").trim();
    if (!body) return [];
    return [{
      roleSlotId,
      chapterId: null,
      title: roleName || filenameStem(filename) || "角色剧本",
      body,
      filename,
      importKey: `${source}:section:0`
    }];
  }
  return usable.map((section, index) => ({
    roleSlotId,
    chapterId: null,
    title: String(section.title || `分幕 ${index + 1}`).trim(),
    body: String(section.body || "").trim(),
    filename,
    importKey: `${source}:section:${index}`
  }));
}

export async function commitOpeningPackageWithClient(client, {
  worldId,
  actorId,
  payload = {}
}) {
  if (payload?.rightsConfirmed !== true) throwErr("IMPORT_RIGHTS_CONFIRMATION_REQUIRED");
  const creationType = normalizeCreationType(payload?.creationType);
  if (!payload?.hostHandbook?.filename) throwErr("OPENING_PACKAGE_HOST_REQUIRED");
  if (!await lockStructuredImportWorld(client, worldId)) throwErr("WORLD_NOT_FOUND");

  const created = {
    hostHandbook: 0,
    roles: 0,
    roleSections: 0,
    cluesText: 0,
    cluesImage: 0,
    cluesImageBound: 0,
    assets: 0
  };

  const hostParsed = await parseDocxSlot(payload.hostHandbook, creationType);
  const hostText = String(hostParsed.text || "").trim();
  if (!hostText) throwErr("DOCUMENT_EMPTY");
  const hostSource = packageSourceKey("host", payload.hostHandbook.filename, hostText);
  await upsertImportSourceSnapshot(client, {
    worldId,
    actorId,
    body: hostText,
    filename: payload.hostHandbook.filename,
    sourceKey: hostSource,
    sha256: hostSource.split(":").pop()
  });
  const handbook = extractHostHandbookDigest(hostText);
  await mergeStructuredImportWorldHandbook(client, {
    worldId,
    hostHandbook: {
      source: "opening_package_import",
      flowNotes: handbook.flowNotes,
      endings: handbook.endings,
      alignments: handbook.alignments,
      manuscript: extractHostHandbookManuscript(hostText),
      importedAt: new Date().toISOString()
    },
    miniGameTemplates: defaultMiniGameTemplatesFromHandbook(hostText)
  });
  created.hostHandbook = 1;

  const roleFiles = (payload.roleScripts || []).flatMap(expandZipDocxEntries);
  for (const file of roleFiles) {
    const parsed = await parseDocxSlot(file, creationType);
    const roleName = String(file.roleName || filenameStem(file.filename) || "").trim();
    if (!roleName) continue;
    const source = packageSourceKey("role", file.filename, parsed.text);
    const insertedRoles = await insertStructuredImportRoles(client, {
      worldId,
      roles: [{ name: roleName, importKey: `${source}:role` }]
    });
    created.roles += insertedRoles.length;
    const roleMap = await loadStructuredImportRoleMap(client, worldId);
    const roleSlotId = roleMap.get(lookupKey(roleName));
    if (!roleSlotId) continue;
    const sections = roleSectionsFromDocument(parsed, roleSlotId, source, file.filename, roleName);
    const insertedSections = await insertStructuredImportRoleSections(client, {
      worldId,
      sections
    });
    created.roleSections += insertedSections.length;
  }

  if (payload.clueTextDoc?.filename) {
    const parsed = await parseDocxSlot(payload.clueTextDoc, creationType);
    const text = String(parsed.text || "").trim();
    const source = packageSourceKey("clues", payload.clueTextDoc.filename, text);
    const clueCandidates = (parsed.structure?.candidates || []).filter((item) => item.type === "clue");
    const insertedClues = await insertStructuredImportClues(client, {
      worldId,
      clues: clueCandidates.map((candidate, index) => ({
        title: candidate.title,
        body: candidate.body,
        filename: payload.clueTextDoc.filename,
        importKey: `${source}:clue:${index}`,
        pairKey: candidate.meta?.pairKey || "",
        sourceKind: candidate.meta?.sourceKind || "text_doc",
        cardKind: candidate.meta?.cardKind || "text",
        catalogIndex: candidate.meta?.catalogIndex ?? index,
        triggerCondition:
          candidate.meta?.triggerCondition || inferClueTriggerCondition(candidate.body, candidate.title),
        grantMode: candidate.meta?.grantMode || "host_confirm",
        colocatedWithScene: Boolean(candidate.meta?.colocatedWithScene)
      }))
    });
    created.cluesText = insertedClues.length;
  }

  const imageFiles = (payload.clueImages || []).flatMap(expandZipImageEntries);
  if (imageFiles.length) {
    const clueByKey = await loadClueNameMap(client, worldId);
    for (const file of imageFiles) {
      const extension = fileExtension(file.filename);
      const contentType = IMAGE_EXTENSIONS.get(extension);
      if (!contentType) continue;
      const buffer = decodeDocumentBuffer(file);
      const asset = await uploadWorldAssetFromBuffer(client, {
        actorId,
        worldId,
        filename: file.filename,
        buffer,
        contentType,
        visibility: "public",
        assetKind: "image"
      });
      created.assets += 1;
      const key = matchKey(file.filename);
      const existing = key ? clueByKey.get(key) : null;
      const clueName = filenameStem(file.filename) || file.filename;
      if (existing) {
        await updateStudioClue(client, {
          worldId,
          clueId: existing.id,
          metadata: {
            ...(existing.metadata || {}),
            assetId: asset.assetId,
            clueType: "image",
            source: "opening_package_import",
            imageFilename: file.filename
          }
        });
        created.cluesImageBound += 1;
      } else {
        const clue = await createStudioClue(client, {
          worldId,
          name: clueName,
          publicText: "",
          hostText: "",
          visibility: "host",
          clueKind: "general",
          metadata: {
            source: "opening_package_import",
            assetId: asset.assetId,
            clueType: "image",
            imageFilename: file.filename,
            importKey: packageSourceKey("clue-image", file.filename, asset.assetId)
          }
        });
        if (key) clueByKey.set(key, clue);
        created.cluesImage += 1;
      }
    }
  }

  await client.query(
    `UPDATE worlds
     SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
       'importOpeningPackage', $2::jsonb
     ),
     updated_at = now()
     WHERE id = $1`,
    [
      worldId,
      JSON.stringify({
        importedAt: new Date().toISOString(),
        hostFilename: payload.hostHandbook.filename,
        roleFileCount: roleFiles.length,
        clueTextFilename: payload.clueTextDoc?.filename || "",
        clueImageCount: imageFiles.length,
        created
      })
    ]
  );

  const changed = Object.values(created).some((count) => count > 0);
  return {
    target: "opening_package",
    creationType,
    created,
    changed,
    safety: {
      publicationStatus: "draft",
      importedClueVisibility: "host",
      existingContentOverwritten: false
    }
  };
}

export async function commitOpeningPackage({ request, reply, actorId, worldId, payload }) {
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await lockDocumentEditor(client, { worldId, actorId });
    return commitOpeningPackageWithClient(client, { worldId, actorId, payload });
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureCreatorDocumentTransaction,
    shouldBumpRevision: (result) => result.changed
  });
}
