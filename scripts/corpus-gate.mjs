#!/usr/bin/env node
/** Extract and cache commercial-script features. Reuses hashed OCR/text. */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  extractCorpusFeatures,
  renderCorpusDashboard
} from "./corpus-gate-features.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = path.join(root, "案例");
const cacheRoot = path.join(corpusRoot, ".gate-cache");
const backendRequire = createRequire(path.join(root, "backend", "package.json"));
const mammoth = backendRequire("mammoth");
const { createWorker } = backendRequire("tesseract.js");

const SKIP_NAMES = new Set(["口播.txt", ".gate-cache", "电子购买联系方式.pdf"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const TEXT_EXT = new Set([".txt", ".md"]);
const MAX_OCR_BYTES = 12 * 1024 * 1024;

const WORKS = [
  {
    id: "technician",
    title: "技师本《上钟儿》",
    peerGroup: "mechanism",
    tags: { players: "6-8", play: "mechanism" },
    match: (rel) => /(?:号技师|^18号\/|尚佳仪\/|禾三儿\/)/.test(rel)
  },
  {
    id: "geshi-xin",
    title: "隔世信",
    peerGroup: "emotion",
    tags: { players: "6", play: "emotion" },
    match: (rel) => rel.includes("隔世信")
  },
  {
    id: "gumu",
    title: "古木",
    peerGroup: "mystery",
    tags: { play: "mystery" },
    match: (rel) => /古木|第一幕|第二幕|线索总/.test(rel)
  },
  {
    id: "suyue",
    title: "溯月角色本",
    peerGroup: "mystery",
    tags: { play: "mystery" },
    match: (rel) => rel.startsWith("剧本/")
  },
  {
    id: "gufeng",
    title: "古风扫描本",
    peerGroup: "mystery",
    tags: { play: "mystery" },
    match: (rel) => /姜昕|康宁|沈复新|沈归年|胡月月|许思|齐管家|主持人手册/.test(rel)
  },
  {
    id: "jp-photo",
    title: "日式城限扫描本",
    peerGroup: "mystery_jp",
    tags: { play: "mystery", form: "city-limit" },
    match: (rel) => /不破秋波|大冢敬公|天照樱和|安倍侦探|明智春光|月读千鹤|般若弥生|^主持人\/|^结局\//.test(rel)
  },
  {
    id: "jp-pdf",
    title: "日式盒装PDF",
    peerGroup: "mystery_jp",
    tags: { play: "mystery", form: "boxed" },
    match: (rel) => /久元里美|佐腾亮|小栗熊|山下智八|山口大和|新坦结库|星野源一|星野美雪|木村盆栽|松土润|水原凉子|高桥一郎|组织者手册|^卡片/.test(rel)
  },
  {
    id: "cn-2020",
    title: "六人扫描本（2020）",
    peerGroup: "mystery",
    tags: { players: "6", play: "mystery" },
    match: (rel) => /_20200517_/.test(rel)
  },
  {
    id: "fanxiang",
    title: "反向审判",
    peerGroup: "novel",
    tags: { play: "novel" },
    match: (rel) => rel === "1(3).txt"
  }
];

function rel(filePath) {
  return path.relative(corpusRoot, filePath).split(path.sep).join("/");
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function cachePath(kind, digest) {
  return path.join(cacheRoot, kind, `${digest}.json`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function walkFiles(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name) || entry.name === ".gate-cache") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(absolute, output);
    else output.push(absolute);
  }
  return output;
}

function isCoverPdf(relativePath, relatives) {
  if (!relativePath.endsWith(".pdf") || /-[12]\.pdf$/i.test(relativePath)) return false;
  const stem = relativePath.replace(/\.pdf$/i, "");
  return relatives.includes(`${stem}-1.pdf`);
}

function assignWork(relativePath) {
  return WORKS.find((work) => work.match(relativePath)) || null;
}

let pdfExtract = null;
async function loadPdfExtract() {
  if (pdfExtract) return pdfExtract;
  const mod = await import(pathToFileURL(path.join(root, "backend/src/pdf-document.js")).href);
  pdfExtract = mod.extractTextFromPdfBuffer;
  return pdfExtract;
}

let ocrWorker = null;
async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  const langPath = fs.existsSync(path.join(root, "chi_sim.traineddata")) ? root : undefined;
  ocrWorker = await createWorker("chi_sim", 1, langPath ? { langPath } : {});
  return ocrWorker;
}

async function extractFresh(filePath, buffer, options) {
  const extension = path.extname(filePath).toLowerCase();
  if (TEXT_EXT.has(extension)) {
    return { text: buffer.toString("utf8"), method: "plain_text" };
  }
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: String(result.value || ""), method: "docx" };
  }
  if (extension === ".pdf") {
    if (buffer.length > MAX_OCR_BYTES) {
      return { text: "", method: "skipped_large_pdf", warning: `PDF ${buffer.length} bytes skipped` };
    }
    try {
      const extractTextFromPdfBuffer = await loadPdfExtract();
      const result = await extractTextFromPdfBuffer(buffer, { allowOcr: Boolean(options.ocr) && buffer.length <= MAX_OCR_BYTES });
      return { text: String(result.text || ""), method: result.extraction?.method || "pdf" };
    } catch (error) {
      const message = error.message || String(error);
      if (!options.ocr && /no text layer|PDF_PAGES_RECOMMENDED/i.test(message)) {
        return { text: "", method: "ocr_deferred", warning: message };
      }
      return { text: "", method: "pdf_failed", warning: message };
    }
  }
  if (IMAGE_EXT.has(extension)) {
    if (!options.ocr) return { text: "", method: "ocr_deferred", warning: "image OCR skipped" };
    if (buffer.length > MAX_OCR_BYTES) return { text: "", method: "skipped_large_image", warning: "image too large" };
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(filePath);
    return { text: String(data.text || ""), method: "image_ocr" };
  }
  return { text: "", method: "unsupported" };
}

async function extractCached(filePath, options) {
  const buffer = fs.readFileSync(filePath);
  const digest = hashBuffer(buffer);
  const file = cachePath("extract", digest);
  if (fs.existsSync(file)) {
    const cached = readJson(file);
    const retryOcr = options.ocr && !cached.text && ["ocr_deferred", "pdf_failed"].includes(cached.method);
    if (!retryOcr) {
      return { ...cached, digest, cacheHit: true, path: rel(filePath) };
    }
  }
  const fresh = await extractFresh(filePath, buffer, options);
  const record = {
    hash: digest,
    path: rel(filePath),
    method: fresh.method,
    warning: fresh.warning || "",
    text: String(fresh.text || "").replace(/\r\n/g, "\n").trim(),
    charCount: compactLength(fresh.text),
    extractedAt: new Date().toISOString()
  };
  writeJson(file, record);
  return { ...record, digest, cacheHit: false };
}

function compactLength(value) {
  return String(value || "").replace(/\s+/gu, "").length;
}

function cjkRatio(value) {
  const body = String(value || "").replace(/\s+/gu, "");
  if (!body) return 0;
  return (body.match(/[\u4e00-\u9fff]/gu) || []).length / body.length;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const ocr = !args.has("--skip-ocr");
  const ocrLimitIndex = process.argv.indexOf("--ocr-limit");
  const ocrLimit = ocrLimitIndex >= 0 ? Number(process.argv[ocrLimitIndex + 1]) : Infinity;
  const workFilterIndex = process.argv.indexOf("--work");
  const workFilter = workFilterIndex >= 0 ? String(process.argv[workFilterIndex + 1] || "") : "";
  if (!fs.existsSync(corpusRoot)) {
    console.error("案例 folder missing");
    process.exit(1);
  }
  fs.mkdirSync(path.join(cacheRoot, "extract"), { recursive: true });
  const files = walkFiles(corpusRoot).sort((a, b) => rel(a).localeCompare(rel(b), "zh"));
  const relatives = files.map(rel);
  const buckets = new Map(WORKS.map((work) => [work.id, { ...work, sources: [], texts: [], methods: new Set(), cacheHits: 0, pending: 0 }]));
  let ocrUsed = 0;
  for (const filePath of files) {
    const relativePath = rel(filePath);
    if (isCoverPdf(relativePath, relatives)) continue;
    const work = assignWork(relativePath);
    if (!work) continue;
    const bucket = buckets.get(work.id);
    const extension = path.extname(filePath).toLowerCase();
    const needsOcr = IMAGE_EXT.has(extension) || extension === ".pdf";
    const wantsOcr = ocr && needsOcr && ocrUsed < ocrLimit && (!workFilter || work.id === workFilter);
    const extracted = await extractCached(filePath, { ocr: wantsOcr });
    if (!extracted.cacheHit) process.stdout.write(`${extracted.method} ${relativePath}\n`);
    if ((extracted.method === "image_ocr" || extracted.method === "pdf_ocr") && !extracted.cacheHit) ocrUsed += 1;
    if (extracted.cacheHit) bucket.cacheHits += 1;
    if (extracted.method === "ocr_deferred") bucket.pending += 1;
    bucket.sources.push(extracted);
    bucket.methods.add(extracted.method);
    if (extracted.text && (extracted.method === "plain_text" || extracted.method === "docx" || cjkRatio(extracted.text) >= 0.45)) {
      bucket.texts.push(extracted.text);
    }
  }
  const works = [];
  for (const bucket of buckets.values()) {
    const text = bucket.texts.join("\n\n");
    const features = text ? extractCorpusFeatures(text) : null;
    const summary = {
      id: bucket.id,
      title: bucket.title,
      peerGroup: bucket.peerGroup,
      tags: bucket.tags,
      methods: [...bucket.methods],
      cacheHits: bucket.cacheHits,
      pending: bucket.pending,
      sourceCount: bucket.sources.length,
      extractedSources: bucket.sources.filter((row) => row.text).length,
      features
    };
    writeJson(path.join(cacheRoot, "works", `${bucket.id}.json`), {
      ...summary,
      textChars: compactLength(text),
      labels: features?.labels || [],
      values: features?.values || null
    });
    works.push(summary);
    console.log(`${bucket.title}: ${compactLength(text)} chars, ${bucket.cacheHits} cache hits, ${bucket.pending} pending`);
  }
  const dashboard = renderCorpusDashboard({ works });
  const dashboardPath = path.join(cacheRoot, "dashboard.md");
  fs.writeFileSync(dashboardPath, `${dashboard}\n`, "utf8");
  writeJson(path.join(cacheRoot, "dashboard.json"), {
    generatedAt: new Date().toISOString(),
    featureVersion: featuresVersion(),
    works: works.map((work) => ({
      id: work.id,
      title: work.title,
      peerGroup: work.peerGroup,
      chars: work.features?.values?.chars || 0,
      methods: work.methods,
      cacheHits: work.cacheHits,
      pending: work.pending,
      values: work.features?.values || null,
      topLabels: (work.features?.labels || []).slice(0, 12)
    }))
  });
  if (ocrWorker) await ocrWorker.terminate();
  console.log(`wrote ${dashboardPath}`);
}

function featuresVersion() {
  return extractCorpusFeatures("你问过他。他说姓廖。").version;
}

main().catch(async (error) => {
  if (ocrWorker) await ocrWorker.terminate();
  console.error(error);
  process.exit(1);
});
