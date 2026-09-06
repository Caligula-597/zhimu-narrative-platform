/**
 * P9.4 Hard Quality Blockers — any hit → QUALITY_BLOCKED (no weighted scoring rescue).
 */

import { HARD_BLOCKER_TYPES } from "./content-quality-contracts.js";
import {
  collectPackageTextUnits,
  packageFullText,
  playerRoles,
} from "./content-quality-package-text.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function blocker(type, message, extra = {}) {
  if (!HARD_BLOCKER_TYPES.includes(type)) type = "CANON_CONTRADICTION";
  return {
    type,
    message,
    sectionId: extra.sectionId,
    roleId: extra.roleId,
    stageId: extra.stageId,
    clueId: extra.clueId,
    evidence: asArray(extra.evidence),
  };
}

const PLACEHOLDER_RE = /NEEDS_DETAIL|\{ctx\.[a-zA-Z0-9_.]+\}|\[待补|TODO_WRITE|‹‹未填››/;

/**
 * @param {object} pkg
 * @param {{
 *   truthCulpritId?: string,
 *   forbiddenFactsByRole?: Record<string, string[]>,
 *   requiredPayoffTokens?: string[],
 *   gameRuntimeTruth?: { winnerCount?: number, resolution?: string },
 * }} [opts]
 */
export function detectHardBlockers(pkg, opts = {}) {
  const units = collectPackageTextUnits(pkg);
  const full = packageFullText(pkg);
  const hints = record(pkg?.qualityHints);
  const out = [];

  // Explicit fixture / upstream injected blockers (still validated against allowlist)
  for (const forced of asArray(hints.forceHardBlockers)) {
    if (HARD_BLOCKER_TYPES.includes(forced?.type)) {
      out.push(blocker(forced.type, forced.message || forced.type, forced));
    }
  }

  // Unresolved placeholders
  for (const unit of units) {
    if (PLACEHOLDER_RE.test(unit.text)) {
      const m = unit.text.match(PLACEHOLDER_RE)?.[0];
      out.push(
        blocker("UNRESOLVED_PLACEHOLDER", `正式本仍含未清除占位：${m}`, {
          sectionId: unit.sectionId,
          roleId: unit.roleId,
          stageId: unit.stageId,
          clueId: unit.clueId,
          evidence: [
            {
              sectionId: unit.sectionId,
              roleId: unit.roleId,
              stageId: unit.stageId,
              excerpt: m,
              observation: "占位符不得进入可交付正文",
            },
          ],
        }),
      );
      break;
    }
  }

  // Host cannot run
  const hostText = units.filter((u) => u.kind === "host").map((u) => u.text).join("\n");
  const hostOk =
    /发线索|线索何时|推进下一|进入下一|启动/.test(hostText) &&
    /观察|注意|不要说|不可泄露|后台/.test(hostText);
  if (asArray(pkg?.hostScript?.sections).length && !hostOk) {
    out.push(
      blocker("HOST_CANNOT_RUN", "主持本缺少发线索/推进时机或保密边界，主持人无法直接跑场", {
        sectionId: asArray(pkg.hostScript.sections)[0]?.id,
        evidence: [
          {
            sectionId: asArray(pkg.hostScript.sections)[0]?.id,
            excerpt: hostText.slice(0, 100),
            observation: "缺少可执行的发线索/推进/保密指引",
          },
        ],
      }),
    );
  }

  // Role has no agency
  for (const role of playerRoles(pkg)) {
    const text = asArray(pkg?.roleScripts?.[role.id])
      .map((s) => asArray(s.paragraphs).join("\n"))
      .join("\n");
    const passiveOnly =
      text.length > 40 &&
      /听别人|等待真相|等待主持|没有行动/.test(text) &&
      !/必须|目标|选择|阻止|交易|竞价|确认|试探|隐瞒/.test(text);
    if (passiveOnly || hints.noAgencyRoleIds?.includes(role.id)) {
      out.push(
        blocker("ROLE_HAS_NO_AGENCY", `角色 ${role.id} 缺乏可执行目标与行动空间`, {
          roleId: role.id,
          evidence: [
            {
              roleId: role.id,
              excerpt: text.slice(0, 100),
              observation: "玩家全程被动，删除该角色几乎不影响局势",
            },
          ],
        }),
      );
    }
  }

  // Private info leak
  const forbiddenByRole = {
    ...record(opts.forbiddenFactsByRole),
    ...record(hints.forbiddenFactsByRole),
  };
  for (const [roleId, secrets] of Object.entries(forbiddenByRole)) {
    const text = asArray(pkg?.roleScripts?.[roleId])
      .map((s) => asArray(s.paragraphs).join("\n"))
      .join("\n");
    for (const secret of asArray(secrets)) {
      if (secret && text.includes(secret)) {
        out.push(
          blocker("PRIVATE_INFO_LEAK", `角色 ${roleId} 正文泄漏禁止事实：${secret}`, {
            roleId,
            evidence: [
              {
                roleId,
                excerpt: secret,
                observation: "私本不得提前持有他人秘密/后台真相",
              },
            ],
          }),
        );
      }
    }
  }
  if (/【他人秘密】|HOST_ONLY_TRUTH:/.test(full)) {
    const unit = units.find((u) => u.kind === "role" && /【他人秘密】|HOST_ONLY_TRUTH:/.test(u.text));
    if (unit) {
      out.push(
        blocker("PRIVATE_INFO_LEAK", "角色本出现明确标记的他人秘密/主持专属真相", {
          roleId: unit.roleId,
          sectionId: unit.sectionId,
          evidence: [
            {
              roleId: unit.roleId,
              excerpt: unit.text.match(/【他人秘密】[^。\n]*|HOST_ONLY_TRUTH:[^\n]*/)?.[0],
              observation: "隐私边界被正文直接打破",
            },
          ],
        }),
      );
    }
  }

  // Ending truth mismatch / canon contradiction
  const truthCulprit = cleanId(opts.truthCulpritId || hints.truthCulpritId);
  const endingText = units.filter((u) => u.kind === "ending").map((u) => u.text).join("\n");
  const hostTruth = units.filter((u) => u.kind === "host").map((u) => u.text).join("\n");
  if (truthCulprit) {
    const endingNamesOther = endingText.match(/真凶是([^\s，。；]+)/);
    const hostNames = hostTruth.match(/真凶是([^\s，。；]+)/);
    if (endingNamesOther && endingNamesOther[1] && endingNamesOther[1] !== truthCulprit) {
      out.push(
        blocker("ENDING_TRUTH_MISMATCH", `终局真凶「${endingNamesOther[1]}」与锁定真相「${truthCulprit}」不一致`, {
          sectionId: units.find((u) => u.kind === "ending")?.sectionId,
          evidence: [
            {
              excerpt: endingNamesOther[0],
              observation: "真相已锁定，结局不得改写真凶",
            },
          ],
        }),
      );
    }
    if (
      hostNames &&
      endingNamesOther &&
      hostNames[1] &&
      endingNamesOther[1] &&
      hostNames[1] !== endingNamesOther[1]
    ) {
      out.push(
        blocker("CANON_CONTRADICTION", `主持真相真凶「${hostNames[1]}」与终局「${endingNamesOther[1]}」矛盾`, {
          evidence: [
            { excerpt: hostNames[0], observation: "主持后台真凶" },
            { excerpt: endingNamesOther[0], observation: "终局陈述真凶" },
          ],
        }),
      );
    }
  }
  if (/CANON_CONTRADICTION_MARKER/.test(full)) {
    out.push(blocker("CANON_CONTRADICTION", "正文含 Canon 矛盾标记", {}));
  }

  // Clue logic / unfair inference
  if (hints.clueLogicBroken || /依赖从未出现的证据|关键结论缺少证据/.test(full)) {
    out.push(
      blocker("CLUE_LOGIC_BROKEN", "关键结论依赖从未出现的证据或线索链断裂", {
        evidence: [{ observation: "揭晓无法回溯到已发线索", excerpt: "关键结论缺少证据" }],
      }),
    );
  }
  if (hints.unfairRequiredInference || /玩家无法合理获得的信息/.test(full)) {
    out.push(
      blocker("UNFAIR_REQUIRED_INFERENCE", "正解依赖玩家无法合理获得的信息", {
        evidence: [{ observation: "反转依赖未公开信息", excerpt: "玩家无法合理获得的信息" }],
      }),
    );
  }

  // GAME rule vs narrative
  const runtime =
    record(opts.gameRuntimeTruth).winnerCount != null
      ? record(opts.gameRuntimeTruth)
      : record(hints.gameRuntimeTruth);
  if (runtime.winnerCount === 1 || runtime.winnerCount === "1") {
    if (/前两名都可以|前两名均可|两人都获得|两位获胜者/.test(full)) {
      out.push(
        blocker("GAME_RULE_NARRATIVE_MISMATCH", "叙事写成多名获奖，但 runtimeTruth.winnerCount=1", {
          evidence: [
            {
              excerpt: full.match(/前两名都可以|前两名均可|两人都获得|两位获胜者/)?.[0],
              observation: "不得改写 GAME runtime semantics",
            },
          ],
        }),
      );
    }
  }

  // Dead required game
  if (hints.deadRequiredGame || (/必须完成竞价|本幕必须启动/.test(hostText) && !/结算|获得权限|permission|后果/.test(full))) {
    out.push(
      blocker("DEAD_REQUIRED_GAME", "必须玩的机制结束后对后续内容没有可观察影响", {
        evidence: [{ observation: "玩法结算未改变访问权/关系/线索", excerpt: "必须完成竞价" }],
      }),
    );
  }

  // Missing major payoff
  const payoffTokens = asArray(opts.requiredPayoffTokens || hints.requiredPayoffTokens).filter(Boolean);
  for (const token of payoffTokens) {
    const raisedEarly = units
      .filter((u) => u.kind !== "ending")
      .some((u) => u.text.includes(token));
    const paidInEnding = /真凶|揭晓|原来|回收/.test(endingText) && endingText.includes(token);
    if (raisedEarly && endingText && !paidInEnding && !endingText.includes(token)) {
      out.push(
        blocker("MISSING_MAJOR_PAYOFF", `核心意象/悬念「${token}」提出后终局未兑现`, {
          evidence: [{ observation: "前文强调的物件/承诺未在终局回收", excerpt: token }],
        }),
      );
    }
  }
  if (hints.missingMajorPayoff) {
    out.push(blocker("MISSING_MAJOR_PAYOFF", String(hints.missingMajorPayoffMessage || "核心悬念提出后整本没有回答"), {}));
  }

  // Dedupe by type+message
  const seen = new Set();
  return out.filter((b) => {
    const key = `${b.type}|${b.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanId(value) {
  return String(value ?? "").trim();
}
