import mammoth from "mammoth";
import AdmZip from "adm-zip";
import { throwErr } from "./api-errors.js";
import { parseDocumentPayloadBase64 } from "./section-content.js";
import { analyzeNarrativeStructure, normalizeCreationType } from "./document-structure.js";
import { inspectPlayerProse } from "../../shared/prose-quality-gate.js";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_TEXT_CHARACTERS = 2_000_000;
export const DOCUMENT_JSON_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

const MAX_DOCX_ENTRIES = 2_000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

/** Manuscript text extraction only accepts Word .docx. Images/audio upload via assets; ZIP via script-bundle. */
export const MANUSCRIPT_PARSE_EXTENSIONS = new Set([".docx"]);

export function cleanText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function decodeDocumentBuffer(body) {
  const encoded = String(parseDocumentPayloadBase64(body ?? {}) ?? "").trim();
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    throwErr("DOCUMENT_SIZE_INVALID");
  }
  const buffer = Buffer.from(encoded, "base64");
  const canonical = buffer.toString("base64").replace(/=+$/, "");
  if (canonical !== encoded.replace(/=+$/, "") || !buffer.length || buffer.length > MAX_DOCUMENT_BYTES) {
    throwErr("DOCUMENT_SIZE_INVALID");
  }
  return buffer;
}

export function splitSections(text) {
  const normalized = cleanText(text);
  const lines = normalized.split("\n");
  const sections = [];
  let current = { title: "导入正文", body: [] };
  for (const line of lines) {
    const heading = line.match(/^\s*(?:#{1,6}\s+|(?:第\s*)?[一二三四五六七八九十百千万0-9]+[章节幕场]\s*[：:、.-]?\s*)(.+?)\s*$/);
    if (heading) {
      if (current.body.join("\n").trim()) sections.push({ title: current.title, body: current.body.join("\n").trim() });
      current = { title: heading[1].trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.join("\n").trim()) sections.push({ title: current.title, body: current.body.join("\n").trim() });
  return sections.length ? sections : [{ title: "导入正文", body: normalized }];
}

export function parseCreatorTextDocument({
  filename,
  text,
  extraction,
  creationType = "murder_mystery",
  warnings = [],
  pageCount = undefined
}) {
  if (String(text ?? "").length > MAX_DOCUMENT_TEXT_CHARACTERS) {
    throwErr("DOCUMENT_TEXT_TOO_LARGE");
  }
  const cleaned = cleanText(text);
  if (!cleaned) throwErr("DOCUMENT_EMPTY");
  const sections = splitSections(cleaned).slice(0, 80);
  const structure = analyzeNarrativeStructure(cleaned, { filename, creationType });
  const proseDiagnostics = inspectPlayerProse(cleaned, { sections, creationType });
  return {
    filename,
    contentMode: "text",
    ...(pageCount == null ? {} : { pageCount }),
    text: cleaned,
    sections,
    characterCount: cleaned.length,
    sectionCount: sections.length,
    extraction,
    structure,
    proseDiagnostics,
    warnings: [...warnings, ...structure.warnings]
  };
}

function assertSafeDocxArchive(buffer) {
  let entries;
  try {
    entries = new AdmZip(buffer).getEntries();
  } catch {
    throwErr("DOCUMENT_TYPE_UNSUPPORTED", "The DOCX archive is invalid");
  }
  if (entries.length > MAX_DOCX_ENTRIES) throwErr("DOCUMENT_ARCHIVE_TOO_LARGE");
  const names = new Set(entries.map((entry) => String(entry?.entryName ?? "")));
  if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) {
    throwErr("DOCUMENT_TYPE_UNSUPPORTED", "The DOCX archive does not contain a Word document body");
  }
  let uncompressedBytes = 0;
  for (const entry of entries) {
    const size = Number(entry?.header?.size ?? 0);
    if (!Number.isSafeInteger(size) || size < 0) throwErr("DOCUMENT_ARCHIVE_TOO_LARGE");
    uncompressedBytes += size;
    if (uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) throwErr("DOCUMENT_ARCHIVE_TOO_LARGE");
  }
}

function fileExtension(filename) {
  return String(filename ?? "").toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

export async function parseCreatorDocument(body) {
  const buffer = decodeDocumentBuffer(body);
  const filename = String(body?.filename ?? "");
  const extension = fileExtension(filename);
  const creationType = normalizeCreationType(body?.creationType);

  if (extension === ".doc") {
    throwErr(
      "DOCUMENT_TYPE_UNSUPPORTED",
      "Legacy .doc is not supported; save as .docx, or put .docx files in a ZIP script bundle"
    );
  }

  if (extension === ".pdf" || [".txt", ".md", ".markdown", ".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
    throwErr(
      "DOCUMENT_TYPE_UNSUPPORTED",
      "Manuscript parse only accepts .docx (or a ZIP of .docx). Upload images and audio as assets without parsing."
    );
  }

  if (extension !== ".docx") {
    throwErr("DOCUMENT_TYPE_UNSUPPORTED");
  }

  assertSafeDocxArchive(buffer);
  let text;
  try {
    text = (await mammoth.extractRawText({ buffer })).value;
  } catch {
    throwErr("DOCUMENT_TYPE_UNSUPPORTED", "The DOCX document cannot be read");
  }

  return parseCreatorTextDocument({
    filename,
    text,
    extraction: { method: "docx" },
    creationType
  });
}
