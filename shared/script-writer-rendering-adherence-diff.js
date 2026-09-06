/**
 * P10.5 — Writer Rendering Adherence Diff (Packet → Final Text).
 * Read-only semantic gate. Not Voice / Writer V2.
 *
 * Closed issue codes:
 *   RELATION_INVERTED
 *   ROLE_SCOPE_INVENTED
 *   CHOICE_PRE_RESOLVED
 *   INTERNAL_INSTRUCTION_LEAK
 */

export const RENDERING_ADHERENCE_CODES = Object.freeze([
  "RELATION_INVERTED",
  "ROLE_SCOPE_INVENTED",
  "CHOICE_PRE_RESOLVED",
  "INTERNAL_INSTRUCTION_LEAK",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanText(value, maximum = 400) {
  return String(value ?? "").trim().slice(0, maximum);
}

function issue(code, message, extra = {}) {
  return { code, message, severity: "review", lane: "rendering", ...extra };
}

const INSTRUCTION_LEAK_RES = Object.freeze([
  /玩家可见\s*[：:]/,
  /仅同场[，,]?\s*不暗示因果/,
  /不暗示因果/,
  /本幕不揭示/,
  /本段不改变/,
  /本段不改变要约/,
  /<<<PACKET_JSON>>>/,
  /NEEDS_DETAIL/,
  /roleInBeat|sourceOutlineBeatId|packetKind/,
]);

const CHOICE_PRE_RESOLVED_RES = Object.freeze([
  /最终点头/,
  /无论过程如何[，,]?\s*你们达成/,
  /无论选择为何[，,]?.*交接完成/,
  /无论选择为何[，,]?.*取得/,
  /对方犹豫片刻[，,]?\s*最终点头/,
  /无论怎么谈.*达成协议/,
]);

const STAKE_HOLD_RES = Object.freeze([
  /手中(?:的筹码[：:]?)?(?:那本)?(?:未公开的)?预展目录册/,
  /握有(?:一份关键筹码[——\-]*)?(?:未公开的)?预展目录册/,
  /你(?:自己)?手中.*目录册/,
  /目录册.*在你(?:手中|手里)/,
  /你并不想轻易交出(?:它|目录册)/,
  /将(?:未公开的)?预展目录册交到对方/,
  /把(?:那份|这份)?(?:未公开的)?预展目录册.*给/,
  /从随身.*取出.*目录册/,
]);

const M12_OWNER_NEGOTIATE_RES = Object.freeze([
  /提出交换代价/,
  /完成(?:了)?交接/,
  /接受或改写/,
  /目录册.*腕带|腕带.*目录册/,
]);

const M07_OWNER_IDENTITY_RES = Object.freeze([
  /核对.*(?:身份|档案)/,
  /公开(?:真实)?身份|是否公开/,
  /住户登记档案/,
  /身份公开后/,
  /翻开那份.*档案|翻阅着纸页/,
]);

function paragraphsOf(result) {
  return asArray(result?.sections)
    .flatMap((s) => asArray(s.paragraphs))
    .map((p) => String(p || ""))
    .filter(Boolean);
}

function textOfResult(result) {
  return paragraphsOf(result).join("\n");
}

function matchAny(text, res) {
  const hits = [];
  for (const re of res) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

function primaryCapture(groundedExperience = null, packetCaptures = null) {
  const fromSet = asArray(groundedExperience?.captures)[0];
  if (fromSet) return fromSet;
  const fromAudit = asArray(packetCaptures)[0];
  if (fromAudit) return fromAudit;
  const byTpl = record(groundedExperience?.byTemplate);
  return byTpl["M12-1"]?.packetCapture || null;
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

/**
 * Per Writer job: check this section's prose against grounded capture.
 */
export function diffWriterRenderingAgainstGroundedPacket({
  packetKind = null,
  packet = null,
  result = null,
  groundedExperience = null,
  packetCaptures = null,
  characterName = null,
} = {}) {
  const issues = [];
  const capture = primaryCapture(groundedExperience, packetCaptures);
  const text = textOfResult(result);
  if (!text) {
    return {
      status: "CLEAN",
      ok: true,
      issues: [],
      codes: [],
    };
  }

  const leakHits = matchAny(text, INSTRUCTION_LEAK_RES);
  for (const hit of leakHits) {
    issues.push(
      issue("INTERNAL_INSTRUCTION_LEAK", `玩家正文出现内部指令语言「${hit}」`, {
        sectionHint: packetKind,
        characterId: packet?.characterId || null,
        characterName,
        evidence: hit,
      }),
    );
  }

  const choiceHits = matchAny(text, CHOICE_PRE_RESOLVED_RES);
  for (const hit of choiceHits) {
    issues.push(
      issue("CHOICE_PRE_RESOLVED", `Writer 提前宣布成交/跳过玩家选择「${hit}」`, {
        sectionHint: packetKind,
        characterId: packet?.characterId || null,
        characterName,
        evidence: hit,
      }),
    );
  }

  if (capture && packetKind === "ROLE_SCRIPT") {
    const names = nameSet(capture);
    const who = cleanText(characterName || packet?.characterName, 40);
    const holdHits = matchAny(text, STAKE_HOLD_RES);

    // Seeker must not be written as opening holder of the stake.
    if (who && names.seeker && who === names.seeker && holdHits.length) {
      const expectedHolder = names.holder || names.beforeOwner || "holder";
      issues.push(
        issue(
          "RELATION_INVERTED",
          `${who} section: expected holder=${expectedHolder} · written as stake holder`,
          {
            characterName: who,
            characterId: packet?.characterId || null,
            expectedHolder,
            writtenHolder: who,
            evidence: holdHits[0],
            stake: names.stake,
          },
        ),
      );
    }

    // Non-primary roles inventing M12 OWNER negotiation
    const isPrimary =
      who && (who === names.seeker || who === names.holder || who === names.beforeOwner);
    if (who && !isPrimary) {
      const m12Hits = matchAny(text, M12_OWNER_NEGOTIATE_RES);
      const holdAsOwner = holdHits.length > 0;
      if (holdAsOwner && m12Hits.length >= 2) {
        issues.push(
          issue("ROLE_SCOPE_INVENTED", `${who}: M12 owner negotiation invented`, {
            characterName: who,
            characterId: packet?.characterId || null,
            evidence: [...holdHits.slice(0, 1), ...m12Hits.slice(0, 2)].join(" | "),
          }),
        );
      }
      const m07Hits = matchAny(text, M07_OWNER_IDENTITY_RES);
      if (m07Hits.length >= 3) {
        issues.push(
          issue("ROLE_SCOPE_INVENTED", `${who}: M07 identity-owner action invented`, {
            characterName: who,
            characterId: packet?.characterId || null,
            evidence: m07Hits.slice(0, 3).join(" | "),
          }),
        );
      }
    }
  }

  if (capture && (packetKind === "PUBLIC_STAGE" || packetKind === "HOST_SCRIPT")) {
    const choiceHitsPub = matchAny(text, CHOICE_PRE_RESOLVED_RES);
    // already added above; also flag "无论选择为何…取得腕带" style on public
    if (/无论选择为何/.test(text) && /交接完成|取得/.test(text)) {
      if (!choiceHitsPub.length) {
        issues.push(
          issue("CHOICE_PRE_RESOLVED", "公共/主持稿使选择不再决定成交", {
            sectionHint: packetKind,
            evidence: cleanText(text.match(/无论选择为何[^。]{0,40}/)?.[0] || "无论选择为何", 80),
          }),
        );
      }
    }
  }

  const codes = [...new Set(issues.map((i) => i.code))];
  const status = issues.length ? "REVIEW_REQUIRED" : "CLEAN";
  return {
    status,
    ok: issues.length === 0,
    issues,
    codes,
    renderingReviewRequired: issues.length > 0,
  };
}

/**
 * Package-wide scan (cross-role invent + leaks) using Final Text.
 */
export function diffPackageRenderingAgainstGrounded({
  package: pkg = null,
  groundedExperience = null,
  packetCaptures = null,
} = {}) {
  const capture = primaryCapture(groundedExperience, packetCaptures);
  const issues = [];
  const names = capture ? nameSet(capture) : { seeker: "", holder: "", beforeOwner: "", afterOwner: "", stake: "" };

  const roleEntries = asArray(pkg?.roles).filter((r) => r?.type !== "HOST");
  for (const role of roleEntries) {
    const characterName = cleanText(role.name, 40);
    const characterId = role.characterId || null;
    const sections = asArray(pkg?.roleScripts?.[role.id]);
    const text = sections.flatMap((s) => asArray(s.paragraphs)).join("\n");
    if (!text) continue;

    const fakeResult = { sections: [{ paragraphs: [text] }] };
    const per = diffWriterRenderingAgainstGroundedPacket({
      packetKind: "ROLE_SCRIPT",
      packet: { characterId, characterName },
      result: fakeResult,
      groundedExperience,
      packetCaptures: capture ? [capture] : packetCaptures,
      characterName,
    });
    issues.push(...per.issues);

    // Explicit: seeker as holder
    if (characterName === names.seeker && matchAny(text, STAKE_HOLD_RES).length) {
      if (!issues.some((i) => i.code === "RELATION_INVERTED" && i.characterName === characterName)) {
        issues.push(
          issue("RELATION_INVERTED", `${characterName} section: expected holder=${names.holder}`, {
            characterName,
            expectedHolder: names.holder,
            writtenHolder: characterName,
          }),
        );
      }
    }
  }

  for (const sec of [...asArray(pkg?.publicScripts), ...asArray(pkg?.hostScript?.sections)]) {
    const text = asArray(sec.paragraphs).join("\n");
    const fakeResult = { sections: [{ paragraphs: [text] }] };
    const per = diffWriterRenderingAgainstGroundedPacket({
      packetKind: sec.documentId?.includes("host") || sec.id?.includes("host") ? "HOST_SCRIPT" : "PUBLIC_STAGE",
      result: fakeResult,
      groundedExperience,
      packetCaptures: capture ? [capture] : packetCaptures,
    });
    issues.push(...per.issues);
  }

  // Dedupe by code+characterName+evidence
  const seen = new Set();
  const unique = [];
  for (const i of issues) {
    const key = `${i.code}|${i.characterName || ""}|${i.evidence || i.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(i);
  }

  const codes = [...new Set(unique.map((i) => i.code))];
  const ok = unique.length === 0;
  return {
    status: ok ? "RENDERING_PASS" : "RENDERING_REVIEW_REQUIRED",
    ok,
    issues: unique,
    codes,
    summary: {
      relationInverted: unique.filter((i) => i.code === "RELATION_INVERTED").length,
      roleScopeInvented: unique.filter((i) => i.code === "ROLE_SCOPE_INVENTED").length,
      choicePreResolved: unique.filter((i) => i.code === "CHOICE_PRE_RESOLVED").length,
      instructionLeak: unique.filter((i) => i.code === "INTERNAL_INSTRUCTION_LEAK").length,
    },
    expected: capture
      ? {
          seeker: names.seeker,
          holder: names.holder,
          beforeOwner: names.beforeOwner,
          afterOwner: names.afterOwner,
          stake: names.stake,
        }
      : null,
  };
}

export function foldRenderingAdherenceIntoStatus(baseStatus, adherence) {
  if (!adherence || adherence.ok) return baseStatus;
  if (baseStatus === "INVALID") return "INVALID";
  return "REVIEW_REQUIRED";
}
