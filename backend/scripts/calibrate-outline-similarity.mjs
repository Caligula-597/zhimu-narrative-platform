import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { scoreOutlineFingerprintPair } from "../src/outline-quality-validator.js";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: node scripts/calibrate-outline-similarity.mjs <labeled-pairs.json>");
}

const payload = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
if (!pairs.length) throw new Error("The calibration file must contain a non-empty pairs array");

const allowedLabels = new Set(["same", "partial", "different"]);
const rows = pairs.map((pair, index) => {
  if (!allowedLabels.has(pair?.label)) {
    throw new Error(`pairs[${index}].label must be same, partial, or different`);
  }
  const report = scoreOutlineFingerprintPair(pair.leftFingerprint, pair.rightFingerprint);
  return {
    id: pair.id || `pair-${index + 1}`,
    label: pair.label,
    score: report.score,
    dimensions: report.dimensions
  };
});

const thresholds = [0.65, 0.7, 0.72, 0.75, 0.8];

function metrics(threshold, positiveLabels) {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const row of rows) {
    const expectedPositive = positiveLabels.has(row.label);
    const predictedPositive = row.score >= threshold;
    if (expectedPositive && predictedPositive) truePositive += 1;
    else if (!expectedPositive && predictedPositive) falsePositive += 1;
    else if (!expectedPositive && !predictedPositive) trueNegative += 1;
    else falseNegative += 1;
  }
  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null;
  const falsePositiveRate = falsePositive + trueNegative ? falsePositive / (falsePositive + trueNegative) : null;
  return {
    threshold,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    precision,
    recall,
    falsePositiveRate
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  sampleCount: rows.length,
  labelCounts: Object.fromEntries(["same", "partial", "different"].map((label) => [
    label,
    rows.filter((row) => row.label === label).length
  ])),
  method: "equal-weight mean of normalized-character-bigram-jaccard across 11 dimensions",
  strictSameDetection: thresholds.map((threshold) => metrics(threshold, new Set(["same"]))),
  broadSimilarityDetection: thresholds.map((threshold) => metrics(threshold, new Set(["same", "partial"]))),
  scoredPairs: rows
};

console.log(JSON.stringify(result, null, 2));
