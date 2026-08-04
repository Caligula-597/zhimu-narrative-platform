import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(currentDir, "..");
const rootRequire = createRequire(path.join(root, "package.json"));
const backendRequire = createRequire(path.join(root, "backend", "package.json"));
const { chromium } = rootRequire("playwright");
const mammoth = backendRequire("mammoth");

const [docxPathArg, outputDirArg] = process.argv.slice(2);
if (!docxPathArg || !outputDirArg) {
  throw new Error("Usage: node render-docx-browser.mjs <docx> <output-dir>");
}

const docxPath = path.resolve(docxPathArg);
const outputDir = path.resolve(outputDirArg);
const stem = path.basename(docxPath, path.extname(docxPath));
const pdfPath = path.join(outputDir, `${stem}.pdf`);
const htmlPath = path.join(outputDir, `${stem}.html`);
const sourceTextPath = path.join(currentDir, "输出", "源代码交存稿_织幕V1.0.txt");

await fs.mkdir(outputDir, { recursive: true });

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function baseStyles() {
  return `
    @page { size: A4; margin: 16mm 16mm 17mm 16mm; }
    * { box-sizing: border-box; }
    html { color: #243443; background: #fff; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "SimSun", "Noto Sans CJK SC", sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #243443;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3 { break-after: avoid; color: #2e74b5; font-weight: 700; }
    h1 { font-size: 17pt; margin: 0 0 10pt; break-before: page; }
    h1:first-of-type { break-before: auto; }
    h1.title {
      color: #203748;
      text-align: center;
      font-size: 26pt;
      line-height: 1.28;
      margin: 58mm 0 12pt;
      break-before: auto;
    }
    h2 { font-size: 13pt; margin: 16pt 0 7pt; }
    h3 { font-size: 12pt; margin: 12pt 0 5pt; color: #1f4d78; }
    p { margin: 0 0 7pt; orphans: 2; widows: 2; }
    p.subtitle {
      text-align: center;
      color: #687887;
      font-size: 11pt;
      margin-bottom: 28mm;
    }
    ul, ol { margin: 4pt 0 9pt 1.7em; padding: 0; }
    li { margin: 0 0 4pt; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 5pt 0 11pt;
      font-size: 9.2pt;
      break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td {
      border: 0.65pt solid #d6dee5;
      padding: 5.5pt 6.5pt;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th, tr:first-child td {
      background: #2e74b5;
      color: #fff;
      font-weight: 700;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    img {
      display: block;
      max-width: 100%;
      max-height: 155mm;
      width: auto;
      height: auto;
      margin: 8pt auto 4pt;
      break-inside: avoid;
    }
    p.caption {
      text-align: center;
      color: #687887;
      font-size: 9pt;
      margin: 3pt 0 10pt;
      break-before: avoid;
    }
    a { color: #1f4d78; text-decoration: none; }
    code { font-family: Consolas, monospace; }
  `;
}

async function buildHtmlFromDocx() {
  const result = await mammoth.convertToHtml(
    { path: docxPath },
    {
      styleMap: [
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => p.subtitle:fresh",
        "p[style-name='Caption'] => p.caption:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
      includeDefaultStyleMap: true,
    },
  );
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(stem)}</title>
      <style>${baseStyles()}</style>
    </head>
    <body>${result.value}</body>
  </html>`;
}

async function buildSourceHtml() {
  const text = await fs.readFile(sourceTextPath, "utf8");
  const codeLines = text.split(/\r?\n/).filter((line) => /^\d{2}:/.test(line));
  if (codeLines.length !== 3000) {
    throw new Error(`Expected 3000 source lines, got ${codeLines.length}`);
  }
  const pages = [];
  for (let index = 0; index < 60; index += 1) {
    const side = index < 30 ? "前 30 页" : "后 30 页";
    const lines = codeLines.slice(index * 50, (index + 1) * 50);
    pages.push(`
      <section class="source-page">
        <div class="source-label">${side} · 第 ${index + 1} 页</div>
        <pre>${lines.map(escapeHtml).join("\n")}</pre>
      </section>
    `);
  }
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(stem)}</title>
      <style>
        @page { size: A4; margin: 12mm 12mm 14mm 12mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; color: #111827; background: #fff; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .source-page {
          width: 100%;
          min-height: 254mm;
          break-after: page;
          page-break-after: always;
        }
        .source-page:last-child { break-after: auto; page-break-after: auto; }
        .source-label {
          font-family: "Microsoft YaHei", "SimSun", sans-serif;
          font-size: 6.5pt;
          line-height: 8pt;
          color: #687887;
          text-align: right;
          margin: 0 0 2mm;
        }
        pre {
          margin: 0;
          font-family: Consolas, "Courier New", monospace;
          font-size: 7.25pt;
          line-height: 10pt;
          white-space: pre;
          overflow: hidden;
        }
      </style>
    </head>
    <body>${pages.join("")}</body>
  </html>`;
}

const isSource = stem.startsWith("03_");
const html = isSource ? await buildSourceHtml() : await buildHtmlFromDocx();
await fs.writeFile(htmlPath, html, "utf8");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`file:///${htmlPath.replaceAll("\\", "/")}`, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width:100%;font:7.5pt 'Microsoft YaHei',sans-serif;color:#687887;text-align:center;">
        织幕长线剧本杀自动化叙事与运营平台软件 V1.0
      </div>`,
    footerTemplate: `
      <div style="width:100%;font:7.5pt 'Microsoft YaHei',sans-serif;color:#687887;text-align:center;">
        第 <span class="pageNumber"></span> 页
      </div>`,
    margin: isSource
      ? { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" }
      : { top: "16mm", right: "16mm", bottom: "17mm", left: "16mm" },
  });
  const pdfBuffer = await fs.readFile(pdfPath);
  process.stdout.write(JSON.stringify({
    docx: docxPath,
    html: htmlPath,
    pdf: pdfPath,
    bytes: pdfBuffer.length,
  }, null, 2));
} finally {
  await browser.close();
}
