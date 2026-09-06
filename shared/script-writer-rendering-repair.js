/**
 * P10.5.1 — Section-Scoped Adherence Repair (one-shot).
 * Semantic repair contract only — not Voice / Writer V2.
 */

import {
  diffPackageRenderingAgainstGrounded,
  RENDERING_ADHERENCE_CODES,
} from "./script-writer-rendering-adherence-diff.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value, maximum = 400) {
  return String(value ?? "").trim().slice(0, maximum);
}

function unique(list) {
  return [...new Set(asArray(list).filter(Boolean))];
}

function primaryCapture(groundedExperience, packetCaptures) {
  return (
    asArray(groundedExperience?.captures)[0] ||
    asArray(packetCaptures)[0] ||
    null
  );
}

function nameSet(capture) {
  const roles = record(capture?.roles);
  const exchange = record(capture?.exchange);
  return {
    seeker: cleanText(roles.seeker, 40),
    holder: cleanText(roles.holder, 40),
    beforeOwner: cleanText(String(exchange.beforeOwner || "").replace(/\s*独占$/, ""), 40),
    afterOwner: cleanText(String(exchange.afterOwner || "").replace(/\s*独占$/, ""), 40),
    stake: cleanText(capture?.stake, 80),
  };
}

function sectionText(sectionState) {
  return asArray(sectionState?.result?.sections)
    .flatMap((s) => asArray(s.paragraphs))
    .join("\n");
}

/**
 * Map adherence issues → Writer job keys (role:P1, public:act3, host, …).
 */
export function selectJobsForAdherenceRepair({
  issues = [],
  packetSet = null,
  sectionStates = [],
} = {}) {
  /** @type {Map<string, object[]>} */
  const byKey = new Map();
  const add = (jobKey, iss) => {
    if (!jobKey) return;
    if (!byKey.has(jobKey)) byKey.set(jobKey, []);
    byKey.get(jobKey).push(iss);
  };

  for (const iss of asArray(issues)) {
    if (iss.characterId) {
      add(`role:${iss.characterId}`, iss);
      continue;
    }
    if (iss.sectionHint === "HOST_SCRIPT") {
      add("host", iss);
      continue;
    }
    // PUBLIC / unscoped: match evidence against public section states
    const evidence = cleanText(iss.evidence, 80);
    let matched = false;
    for (const st of asArray(sectionStates)) {
      if (st.packetKind !== "PUBLIC_STAGE" && st.sectionId !== "host") continue;
      if (iss.sectionHint === "PUBLIC_STAGE" && st.packetKind !== "PUBLIC_STAGE") continue;
      const text = sectionText(st);
      if (!evidence || text.includes(evidence)) {
        add(st.sectionId, iss);
        matched = true;
      }
    }
    if (!matched && (iss.sectionHint === "PUBLIC_STAGE" || iss.code === "INTERNAL_INSTRUCTION_LEAK")) {
      for (const p of asArray(packetSet?.publicStages)) {
        add(`public:${p.stageId}`, iss);
      }
    }
    if (!matched && iss.code === "CHOICE_PRE_RESOLVED" && !iss.characterId) {
      for (const st of asArray(sectionStates)) {
        if (st.packetKind === "PUBLIC_STAGE" || st.packetKind === "HOST_SCRIPT") {
          add(st.sectionId, iss);
        }
      }
    }
  }

  return [...byKey.entries()].map(([jobKey, jobIssues]) => ({
    jobKey,
    issues: jobIssues,
    codes: unique(jobIssues.map((i) => i.code)),
  }));
}

/**
 * Build semantic repair contract for one failed job.
 */
export function buildSectionRepairBrief({
  issues = [],
  packetCapture = null,
  characterName = null,
  packetKind = null,
  previousParagraphs = null,
} = {}) {
  const names = packetCapture ? nameSet(packetCapture) : {};
  const codes = unique(asArray(issues).map((i) => i.code)).filter((c) =>
    RENDERING_ADHERENCE_CODES.includes(c),
  );
  const mustKeep = [];
  const openChoices = [];
  const forbid = [];
  const repairPrinciples = [];

  if (codes.includes("RELATION_INVERTED") || packetCapture) {
    if (names.holder) mustKeep.push(`holder = ${names.holder}`);
    if (names.seeker) mustKeep.push(`seeker = ${names.seeker}`);
    if (names.stake) mustKeep.push(`stake = ${names.stake}`);
    if (names.beforeOwner) mustKeep.push(`beforeOwner = ${names.beforeOwner}`);
    if (names.afterOwner) mustKeep.push(`afterOwner = ${names.afterOwner}`);
  }
  if (codes.includes("RELATION_INVERTED")) {
    repairPrinciples.push("RELATION_INVERTED → 强制关系映射重写");
    if (names.seeker && names.stake) {
      forbid.push(`把「${names.stake}」初始所有权写给${names.seeker}`);
    }
    if (names.holder && names.seeker) {
      mustKeep.push(`${names.holder} 开场掌握；${names.seeker} 需求方`);
    }
  }
  if (codes.includes("CHOICE_PRE_RESOLVED")) {
    repairPrinciples.push("CHOICE_PRE_RESOLVED → 改成开放动作节点，不得写结果已经发生");
    if (names.seeker) {
      openChoices.push(`${names.seeker}可以接受 / 反提 / 拒绝`);
    } else {
      openChoices.push("玩家可以接受 / 反提 / 拒绝");
    }
    forbid.push("替玩家宣布最终成交");
    forbid.push("写「最终点头」「无论选择为何交接完成」「无论过程如何达成协议」");
  }
  if (codes.includes("ROLE_SCOPE_INVENTED")) {
    repairPrinciples.push(
      "ROLE_SCOPE_INVENTED → 删除/重写越权 OWNER 体验，只保留 participant/observer 内容",
    );
    forbid.push("把他人 OWNER 的目标/核对自己身份/公开自己身份整条写给本角色");
    forbid.push("本角色不得成为议价持有人或独立完成目录册换手的主角");
    mustKeep.push("允许：观察相关行为发生");
    mustKeep.push("禁止：继承 OWNER 的决策与身份主线");
  }
  if (codes.includes("INTERNAL_INSTRUCTION_LEAK")) {
    repairPrinciples.push(
      "INTERNAL_INSTRUCTION_LEAK → 重写成正常玩家文本（禁止简单字符串删除前缀）",
    );
    forbid.push("出现「玩家可见」「仅同场，不暗示因果」「本幕不揭示」「本段不改变」等内部指令");
  }

  forbid.push("不得改写 Grounded Packet 中的 ownership / role scope / stake 事实");
  forbid.push("不得新增 Canon / 人物 / 幕");

  const who = cleanText(characterName, 40) || "本段角色";
  const proseLines = [
    `SEMANTIC REPAIR ONLY for ${who} (${packetKind || "section"}).`,
    "Fidelity to Grounded Packet — not literary style / Voice V2.",
    "",
    "必须保持：",
    ...unique(mustKeep).map((l) => `- ${l}`),
    "",
    "开放选择：",
    ...(openChoices.length ? openChoices.map((l) => `- ${l}`) : ["- （无额外开放项）"]),
    "",
    "禁止：",
    ...unique(forbid).map((l) => `- ${l}`),
    "",
    "Issue evidence:",
    ...asArray(issues)
      .slice(0, 6)
      .map((i) => `- ${i.code}: ${i.evidence || i.message}`),
    "",
    "Rewrite the FULL section(s) for this packet. Do not patch by deleting prefixes only.",
  ];

  return {
    version: 1,
    kind: "RENDERING_ADHERENCE_REPAIR",
    packetKind: packetKind || null,
    characterName: characterName || null,
    issueCodes: codes,
    evidence: unique(asArray(issues).map((i) => i.evidence)),
    mustKeep: unique(mustKeep),
    openChoices: unique(openChoices),
    forbid: unique(forbid),
    repairPrinciples,
    previousParagraphs: previousParagraphs
      ? asArray(previousParagraphs).map((p) => cleanText(p, 800)).slice(0, 24)
      : null,
    prose: proseLines.join("\n"),
  };
}

/**
 * One-shot repair of failed sections. max 1 regenerate per jobKey.
 */
export async function runSectionScopedAdherenceRepair({
  production,
  writer,
  regenerateJob,
  issues = null,
  contextProfile = null,
  gameNarrativePlan = null,
  maxRepairsPerSection = 1,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof regenerateJob !== "function") {
    throw new Error("regenerateJob required");
  }
  const packetSet = production?.packetSet;
  const groundedExperience = packetSet?.groundedExperience;
  const capture = primaryCapture(groundedExperience, production?.projectionAudit?.packetCaptures);

  const adherenceBefore =
    issues != null
      ? {
          status: "RENDERING_REVIEW_REQUIRED",
          ok: false,
          issues: asArray(issues),
          codes: unique(asArray(issues).map((i) => i.code)),
        }
      : diffPackageRenderingAgainstGrounded({
          package: production.package,
          groundedExperience,
          packetCaptures: production?.projectionAudit?.packetCaptures,
        });

  if (adherenceBefore.ok) {
    return {
      production,
      adherenceBefore,
      adherenceAfter: adherenceBefore,
      repairLog: [],
      status: "RENDERING_PASS",
      skipped: true,
      reason: "already_clean",
    };
  }

  const targets = selectJobsForAdherenceRepair({
    issues: adherenceBefore.issues,
    packetSet,
    sectionStates: production.sectionStates,
  });

  let productionNext = production;
  const repairLog = [];
  const repairedKeys = new Set();

  for (const target of targets) {
    if (repairedKeys.has(target.jobKey)) continue;
    if (maxRepairsPerSection < 1) continue;
    repairedKeys.add(target.jobKey);

    const prev = asArray(productionNext.sectionStates).find((s) => s.sectionId === target.jobKey);
    const characterName =
      target.issues.find((i) => i.characterName)?.characterName ||
      prev?.packet?.characterName ||
      null;
    const packetKind = prev?.packetKind || null;
    const previousParagraphs = asArray(prev?.result?.sections).flatMap((s) =>
      asArray(s.paragraphs),
    );

    const brief = buildSectionRepairBrief({
      issues: target.issues,
      packetCapture: capture,
      characterName,
      packetKind,
      previousParagraphs,
    });

    const regenerated = await regenerateJob({
      production: productionNext,
      jobKey: target.jobKey,
      writer,
      contextProfile,
      gameNarrativePlan,
      repairBrief: brief,
      groundedExperience,
      now,
    });

    const nextState = asArray(regenerated.sectionStates).find((s) => s.sectionId === target.jobKey);
    repairLog.push({
      jobKey: target.jobKey,
      codes: target.codes,
      characterName,
      repairAttempt: 1,
      maxAttempts: maxRepairsPerSection,
      sectionStatus: nextState?.status || null,
      briefIssueCodes: brief.issueCodes,
    });
    productionNext = regenerated;
  }

  const adherenceAfter = diffPackageRenderingAgainstGrounded({
    package: productionNext.package,
    groundedExperience,
    packetCaptures: productionNext?.projectionAudit?.packetCaptures || production?.projectionAudit?.packetCaptures,
  });

  // Attach diagnostics if still failing
  let pkg = productionNext.package;
  if (!adherenceAfter.ok) {
    pkg = {
      ...pkg,
      status: pkg.status === "INVALID" || pkg.status === "BLOCKED" ? pkg.status : "READY_FOR_REVIEW",
      diagnostics: [
        ...asArray(pkg.diagnostics).filter((d) => d.code !== "RENDERING_REVIEW_REQUIRED"),
        ...adherenceAfter.issues,
        {
          code: "RENDERING_REVIEW_REQUIRED",
          message: `P10.5.1 after one-shot repair still failing: ${adherenceAfter.codes.join(",")}`,
          severity: "review",
          lane: "rendering",
          summary: adherenceAfter.summary,
        },
      ],
    };
  } else {
    pkg = {
      ...pkg,
      diagnostics: asArray(pkg.diagnostics).filter(
        (d) => d.code !== "RENDERING_REVIEW_REQUIRED" && d.lane !== "rendering",
      ),
    };
  }

  return {
    production: {
      ...productionNext,
      package: pkg,
      renderingAdherence: adherenceAfter,
    },
    adherenceBefore,
    adherenceAfter,
    repairLog,
    status: adherenceAfter.ok ? "RENDERING_PASS" : "RENDERING_REVIEW_REQUIRED",
    skipped: false,
  };
}
