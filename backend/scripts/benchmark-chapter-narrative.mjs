/**
 * Benchmark single-chapter narrative generation (~8000 chars target).
 * Usage: node scripts/benchmark-chapter-narrative.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeepseekChapterNarrative, deepseekConfig } from "../src/deepseek.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [join(root, ".env"), join(root, "..", ".env.staging")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const setting = {
  theme: "实测 · 雾港残信",
  playerCount: 6,
  chapterCount: 5,
  wordsPerChapter: 8000,
  extraConflicts: "家族利益与旧案真相冲突；不要超自然解释。",
  tone: "悬疑调查，节奏紧凑"
};

const synopsis = {
  body: "民国末年一艘货轮在雾港失联后神秘返航。六名与旧案有关的人被召集上船，第一夜发现船长室反锁，窗上有从内部无法完成的指纹。全书五章：登船集结→密室初探→关系撕裂→真相逼近→收束与余波。",
  charactersSketch: "船长（失踪后重现）、轮机长、货主代表、记者、警探后人、神秘乘客",
  truthSketch: "船长未死，利用走私通道假死脱身",
  redHerringsSketch: "看似内鬼的通讯员"
};

async function main() {
  const config = deepseekConfig();
  if (!config.configured) {
    console.error("SKIP: DEEPSEEK_API_KEY not configured");
    process.exit(0);
  }
  console.log(`Benchmark · model=${config.model} · target=${setting.wordsPerChapter} chars/chapter · ch1 (with auto-continuation if needed)`);
  const started = Date.now();
  const result = await createDeepseekChapterNarrative({
    setting,
    synopsis,
    chapterKey: "ch1",
    previousChapters: []
  });
  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
  const ch = result.chapter;
  const len = ch.narrativeBody?.length || 0;
  const pct = ((len / setting.wordsPerChapter) * 100).toFixed(0);
  console.log(`\n── 结果 ──`);
  console.log(`总耗时: ${elapsedSec}s（含可能的续写）`);
  console.log(`maxTokens 估算: ${Math.min(32768, Math.max(8192, Math.ceil(setting.wordsPerChapter * 2.5) + 1500))}`);
  console.log(`标题: ${ch.title}`);
  console.log(`正文: ${len} 字（目标 ${setting.wordsPerChapter}，达成 ${pct}%）`);
  console.log(`摘要: ${(ch.summary || "").slice(0, 80)}…`);
  if (len < setting.wordsPerChapter * 0.45) {
    console.log(`\n⚠ 低于校验阈值（${Math.floor(setting.wordsPerChapter * 0.45)} 字），API 可能因 maxTokens 截断`);
  }
}

main().catch((error) => {
  console.error("\n✗", error.message || error);
  process.exit(1);
});
