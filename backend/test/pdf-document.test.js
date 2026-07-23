import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas, loadImage, PDFDocument } from "@napi-rs/canvas";
import {
  isPdfTextSufficient,
  detectPdfContentMode,
  extractTextFromPdfBuffer
} from "../src/pdf-document.js";
import { sectionContentMode, buildPagesSectionMetadata } from "../src/section-content.js";

async function createImageOnlyPdf() {
  const raster = createCanvas(1400, 500);
  const rasterContext = raster.getContext("2d");
  rasterContext.fillStyle = "#ffffff";
  rasterContext.fillRect(0, 0, 1400, 500);
  rasterContext.fillStyle = "#111111";
  rasterContext.font = "48px Arial";
  rasterContext.fillText("ZHIMU OCR SAMPLE DOCUMENT", 60, 120);
  rasterContext.fillText("This sentence exists only inside a raster image.", 60, 220);
  rasterContext.fillText("The PDF intentionally contains no searchable text layer.", 60, 320);

  const image = await loadImage(raster.toBuffer("image/png"));
  const pdf = new PDFDocument({ title: "Image-only OCR fixture" });
  const page = pdf.beginPage(1400, 500);
  page.drawImage(image, 0, 0, 1400, 500);
  pdf.endPage();
  return pdf.close();
}

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

test("extractTextFromPdfBuffer rejects image PDF without allowOcr", async () => {
  const buffer = await createImageOnlyPdf();
  const detected = await detectPdfContentMode(buffer);
  assert.equal(detected.mode, "pages");
  await assert.rejects(
    () => extractTextFromPdfBuffer(buffer, { allowOcr: false }),
    (err) => err.code === "PDF_PAGES_RECOMMENDED"
  );
});

test("extractTextFromPdfBuffer renders image PDF pages through the OCR worker", async () => {
  const buffer = await createImageOnlyPdf();
  let terminated = false;
  let recognizedPngBytes = 0;
  const result = await extractTextFromPdfBuffer(buffer, {
    allowOcr: true,
    lang: "eng",
    createWorker: async (lang) => {
      assert.equal(lang, "eng");
      return {
        recognize: async (png) => {
          recognizedPngBytes = png.byteLength;
          return {
            data: {
              text: "ZHIMU OCR SAMPLE DOCUMENT This raster-only page was recognized without a searchable PDF text layer."
            }
          };
        },
        terminate: async () => {
          terminated = true;
        }
      };
    }
  });
  assert.equal(result.extraction.method, "pdf_ocr");
  assert.ok(result.text.includes("ZHIMU OCR SAMPLE"));
  assert.ok(recognizedPngBytes > 100);
  assert.equal(terminated, true);
});
