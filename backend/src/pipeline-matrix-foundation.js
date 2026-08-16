import { throwErr } from "./api-errors.js";
import { resolveCreativePipeline, requestDeepseekJson } from "./deepseek.js";
import {
  validateCharacterArchives,
  validateClueNetwork,
  validateHostRunbooks,
  validateInfoMatrix,
  scanClueNetworkDesign,
  scanEndingComposition,
  scanTruthNodeDesign,
  scanDramaticTensionContracts,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import { buildCharacterArchivesMessages } from "./prompts/character-archives.js";
import { buildClueNetworkMessages } from "./prompts/clue-network.js";
import { buildHostRunbookMessages } from "./prompts/host-runbook.js";
import { buildInfoMatrixMessages } from "./prompts/info-matrix.js";
import { buildActOutlineMessages, validateActOutline } from "./prompts/matrix-act-outline.js";
import {
  buildInnocentInferenceCompareMessages,
  buildInnocentScriptsInferenceMessages,
  mechanicalInnocentInferenceCompare,
  validateInnocentInferenceCompare,
  validateInnocentScriptsInference
} from "./prompts/matrix-innocent-inference.js";
import { buildLiteraryStyleCard } from "./prompts/matrix-literary-styles.js";
import {
  scanAutonomousPremiseRegression,
  scanExperienceFirstPremise
} from "./prompts/human-authorship.js";
import { buildMatrixScriptPromptBundle, resolveKillerRoleKey } from "./prompts/matrix-prompt-engine.js";
import { buildReasoningNovelMessages, validateReasoningNovel } from "./prompts/matrix-reasoning-novel.js";
import {
  buildTruthReconstructionMessages,
  mechanicalTruthCompare,
  validateTruthReconstruction
} from "./prompts/matrix-truth-reconstruction.js";
import { buildTruthBibleMessages } from "./prompts/truth-bible.js";
import {
  scanCharacterTruthCausality,
  scanClueDependencyIndependence,
  scanMatrixDryRun,
  scanRoleRemovalImpact,
  scanSharedInteractionContracts
} from "./pipeline-narrative-state-audit.js";
import { simulateMatrixStrategyTable } from "./pipeline-matrix-strategy-playtest.js";
import { playStructureProfile } from "../../shared/play-structure.js";

function styleCardFromInput(input) {
  return buildLiteraryStyleCard(input.setting || {});
}

export async function createPipelineTruthBible(input) {
  const { setting, synopsis, config, brief } = resolveCreativePipeline(input);
  const result = await requestDeepseekJson(
    buildTruthBibleMessages({ setting, synopsis, config, styleCard: styleCardFromInput(input) }),
    { maxTokens: 6000, temperature: 0.45, phase: "pipeline.truth" }
  );
  const truthBible = validateTruthBible(result.value, config, setting);
  const truthNodeGate = scanTruthNodeDesign(truthBible);
  const endingCompositionGate = scanEndingComposition(truthBible, config, setting);
  if (!truthNodeGate.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "真相仍是一段摘要，没有形成可供角色误认和线索拼接的节点网络", {
      truthNodeGate,
      action: "把真相拆成至少四个节点：主线关键事实、局部关系/支线事实与必要背景；另补一个冲突中必须暂时合作完成的现实目标"
    });
  }
  if (!endingCompositionGate.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "主结局已经建立，但角色个人余波仍未形成可结算结构", {
      endingCompositionGate,
      targetStage: "truth",
      action: "保留主结局与结局轴，只为缺失角色补写 2～3 个个人尾声变体；不得扩增主路线或强行安排成长与报应"
    });
  }
  const sourceText = [setting.theme, setting.extraConflicts, synopsis.body, synopsis.charactersSketch, synopsis.truthSketch]
    .filter(Boolean)
    .join("\n");
  const premiseGate = scanAutonomousPremiseRegression(truthBible, {
    sourceText
  });
  if (!premiseGate.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 自主选题命中项目禁区，已阻止进入角色与机制设计", {
      premiseGate,
      action: "更换核心事件；不得把养老退休、人员失踪失联或旧单位福利分配换名后再次生成"
    });
  }
  const experienceGate = scanExperienceFirstPremise(truthBible, { sourceText });
  if (!experienceGate.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "概念阶段没有证明玩家体验，已阻止从结算字段倒推剧情", {
      experienceGate,
      action: "退回概念阶段：补出玩家体验承诺、一个可复述场面和至少两种世界专属动作；不得以签字、投票、版本选择或每人一项权限代替人物与剧情"
    });
  }
  return {
    provider: "deepseek",
    model: result.model,
    setting,
    synopsis,
    config,
    brief,
    truthBible,
    truthNodeGate,
    endingCompositionGate,
    premiseGate,
    experienceGate
  };
}

export async function createPipelineCharacterArchives(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const result = await requestDeepseekJson(
    buildCharacterArchivesMessages({
      setting,
      synopsis,
      config,
      truthBible,
      styleCard: styleCardFromInput(input)
    }),
    { maxTokens: 8000, temperature: 0.5, phase: "pipeline.characters" }
  );
  const characterArchives = validateCharacterArchives(result.value, config, setting, truthBible);
  const characterTruthGate = scanCharacterTruthCausality(characterArchives, truthBible, {
    requireAgencyProfiles: playStructureProfile(setting.playStructure).requiresPlayableDecision
  });
  if (!characterTruthGate.passed) {
    const truthRevision = characterTruthGate.violations.find((issue) => issue.targetStage === "truth");
    throwErr("DEEPSEEK_OUTPUT_INVALID", truthRevision
      ? "人物压力测试证明现有真相不能由这些人自然做出，已退回真相层"
      : "人物没有通过真相压力测试或可玩性删除测试，已阻止进入线索层", {
      characterTruthGate,
      targetStage: truthRevision ? "truth" : "characters",
      action: truthRevision
        ? "只重写真相中被点名的行动链，再重新生成人物；不要用剧情需要或一时冲动补洞"
        : "只修正被点名人物的动机压力链，或补足 Agency / Dependency / Exposure / 删除影响证明"
    });
  }
  return {
    provider: "deepseek",
    model: result.model,
    truthBible,
    characterArchives,
    characterTruthGate
  };
}

export async function createPipelineClueNetwork(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const result = await requestDeepseekJson(
    buildClueNetworkMessages({
      setting,
      synopsis,
      config,
      truthBible,
      characterArchives,
      styleCard: styleCardFromInput(input)
    }),
    { maxTokens: 12000, temperature: 0.38, phase: "pipeline.clues" }
  );
  const clueNetwork = validateClueNetwork(result.value, config, characterArchives, truthBible, setting);
  const clueGate = scanClueNetworkDesign(clueNetwork, config, characterArchives, setting);
  if (!clueGate.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "线索网络仍像一条全员共用的顺序链，已阻止进入公共流程编排", {
      clueGate,
      action: "减少全员线索；补足私人/双人/局部线索与关键真相的独立路径，并为每条干扰登记代价以及无痕/模糊/条件归因模式"
    });
  }
  const clueDependencyGate = scanClueDependencyIndependence(clueNetwork, truthBible);
  if (!clueDependencyGate.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "关键真相虽然有两条线索路径，但仍共享角色、解释者、唯一幕触发或推理方法", {
      clueDependencyGate,
      targetStage: "clues",
      action: "只重写失败真相节点的路径依赖；保留真相与人物，不回滚整条生成链"
    });
  }
  return { provider: "deepseek", model: result.model, truthBible, characterArchives, clueNetwork, clueGate, clueDependencyGate };
}

export async function createPipelineInfoMatrix(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const result = await requestDeepseekJson(
    buildInfoMatrixMessages({
      setting,
      synopsis,
      config,
      truthBible,
      characterArchives,
      clueNetwork,
      styleCard: styleCardFromInput(input)
    }),
    { maxTokens: 9000, temperature: 0.45, phase: "pipeline.matrix" }
  );
  const infoMatrix = validateInfoMatrix({ ...result.value, clues: clueNetwork.clues }, config, characterArchives, setting, truthBible, clueNetwork);
  const tensionGate = scanDramaticTensionContracts(infoMatrix, setting);
  if (!tensionGate.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "信息矩阵把公平写成了平均分配，缺少受益者、受损者或反制窗口", {
      tensionGate,
      action: "重写本幕选项：逐项登记不同的受益者与受损者，并给受损者可执行的反制动作"
    });
  }
  const sharedInteractionGate = scanSharedInteractionContracts(infoMatrix);
  const dryRunGate = scanMatrixDryRun({ infoMatrix, clueNetwork, characterArchives });
  const roleRemovalGate = playStructureProfile(setting.playStructure).requiresPlayableDecision
    ? scanRoleRemovalImpact(characterArchives, clueNetwork, infoMatrix)
    : { passed: true, skipped: true, metrics: [], violations: [] };
  const strategyPlaytest = playStructureProfile(setting.playStructure).requiresPlayableDecision
    ? simulateMatrixStrategyTable({ infoMatrix, clueNetwork, characterArchives, truthBible, runs: 100 })
    : { passed: true, skipped: true, runs: 0, issues: [] };
  if (!sharedInteractionGate.passed || !dryRunGate.passed || !roleRemovalGate.passed || !strategyPlaytest.passed) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", "公共流程在成稿前干跑中暴露了共享事实、角色空转或删除角色后无影响的问题", {
      sharedInteractionGate,
      dryRunGate,
      roleRemovalGate,
      strategyPlaytest,
      targetStage: "matrix",
      action: strategyPlaytest.passed
        ? "保留真相、人物与线索，只重排失败幕的共享场景、角色进入点或线索取得位置"
        : "按 100 局策略压测命中的具体层返工：关键真相被压死回线索层；结局坍缩回真相轴或逐幕轴变化；默认推进过多只改公共决定"
    });
  }
  return {
    provider: "deepseek",
    model: result.model,
    infoMatrix,
    clueNetwork,
    tensionGate,
    sharedInteractionGate,
    roleRemovalGate,
    dryRunGate,
    strategyPlaytest
  };
}

export async function createPipelineHostRunbook(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork);
  const actKey = String(input.actKey || config.chapterKeys?.[0] || "");
  if (!config.chapterKeys?.includes(actKey)) throwErr("VALIDATION_ERROR", "actKey 无效");
  const result = await requestDeepseekJson(
    buildHostRunbookMessages({
      setting,
      synopsis,
      config,
      truthBible,
      infoMatrix,
      characterArchives,
      clueNetwork,
      actKey
    }),
    { maxTokens: 4000, temperature: 0.45, phase: "pipeline.host", context: { actKey } }
  );
  const book = result.value && typeof result.value === "object" ? result.value : {};
  return {
    provider: "deepseek",
    model: result.model,
    runbook: validateHostRunbooks({ runbooks: [book] }, config, setting).runbooks[0]
  };
}

export async function createPipelineHostRunbooksAll(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork);
  const runbooks = [];
  for (const actKey of config.chapterKeys || []) {
    const result = await createPipelineHostRunbook({
      ...input,
      setting,
      synopsis,
      config,
      truthBible,
      infoMatrix,
      clueNetwork,
      actKey
    });
    runbooks.push(result.runbook);
  }
  return { provider: "deepseek", runbooks: validateHostRunbooks({ runbooks }, config, setting).runbooks };
}

export async function createPipelineReasoningNovel(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = input.characterArchives
    ? validateCharacterArchives(input.characterArchives, config, setting, truthBible)
    : null;
  const styleCard = styleCardFromInput(input);
  const result = await requestDeepseekJson(
    buildReasoningNovelMessages({ setting, synopsis, config, truthBible, styleCard, characterArchives }),
    { maxTokens: 16000, temperature: 0.48, phase: "pipeline.reasoning_novel" }
  );
  return {
    provider: "deepseek",
    model: result.model,
    reasoningNovel: validateReasoningNovel(result.value, config),
    styleCard
  };
}

export async function createPipelineActOutline(input) {
  const { setting, synopsis, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const clueNetwork = validateClueNetwork(input.clueNetwork, config, characterArchives, truthBible, setting);
  const infoMatrix = validateInfoMatrix(input.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork);
  const reasoningNovel = input.reasoningNovel;
  if (!reasoningNovel?.acts?.length) throwErr("VALIDATION_ERROR", "reasoningNovel 缺失");
  const roleKey = String(input.roleKey || "");
  const actKey = String(input.actKey || "");
  const characterArchive = characterArchives.roles.find((role) => role.key === roleKey);
  const matrixRow = infoMatrix.rows.find((row) => row.roleKey === roleKey && row.actKey === actKey);
  if (!characterArchive || !matrixRow) throwErr("VALIDATION_ERROR", "roleKey 或 actKey 在矩阵中不存在");
  const bundle = buildMatrixScriptPromptBundle({
    truthBible,
    infoMatrix,
    characterArchives,
    config,
    actKey,
    roleKey,
    matrixRow,
    existingScripts: input.scripts || {},
    setting
  });
  const result = await requestDeepseekJson(
    buildActOutlineMessages({
      setting,
      reasoningNovel,
      characterArchive,
      matrixRow,
      roleKey,
      actKey,
      styleCard: styleCardFromInput(input),
      spoilerContract: bundle.spoilerContract,
      fairnessContract: bundle.fairnessContract,
      clueLedger: bundle.clueLedger,
      killerAwarenessContract: bundle.spoilerContract.killerAwarenessContract,
      publicEnvironment: infoMatrix?.publicEnvironmentByAct?.[actKey] || null
    }),
    { maxTokens: 4000, temperature: 0.38, phase: "pipeline.act_outline", context: { roleKey, actKey } }
  );
  return {
    provider: "deepseek",
    model: result.model,
    actOutline: validateActOutline(result.value, roleKey, actKey, setting)
  };
}

export async function createPipelineTruthReconstruction(input) {
  const { setting, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const actOutlines = input.actOutlines || {};
  if (!Object.keys(actOutlines).length) throwErr("VALIDATION_ERROR", "actOutlines 缺失");
  const result = await requestDeepseekJson(
    buildTruthReconstructionMessages({ truthBible, actOutlines, config, characterArchives }),
    { maxTokens: 6000, temperature: 0.32, phase: "pipeline.truth_reconstruction" }
  );
  const reconstruction = validateTruthReconstruction(result.value);
  const mechanical = mechanicalTruthCompare(reconstruction, truthBible);
  return {
    provider: "deepseek",
    model: result.model,
    reconstruction,
    mechanical,
    passed: mechanical.passed && reconstruction.verdict === "pass"
  };
}

export async function createPipelineInnocentScriptsTruthInference(input) {
  const { setting, config } = resolveCreativePipeline(input);
  const truthBible = validateTruthBible(input.truthBible, config, setting);
  const characterArchives = validateCharacterArchives(input.characterArchives, config, setting, truthBible);
  const scripts = input.scripts || {};
  if (!Object.keys(scripts).length) throwErr("VALIDATION_ERROR", "scripts 缺失");
  const killerRoleKey = resolveKillerRoleKey(truthBible, characterArchives);
  const inferResult = await requestDeepseekJson(
    buildInnocentScriptsInferenceMessages({ scripts, config, characterArchives, killerRoleKey }),
    { maxTokens: 8000, temperature: 0.35, phase: "pipeline.innocent_inference" }
  );
  const inference = validateInnocentScriptsInference(inferResult.value);
  const mechanical = mechanicalInnocentInferenceCompare(inference, truthBible);
  const compareResult = await requestDeepseekJson(
    buildInnocentInferenceCompareMessages({ inference, truthBible, killerRoleKey }),
    { maxTokens: 4000, temperature: 0.28, phase: "pipeline.innocent_inference_compare" }
  );
  const comparison = validateInnocentInferenceCompare(compareResult.value);
  return {
    provider: "deepseek",
    model: inferResult.model,
    killerRoleKey,
    inference,
    comparison,
    mechanical,
    passed: mechanical.killerMatch && comparison.fairnessVerdict === "pass"
  };
}
