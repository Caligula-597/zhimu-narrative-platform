import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { throwErr } from "./api-errors.js";

const MIN_TOTAL_TEXT_CHARS = 40;
const MIN_AVG_TEXT_CHARS_PER_PAGE = 12;

export function isPdfTextSufficient(text, pageCount) {
  const compact = String(text ?? "").replace(/\s/g, "");
  if (compact.length >= MIN_TOTAL_TEXT_CHARS) return true;
  if (pageCount > 0 && compact.length / pageCount >= MIN_AVG_TEXT_CHARS_PER_PAGE) return true;
  return false;
}

export function pdfOcrEnabled() {
  return process.env.PDF_OCR_ENABLED !== "false";
}

export function pdfOcrMaxPages() {
  const parsed = Number(process.env.PDF_OCR_MAX_PAGES ?? 30);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 30;
}

export function pdfOcrScale() {
  const parsed = Number(process.env.PDF_OCR_SCALE ?? 2);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 2;
}

export function pdfOcrLang() {
  return String(process.env.PDF_OCR_LANG ?? "chi_sim").trim() || "chi_sim";
}

export function pdfPageImportMaxPages() {
  const parsed = Number(process.env.PDF_PAGE_IMPORT_MAX_PAGES ?? 40);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 40;
}

export function pdfPageRenderScale() {
  const parsed = Number(process.env.PDF_PAGE_RENDER_SCALE ?? 2);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 2;
}

export async function detectPdfContentMode(buffer) {
  const doc = await loadPdfDocument(buffer);
  const textResult = await extractPdfTextFromDocument(doc);
  const mode = isPdfTextSufficient(textResult.text, textResult.pageCount) ? "text" : "pages";
  return { mode, pageCount: textResult.pageCount, text: textResult.text };
}

export async function renderPdfPreviewPage(buffer, pageNumber = 1, scale = 1.25) {
  const doc = await loadPdfDocument(buffer);
  const page = await doc.getPage(Math.min(Math.max(pageNumber, 1), doc.numPages));
  return renderPdfPageToPng(page, scale);
}

export async function loadPdfDocument(buffer) {
  const data = new Uint8Array(buffer);
  return getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false
  }).promise;
}

export async function extractPdfTextFromDocument(doc) {
  const perPage = [];
  const chunks = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join("");
    perPage.push(pageText);
    if (pageText.trim()) chunks.push(pageText.trim());
  }
  return { text: chunks.join("\n\n"), perPage, pageCount: doc.numPages };
}

export async function renderPdfPageToPng(page, scale = pdfOcrScale()) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const canvasContext = canvas.getContext("2d");
  await page.render({ canvasContext, viewport, canvas }).promise;
  return canvas.toBuffer("image/png");
}

export async function ocrPdfDocument(doc, options = {}) {
  const maxPages = options.maxPages ?? pdfOcrMaxPages();
  const scale = options.scale ?? pdfOcrScale();
  const lang = options.lang ?? pdfOcrLang();
  const createOcrWorker = options.createWorker ?? createWorker;

  if (doc.numPages > maxPages) {
    throwErr("PDF_OCR_PAGE_LIMIT", `PDF has ${doc.numPages} pages; OCR limit is ${maxPages}`);
  }

  const worker = await createOcrWorker(lang);
  const perPage = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const png = await renderPdfPageToPng(page, scale);
      const { data } = await worker.recognize(png);
      perPage.push(String(data.text ?? "").trim());
    }
  } finally {
    await worker.terminate();
  }

  const text = perPage.filter(Boolean).join("\n\n");
  return { text, perPage, pageCount: doc.numPages, ocrPages: doc.numPages };
}

/**
 * Text-layer PDF → direct extract; optional OCR when allowOcr=true (creator tooling).
 */
export async function extractTextFromPdfBuffer(buffer, options = {}) {
  const doc = await loadPdfDocument(buffer);
  const textResult = await extractPdfTextFromDocument(doc);

  if (isPdfTextSufficient(textResult.text, textResult.pageCount)) {
    return {
      text: textResult.text,
      extraction: { method: "pdf_text", pageCount: textResult.pageCount }
    };
  }

  const allowOcr = options.allowOcr ?? options.ocrEnabled ?? false;
  if (!allowOcr) {
    throwErr(
      "PDF_PAGES_RECOMMENDED",
      "This PDF has no text layer; import as image pages instead of text."
    );
  }

  const ocrEnabled = options.ocrEnabled ?? pdfOcrEnabled();
  if (!ocrEnabled) {
    throwErr(
      "PDF_OCR_REQUIRED",
      "This PDF has no text layer; enable PDF OCR or import as image pages."
    );
  }

  const ocrResult = await ocrPdfDocument(doc, options);
  if (!ocrResult.text.replace(/\s/g, "")) throwErr("DOCUMENT_EMPTY");

  return {
    text: ocrResult.text,
    extraction: {
      method: "pdf_ocr",
      pageCount: ocrResult.pageCount,
      ocrPages: ocrResult.ocrPages,
      ocrLang: options.lang ?? pdfOcrLang()
    }
  };
}
