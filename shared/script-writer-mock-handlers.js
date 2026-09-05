/**
 * Controlled mock LLM handlers for P9.3 — literary-ish but packet-bound.
 * Not a real model; used so CI proves RealScriptWriter path without network.
 */

import { packetAllowLists } from "./script-production-packets.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickLexicon(packet) {
  return asArray(packet?.contextLexicon).filter(Boolean);
}

function stageIdFallback(packet, allows) {
  return (
    packet?.stageId ||
    packet?.finalStageId ||
    asArray(packet?.stages)[0]?.stageId ||
    allows.stageIds[0] ||
    "act1"
  );
}

/** Build a valid ScriptWriterResult JSON string from the user packet message. */
export function literaryMockFromMessages(messages) {
  const user = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const isRepair = /FORMAT_REPAIR_ONLY/i.test(user);
  let packet = {};
  const packetMatch = user.match(/<<<PACKET_JSON>>>\n([\s\S]*?)\n<<<END_PACKET_JSON>>>/);
  if (packetMatch) {
    try {
      packet = JSON.parse(packetMatch[1]);
    } catch {
      packet = {};
    }
  }
  // Repair path may only have previous raw — try extract packetKind from previous
  if (!packet.kind && isRepair) {
    const kindMatch = user.match(/"packetKind"\s*:\s*"([A-Z_]+)"/) ||
      user.match(/"kind"\s*:\s*"([A-Z_]+)"/);
    packet = {
      kind: kindMatch?.[1] || "HOST_SCRIPT",
      stages: [{ stageId: "act1", title: "一" }],
      stageIds: ["act1"],
      allowedSourceBeatIds: [],
      allowedClueIds: [],
      allowedFactIds: [],
      forbiddenFactIds: [],
      allowedKnowledgeLabels: [],
    };
  }

  const kind = packet.kind || "HOST_SCRIPT";
  const allows = packetAllowLists(packet);
  const lexicon = pickLexicon(packet);
  const lexLine = lexicon.length ? lexicon.join("、") : "";

  if (kind === "HOST_SCRIPT") {
    const sections = asArray(packet.stages).map((st) => {
      const games = asArray(packet.gameNarrative).filter((g) => g.stageId === st.stageId);
      const gameLines = games.flatMap((g) => [
        `本幕玩法原因：${g.causeSummary}`,
        `争夺之物：${g.stakeLabel}`,
        `启动说明：${g.publicPrompt}`,
        ...asArray(g.outcomes).map((o) => `结算「${o.matcherType}」：${o.narrativeMeaning}`),
        g.runtimeTruth
          ? `规则真值：winnerCount=${g.runtimeTruth.winnerCount ?? "n/a"}；resolution=${g.runtimeTruth.resolution}`
          : null,
      ]).filter(Boolean);
      const beatIds = asArray(st.beats).map((b) => b.sourceOutlineBeatId).filter(Boolean);
      return {
        sectionId: `host_${st.stageId}`,
        stageId: st.stageId,
        title: `主持手册·${st.title || st.stageId}`,
        paragraphs: [
          `本幕目的：${st.purpose || "推进场上张力"}。`,
          `开场：灯光压暗，你提醒玩家留意已经点名的实体——${lexLine || "本幕已知场所与物件"}。`,
          `后台真相：${st.hostTruthSummary || asArray(st.beats).map((b) => b.hostTruth).filter(Boolean).join(" / ") || "（按 TruthView）"}`,
          ...gameLines,
          "推进下一幕前，确认本幕线索与玩法结算均已记录。",
        ],
        provenance: {
          sourceBeatIds: beatIds.slice(0, 6),
          sourceClueIds: allows.allowedClueIds.slice(0, 4),
          sourceFactIds: allows.allowedFactIds.slice(0, 4),
        },
        canonicalClaims: [],
        inventedCharacterIds: [],
        inventedStageIds: [],
      };
    });
    return JSON.stringify({
      requestId: "mock",
      packetKind: kind,
      sections,
      proposedCanonicalChanges: [],
      diagnostics: [],
    });
  }

  if (kind === "ROLE_SCRIPT") {
    const sections = asArray(packet.stages).map((st) => {
      const contribs = asArray(st.contributions);
      const beatIds = contribs.map((c) => c.sourceOutlineBeatId).filter(Boolean);
      const goals = contribs.map((c) => c.goal).filter(Boolean);
      const actions = contribs.map((c) => c.action).filter(Boolean);
      const game = asArray(packet.roleGameSurface).find((g) => g.stageId === st.stageId);
      return {
        sectionId: `role_${packet.characterId}_${st.stageId}`,
        stageId: st.stageId,
        title: `${packet.characterName}·${st.stageId}`,
        paragraphs: [
          `你是${packet.characterName}。此刻你仍握着与「${lexLine || "已知物件"}」有关的记忆余温。`,
          `此前经历：${asArray(st.publicContext).join("；") || "你带着未说出口的心事走进这一幕。"}`,
          `本幕发生：${actions.join("；") || "你被迫在场上做出选择。"}`,
          `你的目标：${goals.join("；") || "活下去，并弄清对你重要的那件事。"}`,
          game
            ? `你听到的公开玩法：${game.publicPrompt || game.stakeLabel}（${game.participantReason || ""}）`
            : "你只知道场上气氛骤紧。",
          "本幕结束时，新的压力落在你肩上——但你不敢把猜测说成事实。",
        ],
        provenance: {
          sourceBeatIds: beatIds.slice(0, 6),
          sourceClueIds: asArray(st.availableClues).slice(0, 3),
          sourceFactIds: allows.allowedFactIds.slice(0, 3),
        },
        canonicalClaims: [],
        inventedCharacterIds: [],
        inventedStageIds: [],
      };
    });
    return JSON.stringify({
      packetKind: kind,
      sections,
      proposedCanonicalChanges: [],
      diagnostics: [],
    });
  }

  if (kind === "CLUE_WRITER") {
    const carrier =
      lexLine.includes("信")
        ? `一封未寄出的信笺，折痕发黄，抬头仍写着收信人的名字。正文暗示：${packet.supportsFact || "未标注事实"}。`
        : lexLine
          ? `物证载体写着与「${lexLine}」相关的记录。可读文字支持：${packet.supportsFact || "（未标注）"}。`
          : `门禁日志残页。可读文字支持：${packet.supportsFact || "（未标注）"}。`;
    return JSON.stringify({
      packetKind: kind,
      sections: [
        {
          sectionId: `clue_${packet.clueId}`,
          stageId: stageIdFallback(packet, allows),
          title: `线索·${packet.clueId}`,
          paragraphs: [carrier, "你只能据此推断，不能把猜测写成定论。"],
          provenance: {
            sourceBeatIds: allows.allowedSourceBeatIds.slice(0, 4),
            sourceClueIds: [packet.clueId],
            sourceFactIds: allows.allowedFactIds.slice(0, 4),
          },
          canonicalClaims: [],
          clueSemanticsPatch: { ...packet.lockedSemantics },
          inventedCharacterIds: [],
          inventedStageIds: [],
        },
      ],
      proposedCanonicalChanges: [],
      diagnostics: [],
    });
  }

  if (kind === "PUBLIC_STAGE") {
    const games = asArray(packet.gameNarrative);
    const gameParas = games.flatMap((g) => [
      g.publicPrompt || `场上宣布争夺：${g.stakeLabel}`,
      g.runtimeTruth
        ? `规则不变：仅最高价者一人获得资格（winnerCount=${g.runtimeTruth.winnerCount}）。`
        : null,
    ]).filter(Boolean);
    return JSON.stringify({
      packetKind: kind,
      sections: [
        {
          sectionId: `public_${packet.stageId}`,
          stageId: packet.stageId,
          title: `公共·${packet.title || packet.stageId}`,
          paragraphs: [
            packet.playerVisibleSummary || "大厅灯光骤暗。",
            ...asArray(packet.publicLines).slice(0, 4),
            ...gameParas,
            lexLine ? `众人耳熟能详的名字：${lexLine}。` : "空气里全是筹码声。",
          ].filter(Boolean),
          provenance: {
            sourceBeatIds: allows.allowedSourceBeatIds,
            sourceClueIds: [],
            sourceFactIds: allows.allowedFactIds.slice(0, 4),
          },
          canonicalClaims: [],
          inventedCharacterIds: [],
          inventedStageIds: [],
        },
      ],
      proposedCanonicalChanges: [],
      diagnostics: [],
    });
  }

  // ENDING
  return JSON.stringify({
    packetKind: "ENDING",
    sections: [
      {
        sectionId: "ending_final",
        stageId: stageIdFallback(packet, allows),
        title: "终局结算",
        paragraphs: [
          "最终表决已经落下。票数只代表玩家的集体决定。",
          `Canon 真相仍按主持真相事件宣读：${asArray(packet.truthEvents)
            .map((e) => e.whatHappened)
            .filter(Boolean)
            .slice(0, 3)
            .join("；") || "（见 TruthView）"}`,
          packet.settlementPresentation?.note ||
            "多数指认不等于自动改写案件真相。",
          lexLine ? `贯穿全场的物件与场所：${lexLine}。` : "",
        ].filter(Boolean),
        provenance: {
          sourceBeatIds: allows.allowedSourceBeatIds.slice(0, 6),
          sourceClueIds: allows.allowedClueIds.slice(0, 4),
          sourceFactIds: allows.allowedFactIds.slice(0, 4),
        },
        canonicalClaims: [],
        inventedCharacterIds: [],
        inventedStageIds: [],
      },
    ],
    proposedCanonicalChanges: [],
    diagnostics: [],
  });
}

/**
 * Handler that fails schema once, then repairs.
 */
export function createFailThenRepairHandler() {
  let calls = 0;
  return async (messages) => {
    calls += 1;
    if (calls === 1) return "not-json-at-all <<<broken>>>";
    return literaryMockFromMessages(messages);
  };
}

/**
 * Safety trap: packet says insufficient to name culprit — must not invent.
 */
export function safetyTrapNoInventCulprit(messages) {
  const base = JSON.parse(literaryMockFromMessages(messages));
  // Ensure no invented culprit claim
  base.proposedCanonicalChanges = [];
  base.sections = asArray(base.sections).map((s) => ({
    ...s,
    paragraphs: [
      ...asArray(s.paragraphs),
      "资料不足以判定真凶。你不得自行选定凶手。",
    ],
    inventedCharacterIds: [],
  }));
  return JSON.stringify(base);
}
