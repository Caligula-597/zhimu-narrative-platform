import { list } from "./catalog.js";
import { isPublicSlogan, publicSurfaces } from "./public-context.js";

function compact(text) {
  return String(text || "").replace(/\s+/gu, "");
}

function ngrams(text, size) {
  const body = compact(text);
  const grams = [];
  for (let i = 0; i <= body.length - size; i += 1) grams.push(body.slice(i, i + size));
  return grams;
}

function allowedShared(scripts, publicContext) {
  const allowed = new Set(publicSurfaces(publicContext).map(compact));
  for (const script of list(scripts)) {
    for (const line of list(script.allowedSharedPhrases || script.spokenLines)) {
      if (line) allowed.add(compact(line));
    }
  }
  return [...allowed].filter(Boolean);
}

function isAllowedGram(gram, allowed) {
  return allowed.some((row) => row.includes(gram) || gram.includes(row.slice(0, Math.min(6, row.length))));
}

export function crossRoleSimilarityGate(scripts, publicContext = []) {
  const issues = [];
  const allowed = allowedShared(scripts, publicContext);
  const phraseHits = new Map();
  for (const script of list(scripts)) {
    for (const gram of new Set(ngrams(script.text, 5))) {
      if (isAllowedGram(gram, allowed)) continue;
      if (!phraseHits.has(gram)) phraseHits.set(gram, []);
      phraseHits.get(gram).push(script.characterId || script.name);
    }
    const restated = list(publicContext).filter((row) => {
      const head = compact(row.surface).slice(0, 8);
      return head && compact(script.text).includes(head);
    });
    if (restated.length) {
      issues.push({
        code: "same_public_fact_reexplained_in_private_views",
        characterId: script.characterId,
        excerpt: restated[0].surface
      });
      issues.push({
        code: "cross_role_shared_fact_repetition",
        characterId: script.characterId,
        excerpt: restated[0].surface
      });
    }
  }
  for (const [gram, holders] of phraseHits) {
    const unique = [...new Set(holders)];
    if (gram.length >= 8 && unique.length >= 4) {
      issues.push({
        code: "cross_role_phrase_duplication",
        phrase: gram,
        holders: unique
      });
    }
  }
  const dups = issues.filter((row) => row.code === "cross_role_phrase_duplication");
  const rest = issues.filter((row) => row.code !== "cross_role_phrase_duplication");
  const collapsed = [];
  for (const row of dups.sort((a, b) => b.phrase.length - a.phrase.length)) {
    const key = row.holders.slice().sort().join(",");
    if (collapsed.some((item) => item.holders.slice().sort().join(",") === key && item.phrase.includes(row.phrase))) {
      continue;
    }
    collapsed.push(row);
  }
  issues.length = 0;
  issues.push(...rest, ...collapsed);
  const tideHolders = list(scripts).filter((row) => isPublicSlogan(row.text));
  if (tideHolders.length >= 3) {
    const holders = tideHolders.map((row) => row.characterId || row.name);
    issues.push({
      code: "same_public_fact_reexplained_in_private_views",
      phrase: "潮水不等人",
      holders
    });
    issues.push({
      code: "cross_role_shared_fact_repetition",
      phrase: "潮水不等人",
      holders
    });
    issues.push({
      code: "private_view_homogenization",
      phrase: "潮水不等人",
      holders
    });
  }
  return issues;
}
