import mammoth from "mammoth";
import { throwErr } from "./api-errors.js";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

function cleanText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitSections(text) {
  const normalized = cleanText(text);
  const lines = normalized.split("\n");
  const sections = [];
  let current = { title: "导入正文", body: [] };
  for (const line of lines) {
    const heading = line.match(/^\s*(?:#{1,6}\s+|第[一二三四五六七八九十百0-9]+[章节幕]\s*[：:]?\s*)(.+?)\s*$/);
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

export async function parseCreatorDocument({ filename, contentBase64 }) {
  const buffer = Buffer.from(String(contentBase64 ?? ""), "base64");
  if (!buffer.length || buffer.length > MAX_DOCUMENT_BYTES) throwErr("DOCUMENT_SIZE_INVALID");
  const extension = String(filename ?? "").toLowerCase().match(/\.[^.]+$/)?.[0];
  let text;
  if ([".txt", ".md", ".markdown"].includes(extension)) text = buffer.toString("utf8");
  else if (extension === ".docx") text = (await mammoth.extractRawText({ buffer })).value;
  else throwErr("DOCUMENT_TYPE_UNSUPPORTED");
  const cleaned = cleanText(text);
  if (!cleaned) throwErr("DOCUMENT_EMPTY");
  const sections = splitSections(cleaned).slice(0, 80);
  return { filename, text: cleaned, sections, characterCount: cleaned.length, sectionCount: sections.length };
}
