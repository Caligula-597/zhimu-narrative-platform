/**
 * RPT #1C — P10.4 projection survival heuristics (read-only).
 * Does NOT replace human P10_4_CHANGE_VERDICT.
 */
import fs from "node:fs";
import path from "node:path";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function textBlob(pkg) {
  const parts = [];
  for (const s of asArray(pkg?.hostScript?.sections)) {
    parts.push(s.title || "", ...asArray(s.paragraphs));
  }
  for (const role of asArray(pkg?.roles)) {
    for (const s of asArray(pkg?.roleScripts?.[role.id])) {
      parts.push(s.title || "", ...asArray(s.paragraphs));
    }
  }
  for (const s of [...asArray(pkg?.publicScripts), ...asArray(pkg?.sharedScripts)]) {
    parts.push(s.title || "", ...asArray(s.paragraphs));
  }
  for (const c of asArray(pkg?.clues)) {
    parts.push(c.title || "", ...asArray(c.paragraphs));
  }
  return parts.join("\n");
}

function roleScriptBlob(pkg, characterName) {
  const role = asArray(pkg?.roles).find((r) => r.name === characterName);
  if (!role) return "";
  const sections = asArray(pkg?.roleScripts?.[role.id]);
  return sections.flatMap((s) => [s.title || "", ...asArray(s.paragraphs)]).join("\n");
}

const SLOT_RE = /\b(bargainA|bargainB|stakeholder|witness|secretKeeper|targetA|resourceHolder)\b/g;
const CONCRETE_STAKE = /预展目录册|目录册|名录|腕带|授权日志|库房/;
const MOTIVE_HINT = /(为什么|为了|想要|不愿|不肯|底线|代价|换取|保护|公开)/;
const TERMS_HINT = /(条件|开价|代价|秘密|承认|交出|换|否则|如果.*就)/;
const EXCHANGE_PLAYER = /(你.*选择|你可以|接受|拒绝|改写|提出|回应|谈判)/;
const EXCHANGE_NARRATION = /(完成了换手|已经换手|标的.*已|自动.*成交)/;
const AFTERMATH_HINT = /(关系|知情|敌对|合作|权限|失去|公开|后果|之后)/;
const M07_OWNER_ARC = /(隐藏.*身份|等待.*封存|核对.*身份|公开.*身份|身份表象|真实身份)/g;

/**
 * @param {{ package?: object, storyState?: object, candidatePlan?: object, projectionAudit?: object }} input
 */
export function probeP104ProjectionSurvival(input) {
  const pkg = input.package || {};
  const state = input.storyState || {};
  const plan = input.candidatePlan || {};
  const audit = input.projectionAudit || null;
  const blocks = asArray(state.mechanismBlocks).filter((b) => b.status === "USER_ACCEPTED");
  const m12 = blocks.find((b) => b.templateId === "M12-1");
  const blob = textBlob(pkg);
  const fangXu = roleScriptBlob(pkg, "方序");
  const guQing = roleScriptBlob(pkg, "顾清");

  const slotLeaks = [...blob.matchAll(SLOT_RE)].map((m) => m[0]);
  const guQingOwnerHits = [...guQing.matchAll(M07_OWNER_ARC)].map((m) => m[0]);
  const fangXuOwnerHits = [...fangXu.matchAll(M07_OWNER_ARC)].map((m) => m[0]);

  return {
    version: 1,
    trialId: "RPT-1C",
    readOnly: true,
    note: "启发式探针，非正式 P10_4_CHANGE_VERDICT；人工须完成六项 Survival",
    preWriter: {
      recommendationStatus: plan.recommendationStatus || null,
      recommendedBundle: plan.recommendedBundle?.blockTemplateIds || null,
      projectionAuditStatus: audit?.status || null,
      projectionAuditOk: audit?.ok ?? null,
    },
    acceptedBlocks: blocks.map((b) => b.templateId),
    hasM12: Boolean(m12),
    sixChecks: {
      slotSurvival: {
        leakCount: slotLeaks.length,
        samples: [...new Set(slotLeaks)].slice(0, 8),
        heuristicPass: slotLeaks.length === 0,
      },
      stakeSurvival: {
        concreteStakeLexicon: CONCRETE_STAKE.test(blob),
        heuristicPass: CONCRETE_STAKE.test(blob),
      },
      motivationSurvival: {
        lexicon: MOTIVE_HINT.test(blob),
        heuristicPass: MOTIVE_HINT.test(blob),
        note: "机器只查动机词面；剧情内具体化须人工（库房/承认昨晚等）",
      },
      termsSurvival: {
        lexicon: TERMS_HINT.test(blob),
        stillTemplateSmell: /提出交换代价|提出交换条件|完成换手/.test(blob),
        heuristicPass: TERMS_HINT.test(blob),
        note: "区分模板摘要 vs 美术馆实例化须人工",
      },
      exchangeSurvival: {
        playerAgencyLexicon: EXCHANGE_PLAYER.test(blob),
        narrationSmell: EXCHANGE_NARRATION.test(blob),
        heuristicPass: EXCHANGE_PLAYER.test(blob),
      },
      aftermathSurvival: {
        lexicon: AFTERMATH_HINT.test(blob),
        heuristicPass: AFTERMATH_HINT.test(blob),
      },
    },
    roleScope: {
      guQingOwnerArcHits: guQingOwnerHits.length,
      fangXuOwnerArcHits: fangXuOwnerHits.length,
      fangXuLikelyInheritedOwnerArc:
        fangXuOwnerHits.length >= 3 && fangXuOwnerHits.length >= guQingOwnerHits.length - 1,
      heuristicPass: fangXuOwnerHits.length < 3,
      note: "方序若仍出现完整隐藏→等待→核对→公开链，视为 ROLE_SCOPE 未穿到正文",
    },
    survivalChecklistForHuman: [
      "1. Slot survival：正文 0 个 bargainA/bargainB/…",
      "2. Stake survival：核心谈判始终知道争的是哪一个具体东西",
      "3. Motivation survival：沈岚为何要、梁赫为何不愿给，玩家读得出来（是否实例化到本馆）",
      "4. Terms survival：具体开价 + 可接受/反提（非「提出交换条件」）",
      "5. Exchange survival：玩家真能响应，非旁白宣布成交",
      "6. Aftermath survival：不同选择至少改变一个关系/信息/权限状态",
      "7. Role scope：方序不再复制顾清完整 M07 OWNER 线",
    ],
    changeVerdictSlots: {
      SYSTEM_VERDICT: null,
      P10_4_CHANGE_VERDICT: null,
      P10_4_CHANGE_PASS: null,
    },
  };
}

export function writeP104SurvivalPacket(outDir, input) {
  const probe = probeP104ProjectionSurvival(input);
  const file = path.join(outDir, "p10-4-projection-survival-probe.json");
  fs.writeFileSync(file, `${JSON.stringify(probe, null, 2)}\n`, "utf8");
  return probe;
}
