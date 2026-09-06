/**
 * Build M12 Fidelity Survival probe notes from RPT #1B artifacts (read-only heuristics).
 * Does NOT replace human CHANGE_VERDICT.
 */
import fs from "node:fs";
import path from "node:path";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function textBlob(pkg) {
  const parts = [];
  for (const s of asArray(pkg?.hostScript?.sections)) {
    parts.push(s.title || "", ...(asArray(s.paragraphs)));
  }
  for (const role of asArray(pkg?.roles)) {
    for (const s of asArray(pkg?.roleScripts?.[role.id])) {
      parts.push(s.title || "", ...(asArray(s.paragraphs)));
    }
  }
  for (const s of [...asArray(pkg?.publicScripts), ...asArray(pkg?.sharedScripts)]) {
    parts.push(s.title || "", ...(asArray(s.paragraphs)));
  }
  for (const c of asArray(pkg?.clues)) {
    parts.push(c.title || "", ...(asArray(c.paragraphs)));
  }
  return parts.join("\n");
}

const ABSTRACT_STAKE = /(真相|秘密|筹码|命运|一切)/g;
const TRANSFER_NARRATION = /(转交|落到了|最终到了|后来.*手中|资料.*转)/;
const NEGOTIATE_HINT = /(谈判|交换|条件|代价|开价|成交|换取|交易)/;
const OWNER_HINT = /(掌握|持有|交给|拿到|权限|名录|目录|腕带|钥匙|授权)/;

/**
 * @param {{ package?: object, storyState?: object, candidatePlan?: object }} input
 */
export function probeM12FidelitySurvival(input) {
  const pkg = input.package || {};
  const state = input.storyState || {};
  const plan = input.candidatePlan || {};
  const blocks = asArray(state.mechanismBlocks).filter((b) => b.status === "USER_ACCEPTED");
  const m12 = blocks.find((b) => b.templateId === "M12-1");
  const acceptedIds = blocks.map((b) => b.templateId);
  const blob = textBlob(pkg);

  const stakeFromBlock =
    m12?.plotBindings?.contestedStake?.value ||
    m12?.plotBindings?.contestedStake ||
    m12?.slots?.contestedStake ||
    null;

  const abstractHits = [...blob.matchAll(ABSTRACT_STAKE)].map((m) => m[0]).slice(0, 8);
  const hasNegotiateLexicon = NEGOTIATE_HINT.test(blob);
  const hasOwnerLexicon = OWNER_HINT.test(blob);
  const hasNarrationTransfer = TRANSFER_NARRATION.test(blob);
  const hasCrimeCaptureLexicon = /(真凶|凶手|案发现场|嫁祸)/.test(blob);
  const hasFactionLexicon = /(阵营|隐营|暗号)/.test(blob);

  return {
    version: 1,
    readOnly: true,
    note: "启发式探针，非正式 CHANGE_VERDICT；人工须完成五项 + Survival 五问",
    preWriter: {
      recommendationStatus: plan.recommendationStatus || null,
      recommendedBundle: plan.recommendedBundle?.blockTemplateIds || null,
    },
    acceptedBlocks: acceptedIds,
    hasM12: Boolean(m12),
    plotStakeHint: stakeFromBlock,
    heuristics: {
      abstractStakeHits: abstractHits,
      negotiateLexicon: hasNegotiateLexicon,
      ownershipLexicon: hasOwnerLexicon,
      narrationTransferSmell: hasNarrationTransfer,
      crimeCaptureSmell: hasCrimeCaptureLexicon,
      factionSmell: hasFactionLexicon,
    },
    survivalChecklistForHuman: [
      "1. contestedStake 是否具体？",
      "2. 开场谁掌握？",
      "3. 谁为何想得到？",
      "4. 玩家间谈判/交换（非旁白）？",
      "5. 换手后是否改变后续选择/权限/关系？",
    ],
    changeVerdictSlots: {
      SYSTEM_VERDICT: null,
      CHANGE_VERDICT: null,
      P10_3_CHANGE_PASS: null,
    },
  };
}

export function writeM12SurvivalPacket(outDir, input) {
  const probe = probeM12FidelitySurvival(input);
  const file = path.join(outDir, "m12-fidelity-survival-probe.json");
  fs.writeFileSync(file, `${JSON.stringify(probe, null, 2)}\n`, "utf8");
  return probe;
}
