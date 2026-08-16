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

function matrixHostRunbook(pipeline, roundKey) {
  const runbooks = Array.isArray(pipeline.hostRunbooks)
    ? pipeline.hostRunbooks
    : asArray(pipeline.hostRunbooks?.runbooks);
  return runbooks.find((book) => String(book?.actKey ?? "") === String(roundKey)) || {};
}

function matrixContractPackage(pipeline = {}) {
  const rounds = pipelineRounds(pipeline);
  const matrix = asObject(pipeline.infoMatrix);
  const truth = asObject(pipeline.truthBible);
  const decisions = asArray(matrix.decisions);
  const axes = asArray(truth.endingAxes);
  const endingRoutes = asArray(truth.endingRoutes);
  if (!rounds.length || !decisions.length || !axes.length || !endingRoutes.length) return null;

  const stateRegistry = axes.map((axis, index) => ({
    key: cleanKey(axis?.key, `matrix-axis-${index + 1}`),
    name: cleanText(axis?.label, 240) || `结局变量 ${index + 1}`,
    valueType: "number",
    initialValue: 0,
    setInChapterKey: rounds[0].key,
  }));
  const stateKeys = new Set(stateRegistry.map((state) => state.key));
  const decisionByRound = new Map(
    decisions.map((decision) => [cleanKey(decision?.actKey, ""), decision]),
  );
  const decisionNodes = rounds.flatMap((round) => {
    const decision = decisionByRound.get(round.key);
    if (!decision) return [];
    const runbook = matrixHostRunbook(pipeline, round.key);
    const compileAxisEffects = (axisEffects, consequence) => asArray(axisEffects).flatMap((effect) => {
      const targetKey = cleanKey(effect?.axisKey, "");
      const delta = Number(effect?.delta) || 0;
      if (!targetKey || !stateKeys.has(targetKey) || delta === 0) return [];
      return [{
        targetType: "state",
        targetKey,
        operation: delta > 0 ? "increment" : "decrement",
        value: Math.abs(delta),
        consequence: cleanText(consequence, 800),
      }];
    });
    const authoredOptions = asArray(decision.options).map((option, optionIndex) => ({
      key: cleanKey(option?.key, `${decision.key}-option-${optionIndex + 1}`),
      choiceText: cleanText(option?.label, 300),
      immediateConsequence: cleanText(option?.immediateEffect, 800),
      presentation: {
        eyebrow: `方案 ${optionIndex + 1}`,
        publicPreview: cleanText(option?.immediateEffect, 500),
        costLabel: "",
        riskLabel: cleanText(decision.defaultEffect, 300),
        sequenceLabel: `第 ${round.sequence} 轮`,
      },
      effects: compileAxisEffects(option?.axisEffects, option?.immediateEffect),
    }));
    const fallbackKey = `${cleanKey(decision?.key, `matrix-decision-${round.sequence}`)}-no-settlement`;
    return [{
      key: cleanKey(decision?.key, `matrix-decision-${round.sequence}`),
      roundKey: round.key,
      question: cleanText(decision?.question, 800),
      stateKey: "",
      interaction: normalizeMechanismInteraction({
        kind: "timed_crisis",
        label: cleanText(round.title, 240),
        playerInstruction: cleanText(decision?.question, 600),
        hostInstruction: cleanText(runbook.decisionProcedure, 1000) || `主持人按本幕决定程序结算；若未达成，执行：${cleanText(decision?.defaultEffect, 500)}`,
        deadlineSeconds: 900,
        defaultOptionKey: fallbackKey,
      }),
      options: [
        ...authoredOptions,
        {
          key: fallbackKey,
          choiceText: "未在期限内完成结算",
          immediateConsequence: cleanText(decision?.defaultEffect, 800),
          presentation: {
            eyebrow: "默认推进",
            publicPreview: cleanText(decision?.defaultEffect, 500),
            costLabel: "",
            riskLabel: "不暂停剧情",
            sequenceLabel: `第 ${round.sequence} 轮`,
          },
          effects: compileAxisEffects(decision?.defaultAxisEffects, decision?.defaultEffect),
        },
      ],
    }];
  });
  if (decisionNodes.length !== rounds.length) return null;

  const packageValue = {
    schemaVersion: 1,
    source: "matrix_play_contract",
    authoring: {
      playStructure: cleanText(truth.playStructure, 40),
      centralQuestion: cleanText(truth.centralQuestion, 800),
    },
    factLedger: asArray(truth.objectiveFacts).map((fact, index) => ({
      key: cleanKey(fact?.key, `fact-${index + 1}`),
      statement: cleanText(fact?.statement, 1000),
      observableBy: asArray(fact?.observableBy).map((item) => cleanKey(item, "")).filter(Boolean),
    })),
    entities: [],
    authorizationMatrix: [],
    eventLedger: [],
    stateRegistry,
    resourceRegistry: [],
    rounds: rounds.map((round) => {
      const decision = decisionByRound.get(round.key);
      const contract = asArray(matrix.actContracts).find((item) => String(item?.actKey ?? "") === round.key) || {};
      const runbook = matrixHostRunbook(pipeline, round.key);
      const materialNames = asArray(matrix.clues)
        .filter((clue) => String(clue?.actKey ?? "") === round.key && clue?.physicalForm)
        .map((clue) => cleanText(clue.name, 120))
        .filter(Boolean);
      return {
        key: round.key,
        sequence: round.sequence,
        title: round.title,
        goal: cleanText(runbook.roundGoal, 800) || cleanText(contract.publicSituation, 800) || round.goal,
        turn: cleanText(contract.exitState, 800) || round.turn,
        hostNotes: [runbook.openingReadAloud, runbook.decisionProcedure, `失败推进：${runbook.failureAdvance || decision?.defaultEffect || "按默认后果继续"}`].filter(Boolean).join("\n"),
        triggerRoleKeys: [],
        playerAction: cleanText(decision?.question, 800),
        actionObject: materialNames.join("、"),
        actionTargetKey: "",
        irreversibleConsequence: cleanText(decision?.defaultEffect, 800),
        nextState: cleanText(contract.exitState, 800),
        progressMode: "host_confirmed",
        stateReads: [],
        entryConditionMode: "none",
        onReadPass: {},
        onReadFail: {},
        stateWrites: [],
        resourceDeltas: [],
        settlementEffects: [],
        unlocksEvidenceKeys: [],
        locksEvidenceKeys: [],
        evidenceKeys: [],
        genreMechanicUse: cleanText(truth.settlementPrinciple, 800),
        sharedSpotlightConflict: cleanText(contract.publicSituation, 800),
        decisionKey: cleanKey(decision?.key, `matrix-decision-${round.sequence}`),
      };
    }),
    actions: [],
    investigationActions: [],
    evidenceGraph: { evidence: [], conclusions: [], misdirections: [] },
    decisionNodes,
    branchFragments: [],
    endingRoutes: endingRoutes.map((route, index) => ({
      key: cleanKey(route?.key, `matrix-ending-${index + 1}`),
      title: cleanText(route?.title, 240),
      consequence: cleanText(route?.consequence, 1600),
      priority: Number(route?.priority) || 0,
      isDefault: route?.isDefault === true,
      requirements: asArray(route?.requirements).flatMap((requirement) => {
        const targetKey = cleanKey(requirement?.axisKey, "");
        if (!stateKeys.has(targetKey)) return [];
        return [{
          targetType: "state",
          targetKey,
          operator: cleanText(requirement?.operator, 8) || "gte",
          value: Number(requirement?.value) || 0,
        }];
      }),
    })),
    endingResolution: {
      defaultRouteKey: cleanKey(endingRoutes.find((route) => route?.isDefault)?.key, ""),
      conflictResolution: "highest-priority",
    },
    roleEpilogues: asArray(truth.roleEpilogues).map((epilogue) => ({
      roleKey: cleanKey(epilogue?.roleKey, ""),
      variants: asArray(epilogue?.variants).map((variant, variantIndex) => ({
        key: cleanKey(variant?.key, `${epilogue?.roleKey || "role"}-epilogue-${variantIndex + 1}`),
        title: cleanText(variant?.title, 240),
        consequence: cleanText(variant?.consequence, 1600),
        priority: Number(variant?.priority) || 0,
        isDefault: variant?.isDefault === true,
        requirements: asArray(variant?.requirements).flatMap((requirement) => {
          const targetKey = cleanKey(requirement?.axisKey, "");
          if (!stateKeys.has(targetKey)) return [];
          return [{
            targetType: "state",
            targetKey,
            operator: cleanText(requirement?.operator, 8) || "gte",
            value: Number(requirement?.value) || 0,
          }];
        }),
      })),
    })),
    roleDisclosureStates: pipelineRoleDisclosureStates(pipeline),
    worldRules: [],
  };
  return attachAutomaticClueGrants(packageValue, pipeline);
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
  const matrixPackage = matrixContractPackage(pipeline);
  if (matrixPackage) {
    return {
      packageValue: matrixPackage,
      reason: "matrix_contract",
      design,
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
