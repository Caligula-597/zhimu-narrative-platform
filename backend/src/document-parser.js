import mammoth from "mammoth";
import { throwErr } from "./api-errors.js";
import {
  detectPdfContentMode,
  extractTextFromPdfBuffer,
  renderPdfPreviewPage,
  pdfPageImportMaxPages
} from "./pdf-document.js";
import { parseDocumentPayloadBase64 } from "./section-content.js";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export function cleanText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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

function fileExtension(filename) {
  return String(filename ?? "").toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

export async function parseCreatorDocument(body) {
  const contentBase64 = parseDocumentPayloadBase64(body ?? {});
  const buffer = Buffer.from(String(contentBase64 ?? ""), "base64");
  if (!buffer.length || buffer.length > MAX_DOCUMENT_BYTES) throwErr("DOCUMENT_SIZE_INVALID");

  const filename = String(body?.filename ?? "");
  const extension = fileExtension(filename);
  const parseMode = String(body?.parseMode ?? "auto");
  const allowOcr = Boolean(body?.allowOcr);

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      filename,
      contentMode: "pages",
      pageCount: 1,
      text: "",
      sections: [],
      characterCount: 0,
      sectionCount: 0,
      extraction: { method: "image_file", pageCount: 1 },
      previewImageBase64: buffer.toString("base64"),
      warnings: ["图片将按页导入为分幕，玩家端会直接查看原图。"]
    };
  }

  if (extension === ".pdf") {
    const detected = await detectPdfContentMode(buffer);
    const usePages =
      parseMode === "pages" || (parseMode === "auto" && detected.mode === "pages");

    if (usePages) {
      if (detected.pageCount > pdfPageImportMaxPages()) {
        throwErr("PDF_PAGE_IMPORT_LIMIT", `PDF has ${detected.pageCount} pages; import limit is ${pdfPageImportMaxPages()}`);
      }
      const previewPng = await renderPdfPreviewPage(buffer, 1, 1.25);
      return {
        filename,
        contentMode: "pages",
        pageCount: detected.pageCount,
        text: "",
        sections: [],
        characterCount: 0,
        sectionCount: 0,
        extraction: { method: "pdf_pages", pageCount: detected.pageCount },
        previewImageBase64: previewPng.toString("base64"),
        warnings: [
          "图片型 PDF 将按页导入为分幕图片，玩家端会直接翻页阅读。",
          "如需可编辑文字，可在导入时勾选“尝试 OCR 提取文字”。"
        ]
      };
    }

    const pdf = await extractTextFromPdfBuffer(buffer, { allowOcr });
    const cleaned = cleanText(pdf.text);
    if (!cleaned) throwErr("DOCUMENT_EMPTY");
    const sections = splitSections(cleaned).slice(0, 80);
    const warnings =
      pdf.extraction.method === "pdf_ocr"
        ? ["图片型 PDF 已通过 OCR 识别，请人工复核错字与分段。"]
        : [];
    return {
      filename,
      contentMode: "text",
      pageCount: pdf.extraction.pageCount,
      text: cleaned,
      sections,
      characterCount: cleaned.length,
      sectionCount: sections.length,
      extraction: pdf.extraction,
      warnings
    };
  }

  let text;
  let extraction = { method: extension?.slice(1) ?? "unknown" };

  if ([".txt", ".md", ".markdown"].includes(extension)) {
    text = buffer.toString("utf8");
    extraction = { method: "plain_text" };
  } else if (extension === ".docx") {
    text = (await mammoth.extractRawText({ buffer })).value;
    extraction = { method: "docx" };
  } else {
    throwErr("DOCUMENT_TYPE_UNSUPPORTED");
  }

  const cleaned = cleanText(text);
  if (!cleaned) throwErr("DOCUMENT_EMPTY");
  const sections = splitSections(cleaned).slice(0, 80);

  return {
    filename,
    contentMode: "text",
    text: cleaned,
    sections,
    characterCount: cleaned.length,
    sectionCount: sections.length,
    extraction,
    warnings: []
  };
}
