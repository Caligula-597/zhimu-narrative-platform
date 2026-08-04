/** Cross-outline fingerprinting and batch diversity acceptance. */

import { throwErr } from "../api-errors.js";

import { BATCH_FINGERPRINT_FIELDS, GENERIC_ENDING_TITLE, GENERIC_TRUST_STATE } from "./constants.js";

import { list, text } from "./primitives.js";

export function normalizedFingerprint(value) {
  return text(value, 240).toLocaleLowerCase("zh-CN").replace(/[\s，。、“”‘’：:；;（）()《》【】\-_]/gu, "");
}

export function fingerprintSimilarity(left, right) {
  const a = normalizedFingerprint(left);
  const b = normalizedFingerprint(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (value) => {
    if (value.length < 2) return new Set([value]);
    return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
  };
  const leftGrams = grams(a);
  const rightGrams = grams(b);
  const intersection = [...leftGrams].filter((gram) => rightGrams.has(gram)).length;
  const union = new Set([...leftGrams, ...rightGrams]).size;
  return union ? intersection / union : 0;
}

export function scoreOutlineFingerprintPair(left, right) {
  const dimensions = Object.fromEntries(BATCH_FINGERPRINT_FIELDS.map((field) => [
    field,
    fingerprintSimilarity(left?.[field] || "", right?.[field] || "")
  ]));
  const scores = Object.values(dimensions);
  return {
    method: "equal-weight mean of normalized-character-bigram-jaccard across 11 dimensions",
    dimensions,
    score: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0
  };
}

/** Cross-outline checks used by bulk generation before an aggregate is accepted. */
export function validateOutlineBatchDiversity(items, {
  throwOnFailure = true,
  historicalItems = [],
  similarityPolicy = {}
} = {}) {
  const outlines = list(items).map((item) => item?.outline || item).filter(Boolean);
  const historicalOutlines = list(historicalItems).map((item) => item?.outline || item).filter(Boolean);
  const issues = [];
  const warnings = [];
  const fieldThreshold = Number.isFinite(Number(similarityPolicy.fieldThreshold))
    ? Math.max(0.5, Math.min(0.99, Number(similarityPolicy.fieldThreshold)))
    : 0.78;
  const compositeThreshold = Number.isFinite(Number(similarityPolicy.compositeThreshold))
    ? Math.max(0.5, Math.min(0.99, Number(similarityPolicy.compositeThreshold)))
    : 0.72;
  const similarityEnforcement = similarityPolicy.enforcement === "reject" ? "reject" : "review";
  const names = new Map();
  const endingTitles = new Map();
  const fingerprintFields = Object.fromEntries(BATCH_FINGERPRINT_FIELDS.map((field) => [field, new Map()]));
  const fingerprintEntries = Object.fromEntries(Object.keys(fingerprintFields).map((field) => [field, []]));
  const compositeEntries = [];
  const currentContributionTypes = new Map();
  const currentNameTailCounts = new Map();
  const currentNameLengthCounts = new Map();
  const suffixSignatures = new Map();
  let currentPlayerCount = 0;
  let currentEvidenceContributionCount = 0;
  let currentGenericTrustStateCount = 0;

  const indexedOutlines = [
    ...outlines.map((outline, index) => ({ outline, index: index + 1, current: true })),
    ...historicalOutlines.map((outline, index) => ({ outline, index: index + 1, current: false }))
  ];
  for (const rowInfo of indexedOutlines) {
    const { outline, index, current } = rowInfo;
    const localCurrentNames = [];
    for (const player of list(outline.players)) {
      const name = text(player?.name, 80);
      if (!name) continue;
      const key = normalizedFingerprint(name);
      const row = names.get(key) || { name, indexes: [], historicalIndexes: [] };
      (current ? row.indexes : row.historicalIndexes).push(index);
      names.set(key, row);
      if (current) {
        const compactName = name.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
        localCurrentNames.push(compactName);
        const tail = [...compactName].at(-1) || "";
        if (tail) currentNameTailCounts.set(tail, (currentNameTailCounts.get(tail) || 0) + 1);
        const length = [...compactName].length;
        currentNameLengthCounts.set(length, (currentNameLengthCounts.get(length) || 0) + 1);
        currentPlayerCount += 1;
        const contributionType = text(player?.contribution?.anchorType, 40);
        if (contributionType) {
          currentContributionTypes.set(
            contributionType,
            (currentContributionTypes.get(contributionType) || 0) + 1
          );
          if (contributionType === "evidence") currentEvidenceContributionCount += 1;
        }
      }
    }
    if (current && localCurrentNames.length) {
      const threeHanNames = localCurrentNames.filter((name) => /^\p{Script=Han}{3}$/u.test(name));
      if (threeHanNames.length === localCurrentNames.length) {
        const middleChars = new Set(threeHanNames.map((name) => [...name][1]));
        const relationshipText = JSON.stringify({
          identities: list(outline.players).map((player) => player?.identity),
          topology: outline.batchFingerprint?.playerRelationshipTopology
        });
        if (middleChars.size === 1 && !/(?:共享辈分字|同宗同辈|宗族共同辈分|同一家族的同辈)/u.test(relationshipText)) {
          issues.push(`当前第 ${index} 篇六名三字名共享同一中间字，且未声明宗族辈分关系，属于机械姓名矩阵`);
        }
      }
      const suffixSignature = localCurrentNames.map((name) => [...name].at(-1) || "").sort().join("|");
      const previousIndexes = suffixSignatures.get(suffixSignature) || [];
      previousIndexes.push(index);
      suffixSignatures.set(suffixSignature, previousIndexes);
    }
    for (const route of list(outline.endingLogic?.routes)) {
      const title = text(route?.title, 160);
      if (!title) continue;
      const key = normalizedFingerprint(title);
      const row = endingTitles.get(key) || { title, indexes: [], historicalIndexes: [] };
      (current ? row.indexes : row.historicalIndexes).push(index);
      endingTitles.set(key, row);
    }
    if (current) {
      for (const state of list(outline.endingLogic?.stateVariables)) {
        if (GENERIC_TRUST_STATE.test(text(state?.key, 80))) currentGenericTrustStateCount += 1;
      }
    }
    for (const field of Object.keys(fingerprintFields)) {
      const rawValue = outline.batchFingerprint?.[field];
      const key = normalizedFingerprint(rawValue);
      if (!key) continue;
      const row = fingerprintFields[field].get(key) || { value: rawValue, indexes: [], historicalIndexes: [] };
      (current ? row.indexes : row.historicalIndexes).push(index);
      fingerprintFields[field].set(key, row);
      fingerprintEntries[field].push({ value: rawValue, index, current });
    }
    compositeEntries.push({
      value: outline.batchFingerprint || {},
      index,
      current
    });
  }

  for (const row of names.values()) {
    const total = row.indexes.length + row.historicalIndexes.length;
    if (row.indexes.length > 1) issues.push(`人物名“${row.name}”在当前批次重复 ${row.indexes.length} 次`);
    else if (row.indexes.length && total > 2) issues.push(`人物名“${row.name}”在当前批次与历史库合计出现 ${total} 次`);
  }
  for (const row of endingTitles.values()) {
    if (GENERIC_ENDING_TITLE.test(row.title)) issues.push(`结局名“${row.title}”属于批量生成模板`);
    if (row.indexes.length > 1) issues.push(`结局名“${row.title}”在当前批次重复 ${row.indexes.length} 次`);
  }
  if (currentPlayerCount && currentEvidenceContributionCount / currentPlayerCount > 0.5) {
    issues.push(`当前批次 evidence 贡献占 ${Math.round((currentEvidenceContributionCount / currentPlayerCount) * 100)}%，超过 50% 上限`);
  }
  const minimumBatchContributionTypes = currentPlayerCount >= 12 ? 5 : Math.min(3, currentPlayerCount);
  if (currentPlayerCount && currentContributionTypes.size < minimumBatchContributionTypes) {
    issues.push(`当前批次只使用了 ${currentContributionTypes.size} 种玩家贡献类型，低于 ${minimumBatchContributionTypes} 种最低要求`);
  }
  if (currentGenericTrustStateCount) {
    issues.push(`当前批次仍出现 ${currentGenericTrustStateCount} 个通用 state-trust 状态`);
  }
  for (const [signature, indexes] of suffixSignatures.entries()) {
    if (signature && indexes.length > 1) issues.push(`当前第 ${indexes.join("、")} 篇循环使用同一组六个姓名尾字，属于批量命名模板`);
  }
  const excessiveTailThreshold = Math.max(8, Math.ceil(currentPlayerCount * 0.08));
  for (const [tail, count] of currentNameTailCounts.entries()) {
    if (count >= excessiveTailThreshold) issues.push(`当前批次姓名尾字“${tail}”出现 ${count} 次，超过反模板阈值 ${excessiveTailThreshold}`);
  }
  const dominantNameLength = [...currentNameLengthCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (currentPlayerCount >= 24 && dominantNameLength && dominantNameLength[1] / currentPlayerCount > 0.82) {
    issues.push(`当前批次 ${Math.round((dominantNameLength[1] / currentPlayerCount) * 100)}% 的角色名长度都为 ${dominantNameLength[0]}，缺少时代化的二字名、三字名、字号与代号混合`);
  }
  const limits = {
    storyEngine: 2,
    antagonistType: 4,
    finalChoiceType: 3,
    themeExpression: 2,
    mysteryObjectType: 3,
    truthRevealMethod: 3,
    playerRelationshipTopology: 2,
    chapterCausalPattern: 2,
    evidenceModalityMix: 3,
    powerStructure: 3,
    endingMechanism: 2,
    existenceStatusMechanism: 1,
    truthKnowledgeDistribution: 2
  };
  for (const [field, rows] of Object.entries(fingerprintFields)) {
    for (const row of rows.values()) {
      const total = row.indexes.length + row.historicalIndexes.length;
      if (row.indexes.length && total > limits[field]) issues.push(`${field}“${row.value}”在当前批次与历史库合计重复 ${total} 次`);
    }
  }
  for (const [field, entries] of Object.entries(fingerprintEntries)) {
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        if (!entries[left].current && !entries[right].current) continue;
        const similarity = fingerprintSimilarity(entries[left].value, entries[right].value);
        if (similarity >= fieldThreshold && normalizedFingerprint(entries[left].value) !== normalizedFingerprint(entries[right].value)) {
          const leftLabel = entries[left].current ? `当前第 ${entries[left].index}` : `历史第 ${entries[left].index}`;
          const rightLabel = entries[right].current ? `当前第 ${entries[right].index}` : `历史第 ${entries[right].index}`;
          const message = `${field} 在${leftLabel}、${rightLabel}篇字符 bigram 指纹过近（${Math.round(similarity * 100)}%）`;
          (similarityEnforcement === "reject" ? issues : warnings).push(message);
        }
      }
    }
  }
  for (let left = 0; left < compositeEntries.length; left += 1) {
    for (let right = left + 1; right < compositeEntries.length; right += 1) {
      if (!compositeEntries[left].current && !compositeEntries[right].current) continue;
      const similarityReport = scoreOutlineFingerprintPair(compositeEntries[left].value, compositeEntries[right].value);
      if (similarityReport.score >= compositeThreshold) {
        const leftLabel = compositeEntries[left].current ? `当前第 ${compositeEntries[left].index}` : `历史第 ${compositeEntries[left].index}`;
        const rightLabel = compositeEntries[right].current ? `当前第 ${compositeEntries[right].index}` : `历史第 ${compositeEntries[right].index}`;
        const message = `批次十一维字符相似度在${leftLabel}、${rightLabel}篇达到 ${Math.round(similarityReport.score * 100)}%，需人工复核是否同构`;
        (similarityEnforcement === "reject" ? issues : warnings).push(message);
      }
    }
  }

  const report = {
    pass: issues.length === 0,
    outlineCount: outlines.length,
    historicalOutlineCount: historicalOutlines.length,
    uniquePlayerNameCount: names.size,
    uniqueEndingTitleCount: endingTitles.size,
    contributionTypeCounts: Object.fromEntries(currentContributionTypes),
    evidenceContributionRatio: currentPlayerCount
      ? Number((currentEvidenceContributionCount / currentPlayerCount).toFixed(3))
      : null,
    genericTrustStateCount: currentGenericTrustStateCount,
    uniqueFingerprints: Object.fromEntries(Object.entries(fingerprintFields).map(([field, rows]) => [field, rows.size])),
    similarity: {
      method: "equal-weight mean of normalized-character-bigram-jaccard across 11 dimensions",
      fieldThreshold,
      compositeThreshold,
      enforcement: similarityEnforcement,
      calibrationStatus: "provisional-until-labeled-pair-calibration"
    },
    warnings,
    issues
  };
  if (issues.length && throwOnFailure) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `批次多样性校验未通过（${issues.length} 项）`, report);
  }
  return report;
}
