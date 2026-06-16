import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isPdfTextSufficient,
  detectPdfContentMode,
  extractTextFromPdfBuffer,
  pdfOcrEnabled
} from "../src/pdf-document.js";
import { sectionContentMode, buildPagesSectionMetadata } from "../src/section-content.js";

test("isPdfTextSufficient accepts normal text PDF extract", () => {
  assert.equal(isPdfTextSufficient("这是一段足够长的剧本正文，用于测试文本层提取是否通过阈值判断。", 1), true);
});

test("isPdfTextSufficient rejects empty image-only extract", () => {
  assert.equal(isPdfTextSufficient("", 7), false);
  assert.equal(isPdfTextSufficient("   \n", 3), false);
});

test("sectionContentMode detects pages metadata", () => {
  const meta = buildPagesSectionMetadata({
    pageAssetIds: ["00000000-0000-4000-8000-000000000001"],
    sourceFilename: "a.pdf",
    pageCount: 1
  });
  assert.equal(sectionContentMode(meta), "pages");
  assert.equal(sectionContentMode({ contentMode: "pages", pageAssetIds: [] }), "text");
});

test("extractTextFromPdfBuffer rejects image PDF without allowOcr", async (t) => {
  const samplePath = process.env.PDF_OCR_SAMPLE_PATH;
  if (!samplePath) {
    t.skip("Set PDF_OCR_SAMPLE_PATH to an image-only PDF");
    return;
  }
  const buffer = readFileSync(samplePath);
  const detected = await detectPdfContentMode(buffer);
  assert.equal(detected.mode, "pages");
  await assert.rejects(
    () => extractTextFromPdfBuffer(buffer, { allowOcr: false }),
    (err) => err.code === "PDF_PAGES_RECOMMENDED"
  );
});

test("extractTextFromPdfBuffer uses OCR for image PDF when allowOcr enabled", async (t) => {
  const samplePath = process.env.PDF_OCR_SAMPLE_PATH;
  if (!samplePath || !pdfOcrEnabled()) {
    t.skip("Set PDF_OCR_SAMPLE_PATH to an image-only PDF to run live OCR test");
    return;
  }
  const buffer = readFileSync(samplePath);
  const result = await extractTextFromPdfBuffer(buffer, { allowOcr: true });
  assert.equal(result.extraction.method, "pdf_ocr");
  assert.ok(result.text.replace(/\s/g, "").length > 100);
});
