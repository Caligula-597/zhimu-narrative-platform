import {
  mechanismDesignHasContent,
  normalizeMechanismDesign,
  validateMechanismDesignConfirmation,
} from "../../shared/mechanism-design.js";
import {
  mechanismInteractionCard,
  normalizeMechanismInteraction,
} from "../../shared/mechanism-interactions.js";
import {
  assertMechanismPackage,
  compileMechanismPackage,
} from "./mechanism-package.js";

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const cleanText = (value, maximum = 2400) =>
  String(value ?? "")
    .trim()
    .slice(0, maximum);
const isKeyCharacter = (character) =>
  character === "_"
  || character === "-"
  || (character >= "a" && character <= "z")
  || (character >= "0" && character <= "9");
const cleanKey = (value, fallback) => {
  const output = [];
  let replacingInvalidSequence = false;
  for (const character of String(value ?? "").trim().toLowerCase()) {
    if (isKeyCharacter(character)) {
      output.push(character);
      replacingInvalidSequence = false;
    } else if (!replacingInvalidSequence) {
      output.push("-");
      replacingInvalidSequence = true;
    }
  }
  let start = 0;
  let end = output.length;
  while (start < output.length && output[start] === "-") start += 1;
  while (end > start && output[end - 1] === "-") end -= 1;
  const normalized = output.slice(start, Math.min(end, start + 80)).join("");
  return normalized || fallback;
};

export class ConfirmedMechanismDesignError extends TypeError {
  constructor(issues) {
    super(`确认的机制设计还不能入库：${issues.map((issue) => issue.message).join("；")}`);
    this.name = "ConfirmedMechanismDesignError";
    this.code = "VALIDATION_ERROR";
    this.statusCode = 400;
    this.issues = issues;
    this.details = {
      reason: "mechanism_design_incomplete",
      fields: issues.map((issue) => issue.key),
    };
  }
}

function pipelineRounds(pipeline = {}) {
  const outlineBeats = asArray(pipeline.outline?.chapterBeats);
  const proposalChapters = asArray(pipeline.proposal?.chapters);
  const source = outlineBeats.length ? outlineBeats : proposalChapters;
  const used = new Set();
  return source.map((chapter, index) => {
    const fallbackKey = `chapter-${index + 1}`;
    let key = cleanKey(chapter?.chapterKey || chapter?.key, fallbackKey);
    if (used.has(key)) key = `${key}-${index + 1}`;
    used.add(key);
    return {
      key,
      sequence: index + 1,
      title:
        cleanText(chapter?.title, 240) ||
        cleanText(chapter?.name, 240) ||
        `第 ${index + 1} 轮`,
      goal:
        cleanText(chapter?.goal, 800) || cleanText(chapter?.summary, 800),
      turn: cleanText(chapter?.turn, 800),
    };
  });
}

function optionLabels(kind, design) {
  const primary = {
    group_choice: "执行全桌确认的方案",
    resource_tradeoff: "投入本轮有限资源",
    evidence_selection: "采纳并公开本轮证据方案",
    sequence_reconstruction: "提交本轮完整重建顺序",
    timed_crisis: "在时限内执行本轮行动",
    role_commitment: "确认并承担本轮角色承诺",
    secret_ballot: "投给本轮最应执行的方案",
    free_ranking: "排在本轮第一优先的方案",
    numeric_allocation: "获得本轮最多额度的方案",
  }[kind];
  return {
    primary: primary || `执行：${cleanText(design.recurringAction, 120)}`,
    fallback: "承担后果并继续推进",
  };
}

function pipelineRoleDisclosureStates(pipeline = {}) {
  const sources = [
    pipeline.characterArchives?.roles,
    pipeline.rolesMeta?.roles,
    pipeline.roleMatrix?.roles,
    pipeline.outline?.players,
  ];
  const roles = sources.find((rows) => Array.isArray(rows) && rows.length) ?? [];
  const seen = new Set();
  return roles.flatMap((role) => {
    const roleKey = cleanKey(role?.key || role?.roleKey, "");
    if (!roleKey || seen.has(roleKey)) return [];
    seen.add(roleKey);
    return [{
      roleKey,
      publicGoal: cleanText(role?.publicGoal, 800),
      hiddenGoal: cleanText(role?.hiddenGoal, 800),
      coreSecret: cleanText(role?.coreSecret, 1200),
      secretFactKeys: [],
      authorizationGrantKeys: [],
      disclosureStateKey: "",
    }];
  });
}

/**
 * Existing Matrix authors already declare role-visible clue content through
 * rows[].newClueIds and mark which clue cards are automatic. Compile that
 * stable author contract into deterministic mechanism settlement effects.
 */
function attachAutomaticClueGrants(packageInput, pipeline = {}) {
  const packageValue = structuredClone(packageInput);
  const infoMatrix = asObject(pipeline.infoMatrix);
  const clues = new Map(
    asArray(infoMatrix.clues)
      .filter((clue) => clue?.grantMode === "auto")
      .map((clue) => [String(clue.key ?? ""), clue]),
  );
  if (!clues.size) return assertMechanismPackage(packageValue);

  for (const round of packageValue.rounds) {
    const grants = [];
    const seen = new Set();
    for (const row of asArray(infoMatrix.rows)) {
      if (String(row?.actKey ?? "") !== String(round.key)) continue;
      const roleKey = cleanKey(row?.roleKey, "");
      for (const rawClueKey of asArray(row?.newClueIds)) {
        const clueKey = String(rawClueKey ?? "").trim();
        const clue = clues.get(clueKey);
        const identity = `${clueKey}:${roleKey}`;
        if (!clue || !roleKey || seen.has(identity)) continue;
        seen.add(identity);
        grants.push({
          targetType: "clue",
          targetKey: clueKey,
          operation: "grant",
          roleKey,
          consequence: `发放角色可见线索《${cleanText(clue.name, 120) || clueKey}》`,
        });
      }
    }
    if (!grants.length) continue;
    const decisions = packageValue.decisionNodes.filter(
      (decision) => decision.roundKey === round.key,
    );
    if (decisions.length) {
      for (const decision of decisions) {
        for (const option of decision.options) {
          option.effects = [...asArray(option.effects), ...structuredClone(grants)];
        }
      }
    } else {
      round.settlementEffects = [
        ...asArray(round.settlementEffects),
        ...structuredClone(grants),
      ];
    }
  }
  return assertMechanismPackage(packageValue);
}

function confirmedDesignPackage(pipeline, design) {
  const rounds = pipelineRounds(pipeline);
  if (!rounds.length) {
    throw new ConfirmedMechanismDesignError([
      {
        key: "chapters",
        message: "生成产物没有可绑定的章节，无法建立主持端运行轮次。",
      },
    ]);
  }

  const interactionCard = mechanismInteractionCard(design.interactionKind);
  const stateKey = "author-mechanism-momentum";
  const resourceKey = "author-limited-resource";
  const threshold = Math.max(1, Math.ceil(rounds.length / 2));
  const labels = optionLabels(design.interactionKind, design);
  const resourceRegistry =
    design.interactionKind === "resource_tradeoff"
      ? [
          {
            key: resourceKey,
            name: cleanText(design.limitedResource, 240),
            initialValue: rounds.length,
            minimum: 0,
            maximum: rounds.length,
          },
        ]
      : [];

  const packageValue = {
    schemaVersion: 1,
    source: "confirmed_mechanism_design",
    authoring: {
      designVersion: design.version,
      designStatus: design.status,
      interactionKind: design.interactionKind,
      updatedAt: design.updatedAt || null,
      title: design.title,
    },
    factLedger: [],
    entities: [],
    authorizationMatrix: [],
    eventLedger: [],
    stateRegistry: [
      {
        key: stateKey,
        name: `${design.title}累计执行`,
        valueType: "number",
        initialValue: 0,
        setInChapterKey: rounds[0].key,
      },
    ],
    resourceRegistry,
    rounds: rounds.map((round) => ({
      key: round.key,
      sequence: round.sequence,
      title: round.title,
      goal: round.goal || design.summary,
      turn: round.turn,
      hostNotes: [
        interactionCard.hostInstruction,
        `本轮核对：${design.recurringAction}`,
        `即时反馈：${design.immediateFeedback}`,
        `失败推进：${design.failureAdvance}`,
      ].join("\n"),
      triggerRoleKeys: [],
      playerAction: design.recurringAction,
      actionObject: design.limitedResource,
      actionTargetKey: "",
      irreversibleConsequence: design.immediateFeedback,
      nextState: design.failureAdvance,
      progressMode: "host_confirmed",
      stateReads: [],
      entryConditionMode: "none",
      onReadPass: {},
      onReadFail: {},
      stateWrites: [],
      resourceDeltas: [],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
      evidenceKeys: [],
      genreMechanicUse: design.genreSpecificity,
      sharedSpotlightConflict: design.conflictReason,
      decisionKey: `author-decision-${round.sequence}`,
    })),
    actions: [],
    investigationActions: [],
    evidenceGraph: { evidence: [], conclusions: [], misdirections: [] },
    decisionNodes: rounds.map((round) => {
      const primaryKey = `execute-${round.sequence}`;
      const fallbackKey = `fallback-${round.sequence}`;
      const interaction = normalizeMechanismInteraction({
        kind: design.interactionKind,
        label: design.title,
        playerInstruction: `${interactionCard.playerInstruction} 本轮行动：${design.recurringAction}`,
        hostInstruction: `${interactionCard.hostInstruction} ${design.failureAdvance}`,
        deadlineSeconds:
          design.interactionKind === "timed_crisis" ? 300 : 0,
        defaultOptionKey:
          design.interactionKind === "timed_crisis" ? fallbackKey : "",
        resourceKey:
          design.interactionKind === "resource_tradeoff" ? resourceKey : "",
        allocationTotal:
          design.interactionKind === "numeric_allocation"
            ? design.allocationTotal
            : 0,
        allocationUnitLabel:
          design.interactionKind === "numeric_allocation"
            ? design.allocationUnitLabel
            : "",
      });
      const primaryEffects = [
        {
          targetType: "state",
          targetKey: stateKey,
          operation: "increment",
          value: 1,
          consequence: design.immediateFeedback,
        },
      ];
      if (design.interactionKind === "resource_tradeoff") {
        primaryEffects.push({
          targetType: "resource",
          targetKey: resourceKey,
          operation: "lose",
          amount: 1,
          consequence: design.immediateFeedback,
        });
      }
      return {
        key: `author-decision-${round.sequence}`,
        roundKey: round.key,
        question: `${round.title}：${design.recurringAction}`,
        stateKey,
        interaction,
        options: [
          {
            key: primaryKey,
            choiceText: labels.primary,
            immediateConsequence: design.immediateFeedback,
            presentation: {
              eyebrow: `方案 ${round.sequence}A`,
              publicPreview: design.immediateFeedback,
              costLabel:
                design.interactionKind === "resource_tradeoff"
                  ? `消耗 1 份：${cleanText(design.limitedResource, 120)}`
                  : "",
              riskLabel: design.conflictReason,
              sequenceLabel: `第 ${round.sequence} 轮`,
            },
            effects: primaryEffects,
          },
          {
            key: fallbackKey,
            choiceText: labels.fallback,
            immediateConsequence: design.failureAdvance,
            presentation: {
              eyebrow: "失败推进",
              publicPreview: design.failureAdvance,
              costLabel: "",
              riskLabel: design.immediateFeedback,
              sequenceLabel: `第 ${round.sequence} 轮`,
            },
            effects: [],
          },
        ],
      };
    }),
    branchFragments: [],
    endingRoutes: [
      {
        key: "author-mechanism-achieved",
        title: `${design.title}达成`,
        consequence: design.endingCausality,
        priority: 100,
        requirements: [
          {
            targetType: "state",
            targetKey: stateKey,
            operator: "gte",
            value: threshold,
          },
        ],
      },
      {
        key: "author-mechanism-fallback",
        title: `${design.title}未完全达成`,
        consequence: design.failureAdvance,
        priority: 0,
        isDefault: true,
        requirements: [],
      },
    ],
    endingResolution: {
      defaultRouteKey: "author-mechanism-fallback",
      conflictResolution: "highest-priority",
    },
    roleDisclosureStates: pipelineRoleDisclosureStates(pipeline),
    worldRules: [],
  };
  return attachAutomaticClueGrants(packageValue, pipeline);
}

/**
 * Converts the server-owned design state into a runtime package. Draft designs
 * are deliberately non-canonical; confirmed designs are materialized without
 * trusting the model to repeat the author contract in its JSON output.
 */
export function compilePipelineMechanismPackage(
  pipeline = {},
  mechanismDesignValue = undefined,
) {
  const rawDesign = asObject(mechanismDesignValue);
  const design = normalizeMechanismDesign(rawDesign);
  const designConfigured = mechanismDesignValue != null;
  if (designConfigured || mechanismDesignHasContent(rawDesign)) {
    if (design.status !== "confirmed") {
      return { packageValue: null, reason: "design_draft", design };
    }
    const validation = validateMechanismDesignConfirmation(design);
    if (!validation.valid) {
      throw new ConfirmedMechanismDesignError(validation.issues);
    }
    return {
      packageValue: confirmedDesignPackage(pipeline, validation.design),
      reason: "confirmed_design",
      design: validation.design,
    };
  }
  if (pipeline?.outline && typeof pipeline.outline === "object") {
    return {
      packageValue: attachAutomaticClueGrants(
        compileMechanismPackage(pipeline.outline, {
          source: "deepseek_pipeline_outline",
        }),
        pipeline,
      ),
      reason: "legacy_outline",
      design,
    };
  }
  return { packageValue: null, reason: "no_mechanism_design", design };
}
