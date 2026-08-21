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
import {
  CORPUS_KIND_VERSION,
  buildKindMessages,
  chunkKindParagraphs,
  mixKindCoverage,
  parseKindItems,
  renderKindDashboard,
  renderNamedReport,
  splitKindParagraphs
} from "./corpus-gate-semantic.mjs";
import {
  CORPUS_AXES_VERSION,
  buildAxisMessages,
  mixBookAxes,
  parseAxisItems,
  renderAxesWorksheet,
  renderBookAxesReport,
  renderHumanVsAiProfile,
  renderNewFactDashboard,
  inspectParagraphQuality,
  informationDeliveryProfile,
  sampleConsecutiveParagraphs,
  skipAxisRow
} from "./corpus-gate-axes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = path.join(root, "案例");
const cacheRoot = path.join(corpusRoot, ".gate-cache");
const backendRequire = createRequire(path.join(root, "backend", "package.json"));
const mammoth = backendRequire("mammoth");
const { createWorker } = backendRequire("tesseract.js");

const SKIP_NAMES = new Set(["口播.txt", "1(3).txt", ".gate-cache", "电子购买联系方式.pdf"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const TEXT_EXT = new Set([".txt", ".md"]);
const MAX_OCR_BYTES = 12 * 1024 * 1024;

const WORKS = [
  {
    id: "technician",
    title: "《上钟儿》",
    reliability: "D",
    peerGroup: "mechanism",
    tags: { players: "6-8", play: "mechanism" },
    match: (rel) => /(?:号技师|^18号\/|尚佳仪\/|禾三儿\/)/.test(rel)
  },
  {
    id: "geshi-xin",
    title: "《隔世信》",
    reliability: "D",
    peerGroup: "emotion",
    tags: { players: "6", play: "emotion" },
    match: (rel) => rel.includes("隔世信")
  },
  {
    id: "gumu",
    title: "《古木》",
    reliability: "E",
    peerGroup: "mystery",
    tags: { play: "mystery" },
    match: (rel) => /古木|第一幕|第二幕|线索总/.test(rel)
  },
  {
    id: "suyue",
    title: "《溯月》",
    reliability: "A",
    peerGroup: "mystery",
    tags: { play: "mystery" },
    match: (rel) => rel.startsWith("剧本/")
  },
  {
    id: "gufeng",
    title: "《云水谣》",
    reliability: "D",
    peerGroup: "mystery",
    tags: { play: "mystery" },
    match: (rel) => /姜昕|康宁|沈复新|沈归年|胡月月|许思|齐管家|主持人手册/.test(rel)
  },
  {
    id: "jp-photo",
    title: "《木偶》",
    reliability: "D",
    peerGroup: "mystery_jp",
    tags: { play: "mystery", form: "city-limit" },
    match: (rel) => /不破秋波|大冢敬公|天照樱和|安倍侦探|明智春光|月读千鹤|般若弥生|^主持人\/|^结局\//.test(rel)
  },
  {
    id: "nandemo",
    title: "《欢迎来到万事屋》",
    reliability: "C",
    peerGroup: "mystery_jp",
    tags: { play: "mystery" },
    match: (rel) => /久元里美|佐腾亮|小栗熊|山下智八|山口大和|新坦结库|星野源一|星野美雪|木村盆栽|松土润|水原凉子|高桥一郎|组织者手册|^卡片/.test(rel)
  },
  {
    id: "cn-2020",
    title: "《地狱小镇》",
    reliability: "D",
    peerGroup: "mystery",
    tags: { players: "6", play: "mystery" },
    match: (rel) => /_20200517_/.test(rel)
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

function loadBackendEnv() {
  backendRequire("dotenv").config({ path: path.join(root, "backend", ".env") });
}

function parseJsonObject(content) {
  const cleaned = String(content || "").replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("kind json parse failed");
  }
}

async function requestKindJson(messages) {
  loadBackendEnv();
  const apiKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = String(process.env.DEEPSEEK_MODEL || "deepseek-v4-flash");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 2400,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" }
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      lastError = new Error(payload?.error?.message || `kind label HTTP ${response.status}`);
      continue;
    }
    try {
      return parseJsonObject(payload?.choices?.[0]?.message?.content);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("kind json parse failed");
}

async function labelWorkText(text, { limit = Infinity } = {}) {
  const paragraphs = splitKindParagraphs(text);
  const chunks = chunkKindParagraphs(paragraphs);
  const rows = [];
  let used = 0;
  let cacheHits = 0;
  for (const chunk of chunks) {
    const digest = hashBuffer(Buffer.from(`${CORPUS_KIND_VERSION}\n${chunk.paragraphs.join("\n")}`));
    const file = cachePath("semantic", digest);
    if (fs.existsSync(file)) {
      const cached = readJson(file);
      const labels = Array.isArray(cached.labels)
        ? cached.labels
        : (cached.rows || []).map((row) => row.label);
      rows.push(...chunk.paragraphs.map((paragraph, offset) => ({
        i: chunk.start + offset + 1,
        paragraph,
        label: labels[offset] || "unlabeled"
      })));
      cacheHits += 1;
      continue;
    }
    if (used >= limit) break;
    let labeled;
    try {
      const value = await requestKindJson(buildKindMessages(chunk));
      labeled = parseKindItems(value, chunk);
    } catch (error) {
      process.stdout.write(`kind-skip ${chunk.start + 1}-${chunk.start + chunk.paragraphs.length} ${error.message}\n`);
      rows.push(...chunk.paragraphs.map((paragraph, offset) => ({
        i: chunk.start + offset + 1,
        paragraph,
        label: "unlabeled"
      })));
      used += 1;
      continue;
    }
    writeJson(file, {
      version: CORPUS_KIND_VERSION,
      hash: digest,
      labeledAt: new Date().toISOString(),
      labels: labeled.map((row) => row.label)
    });
    rows.push(...labeled);
    used += 1;
    process.stdout.write(`kind ${chunk.start + 1}-${chunk.start + chunk.paragraphs.length}\n`);
  }
  return { mix: mixKindCoverage(rows), cacheHits, labeledChunks: used, chunkCount: chunks.length };
}

const AXES_SAMPLE_WORKS = [
  { id: "suyue", seed: 7, count: 40 },
  { id: "technician", seed: 13, count: 40 },
  { id: "nandemo", seed: 19, count: 40 }
];

function bucketSampleText(bucket) {
  if (bucket.id !== "nandemo") return bucket.texts.join("\n\n");
  return bucket.sources
    .filter((row) => row.text && !/组织者手册|^卡片/.test(row.path || ""))
    .map((row) => row.text)
    .join("\n\n");
}

function splitAiRoles(text) {
  return String(text || "")
    .split(/(?=^\d+号角色：)/mu)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d+)号角色：([^\n]+)\n([\s\S]*)$/u);
      if (!match) return { title: "未分角色", text: part };
      const name = match[2].trim().split(/\s+/u)[0];
      return { index: match[1], title: `${match[1]}号 ${name}`, text: match[3].trim() };
    });
}

function profileFromStoredAxes(file) {
  const data = readJson(file);
  const rows = data.mix?.kept || data.rows || [];
  return {
    id: data.id,
    title: data.title,
    reliability: data.reliability,
    profile: informationDeliveryProfile(rows),
    mix: {
      mode: data.mix?.mode,
      info: data.mix?.info,
      skipRatio: data.mix?.skipRatio
    }
  };
}

async function labelAiSample(spec) {
  const aiPath = path.join(cacheRoot, spec.file);
  if (!fs.existsSync(aiPath)) throw new Error(`missing ${aiPath}`);
  const source = fs.readFileSync(aiPath, "utf8");
  const roles = spec.split === "roles"
    ? splitAiRoles(source)
    : [{ title: spec.roleTitle || spec.title, text: source.trim() }];
  const extras = [];
  for (const role of roles) {
    const labeled = await labelAxisParagraphs(splitKindParagraphs(role.text), 0);
    extras.push({
      title: role.title,
      rows: labeled.rows,
      profile: informationDeliveryProfile(labeled.rows),
      mix: mixBookAxes(labeled.rows),
      labeledChunks: labeled.used,
      cacheHits: labeled.cacheHits,
      paragraphCount: labeled.rows.length
    });
    console.log(`${role.title} axes: ${labeled.used}/${labeled.cacheHits} new/cache, ${labeled.rows.length} spans`);
  }
  const allRows = extras.flatMap((role) => role.rows || []);
  const book = {
    id: spec.id,
    title: spec.title,
    reliability: "A",
    profile: informationDeliveryProfile(allRows),
    mix: mixBookAxes(allRows)
  };
  const { kept: _kept, ...mixWithoutKept } = book.mix;
  writeJson(path.join(cacheRoot, "works", `${spec.id}-axes.json`), {
    id: spec.id,
    title: spec.title,
    reliability: "A",
    version: CORPUS_AXES_VERSION,
    mix: mixWithoutKept,
    profile: book.profile,
    roles: extras.map((role) => ({
      title: role.title,
      profile: role.profile,
      labeledChunks: role.labeledChunks,
      cacheHits: role.cacheHits,
      paragraphCount: role.paragraphCount
    }))
  });
  return { book, extras };
}

async function runAxesCompare() {
  const samples = [
    { id: "ai-luosuo", title: "测试B（落锁之前）", file: "ai-luosuo/role.md", split: "single", roleTitle: "林晓月" },
    { id: "ai-xinmin", title: "测试A（新民百货）", file: "ai-xinmin/roles.md", split: "roles" }
  ];
  const labeled = [];
  for (const spec of samples) {
    labeled.push(await labelAiSample(spec));
  }
  const suyue = profileFromStoredAxes(path.join(cacheRoot, "works", "suyue-axes.json"));
  suyue.title = "《溯月》A";
  const nandemo = profileFromStoredAxes(path.join(cacheRoot, "works", "nandemo-axes.json"));
  nandemo.title = "《欢迎来到万事屋》C";
  const focus = labeled[0];
  const report = renderHumanVsAiProfile({
    ai: focus.book,
    humans: [labeled[1].book, suyue, nandemo],
    extras: focus.extras
  });
  const reportPath = path.join(cacheRoot, "axes-human-vs-ai.md");
  fs.writeFileSync(reportPath, report, "utf8");
  console.log(`wrote ${reportPath}`);
}

async function labelAxisParagraphs(paragraphs, start) {
  const chunks = chunkKindParagraphs(paragraphs, 1600, 20).map((chunk) => ({
    ...chunk,
    start: start + chunk.start
  }));
  const rows = [];
  let used = 0;
  let cacheHits = 0;
  for (const chunk of chunks) {
    const allSkip = chunk.paragraphs.every((paragraph) => inspectParagraphQuality(paragraph));
    if (allSkip) {
      rows.push(...chunk.paragraphs.map((paragraph, offset) => (
        skipAxisRow(paragraph, chunk.start + offset + 1, inspectParagraphQuality(paragraph))
      )));
      continue;
    }
    const digest = hashBuffer(Buffer.from(`${CORPUS_AXES_VERSION}\n${chunk.paragraphs.join("\n")}`));
    const file = cachePath("axes", digest);
    if (fs.existsSync(file)) {
      const cached = readJson(file);
      rows.push(...chunk.paragraphs.map((paragraph, offset) => ({
        i: chunk.start + offset + 1,
        paragraph,
        ...(cached.rows?.[offset] || { mode: ["unlabeled"], info: ["unlabeled"], delivery: "unlabeled", role: "unlabeled" })
      })));
      cacheHits += 1;
      continue;
    }
    try {
      const value = await requestKindJson(buildAxisMessages(chunk));
      const labeled = parseAxisItems(value, chunk);
      writeJson(file, {
        version: CORPUS_AXES_VERSION,
        hash: digest,
        labeledAt: new Date().toISOString(),
        rows: labeled.map((row) => ({ mode: row.mode, info: row.info, delivery: row.delivery, role: row.role }))
      });
      rows.push(...labeled);
      used += 1;
      process.stdout.write(`axes ${chunk.start + 1}-${chunk.start + chunk.paragraphs.length}\n`);
    } catch (error) {
      process.stdout.write(`axes-skip ${chunk.start + 1}-${chunk.start + chunk.paragraphs.length} ${error.message}\n`);
      rows.push(...chunk.paragraphs.map((paragraph, offset) => ({
        i: chunk.start + offset + 1,
        paragraph,
        mode: ["unlabeled"],
        info: ["unlabeled"],
        delivery: "unlabeled",
        role: "unlabeled"
      })));
      used += 1;
    }
  }
  return { rows, used, cacheHits };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const ocr = !args.has("--skip-ocr");
  const ocrLimitIndex = process.argv.indexOf("--ocr-limit");
  const ocrLimit = ocrLimitIndex >= 0 ? Number(process.argv[ocrLimitIndex + 1]) : Infinity;
  const semantic = args.has("--semantic");
  const semanticOcr = args.has("--semantic-ocr");
  const semanticLimitIndex = process.argv.indexOf("--semantic-limit");
  const semanticLimit = semanticLimitIndex >= 0 ? Number(process.argv[semanticLimitIndex + 1]) : Infinity;
  const workFilterIndex = process.argv.indexOf("--work");
  const workFilter = workFilterIndex >= 0 ? String(process.argv[workFilterIndex + 1] || "") : "";
  if (!fs.existsSync(corpusRoot)) {
    console.error("案例 folder missing");
    process.exit(1);
  }
  fs.mkdirSync(path.join(cacheRoot, "extract"), { recursive: true });
  fs.mkdirSync(path.join(cacheRoot, "semantic"), { recursive: true });
  fs.mkdirSync(path.join(cacheRoot, "axes"), { recursive: true });
  if (args.has("--axes-compare")) {
    await runAxesCompare();
    if (ocrWorker) await ocrWorker.terminate();
    return;
  }
  const axesSample = args.has("--axes-sample");
  const axesFull = args.has("--axes");
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
    let kindMix = null;
    if (semantic && text && (!workFilter || bucket.id === workFilter)) {
      const ocrText = [...bucket.methods].some((method) => method === "image_ocr" || method === "pdf_ocr");
      if (!ocrText || semanticOcr || workFilter) {
        const labeled = await labelWorkText(text, { limit: semanticLimit });
        kindMix = labeled.mix;
        console.log(`${bucket.title} kinds: ${labeled.labeledChunks}/${labeled.chunkCount} chunks, ${labeled.cacheHits} cache hits`);
      }
    }
    const summary = {
      id: bucket.id,
      title: bucket.title,
      peerGroup: bucket.peerGroup,
      reliability: bucket.reliability,
      tags: bucket.tags,
      methods: [...bucket.methods],
      cacheHits: bucket.cacheHits,
      pending: bucket.pending,
      sourceCount: bucket.sources.length,
      extractedSources: bucket.sources.filter((row) => row.text).length,
      features,
      kindMix
    };
    if (!axesSample && !axesFull) {
      writeJson(path.join(cacheRoot, "works", `${bucket.id}.json`), {
        ...summary,
        textChars: compactLength(text),
        labels: features?.labels || [],
        values: features?.values || null,
        kindMix
      });
    }
    works.push(summary);
    if (!axesSample && !axesFull) console.log(`${bucket.title}: ${compactLength(text)} chars, ${bucket.cacheHits} cache hits, ${bucket.pending} pending`);
  }
  if (axesSample) {
    const samples = [];
    for (const spec of AXES_SAMPLE_WORKS) {
      const bucket = buckets.get(spec.id);
      const paragraphs = splitKindParagraphs(bucketSampleText(bucket));
      const picked = sampleConsecutiveParagraphs(paragraphs, spec.count, spec.seed);
      const labeled = await labelAxisParagraphs(picked.paragraphs, picked.start);
      samples.push({
        id: spec.id,
        title: bucket.title,
        reliability: bucket.reliability,
        start: picked.start,
        spans: labeled.rows
      });
      console.log(`${bucket.title} axes: ${labeled.used} chunks, ${labeled.cacheHits} cache hits, ${picked.paragraphs.length} spans from ${picked.start + 1}`);
    }
    const samplePath = path.join(cacheRoot, "axes-sample.json");
    const sheetPath = path.join(cacheRoot, "axes-sample.md");
    const dashPath = path.join(cacheRoot, "axes-newfact.md");
    writeJson(samplePath, { version: CORPUS_AXES_VERSION, generatedAt: new Date().toISOString(), samples });
    fs.writeFileSync(sheetPath, renderAxesWorksheet(samples), "utf8");
    fs.writeFileSync(dashPath, renderNewFactDashboard(samples), "utf8");
    console.log(`wrote ${sheetPath}`);
    console.log(`wrote ${dashPath}`);
    if (ocrWorker) await ocrWorker.terminate();
    return;
  }
  if (axesFull) {
    const books = [];
    const order = ["suyue", "nandemo", "technician", "geshi-xin", "gufeng", "jp-photo", "cn-2020", "gumu"];
    for (const id of order) {
      const bucket = buckets.get(id);
      if (!bucket || (workFilter && bucket.id !== workFilter)) continue;
      const text = id === "nandemo" ? bucketSampleText(bucket) : bucket.texts.join("\n\n");
      const labeled = await labelAxisParagraphs(splitKindParagraphs(text), 0);
      const mix = mixBookAxes(labeled.rows);
      books.push({ id, title: bucket.title, reliability: bucket.reliability, mix });
      writeJson(path.join(cacheRoot, "works", `${id}-axes.json`), {
        id,
        title: bucket.title,
        reliability: bucket.reliability,
        version: CORPUS_AXES_VERSION,
        mix,
        labeledChunks: labeled.used,
        cacheHits: labeled.cacheHits,
        paragraphCount: labeled.rows.length
      });
      console.log(`${bucket.title} axes-full: ${labeled.used}/${labeled.cacheHits} new/cache, skip ${Math.round(mix.skipRatio * 1000) / 10}%`);
    }
    const reportPath = path.join(cacheRoot, "axes-books.md");
    fs.writeFileSync(reportPath, renderBookAxesReport(books), "utf8");
    console.log(`wrote ${reportPath}`);
    if (ocrWorker) await ocrWorker.terminate();
    return;
  }
  const dashboard = `${renderCorpusDashboard({ works })}${renderKindDashboard(works)}`;
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
  const namedPath = path.join(cacheRoot, "report-by-name.md");
  fs.writeFileSync(namedPath, `${renderNamedReport(works)}\n`, "utf8");
  if (ocrWorker) await ocrWorker.terminate();
  console.log(`wrote ${dashboardPath}`);
  console.log(`wrote ${namedPath}`);
}

function featuresVersion() {
  return extractCorpusFeatures("你问过他。他说姓廖。").version;
}

main().catch(async (error) => {
  if (ocrWorker) await ocrWorker.terminate();
  console.error(error);
  process.exit(1);
});
