import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const materialDir = path.join(root, '软著材料');
const outputDir = path.join(materialDir, '输出');
const outputFile = path.join(outputDir, '源代码交存稿_织幕V1.0.txt');

const softwareName = '织幕长线剧本杀自动化叙事与运营平台软件';
const version = 'V1.0';
const linesPerPage = 50;
const pagesPerSide = 30;
const totalLinesPerSide = linesPerPage * pagesPerSide;

const includeRoots = [
  'backend/src',
  'src',
  'play/src',
  'host/src',
  'shared',
  'backend/migrations',
];

const includeExts = new Set(['.js', '.mjs', '.css', '.html', '.sql']);
const denyPatterns = [
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])dist([\\/]|$)/,
  /(^|[\\/])test-results([\\/]|$)/,
  /(^|[\\/])tmp([\\/]|$)/,
  /(^|[\\/])\.git([\\/]|$)/,
  /(^|[\\/])test([\\/]|$)/,
  /(^|[\\/])tests([\\/]|$)/,
  /\.test\.(js|mjs)$/i,
  /\.spec\.(js|mjs)$/i,
];

function shouldInclude(filePath) {
  const rel = path.relative(root, filePath);
  if (denyPatterns.some((pattern) => pattern.test(rel))) return false;
  return includeExts.has(path.extname(filePath).toLowerCase());
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && shouldInclude(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeLine(line) {
  const redacted = line
    .replace(/(token|secret|password|api[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi, '$1 = "[REDACTED]"')
    .replace(/(postgres|postgresql):\/\/[^\s'"]+/gi, '[REDACTED_DATABASE_URL]');
  return redacted.length > 180 ? `${redacted.slice(0, 180)} ...` : redacted;
}

function readSourceLines() {
  const files = includeRoots.flatMap((relDir) => {
    const baseDir = path.join(root, relDir);
    return walk(baseDir).sort((a, b) => path.relative(baseDir, a).localeCompare(path.relative(baseDir, b)));
  });

  const lines = [];
  for (const file of files) {
    const rel = path.relative(root, file).replaceAll(path.sep, '/');
    const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    lines.push(`// ===== 文件：${rel} =====`);
    for (const line of content.split('\n')) {
      lines.push(normalizeLine(line));
    }
    lines.push(`// ===== 文件结束：${rel} =====`);
    lines.push('');
  }
  return { files, lines };
}

function pageHeader(pageNo, sideLabel) {
  return [
    '',
    `===== ${softwareName} ${version} 源程序鉴别材料 ${sideLabel} 第 ${pageNo} 页 =====`,
    '',
  ];
}

function formatPages(lines, sideLabel, startPageNo) {
  const output = [];
  for (let page = 0; page < pagesPerSide; page += 1) {
    output.push(...pageHeader(startPageNo + page, sideLabel));
    const start = page * linesPerPage;
    const pageLines = lines.slice(start, start + linesPerPage);
    for (let i = 0; i < linesPerPage; i += 1) {
      const lineNo = String(i + 1).padStart(2, '0');
      output.push(`${lineNo}: ${pageLines[i] ?? ''}`);
    }
  }
  return output;
}

fs.mkdirSync(outputDir, { recursive: true });

const { files, lines } = readSourceLines();
if (lines.length < totalLinesPerSide * 2) {
  throw new Error(`源代码行数不足 ${totalLinesPerSide * 2} 行，当前仅 ${lines.length} 行。请改为提交全部代码。`);
}

const firstLines = lines.slice(0, totalLinesPerSide);
const lastLines = lines.slice(-totalLinesPerSide);
const output = [
  `${softwareName} ${version} 源程序鉴别材料`,
  `生成时间：${new Date().toISOString()}`,
  `纳入文件数：${files.length}`,
  `纳入目录：${includeRoots.join('、')}`,
  '说明：本文件为软著普通交存源程序摘录稿，包含前 30 页和后 30 页，每页 50 行。',
  ...formatPages(firstLines, '前30页', 1),
  ...formatPages(lastLines, '后30页', 31),
  '',
];

fs.writeFileSync(outputFile, output.join('\n'), 'utf8');

console.log(`已生成：${outputFile}`);
console.log(`纳入文件数：${files.length}`);
console.log(`源代码总行数：${lines.length}`);
console.log('请提交前人工检查敏感信息和页眉页码。');
