import { throwErr } from "./api-errors.js";
import { resolveCreativePipeline, validateDeepseekProposal } from "./deepseek.js";
import {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  validateCharacterArchives,
  validateClueNetwork,
  validateHostRunbooks,
  validateInfoMatrix,
  scanClueNetworkDesign,
  scanEndingComposition,
  scanTruthNodeDesign,
  validateTruthBible
} from "./pipeline-matrix-model.js";
import { compilePipelineMechanismPackage } from "./pipeline-mechanism-package.js";
import {
  simulateMechanismPackage,
  summarizeMechanismSimulation,
} from "./mechanism-simulator.js";
import { diagnoseScriptCollection } from "../../shared/prose-quality-gate.js";
import { buildArtifactDependencyManifest } from "./pipeline-narrative-state-audit.js";
import { simulateMatrixStrategyTable } from "./pipeline-matrix-strategy-playtest.js";
import { buildPipelineGenerationAudit } from "./pipeline-generation-provenance.js";
import { playStructureProfile } from "../../shared/play-structure.js";

export function buildPipelineImportPackage(session) {
  const { setting, config } = resolveCreativePipeline(session);
  const truthBible = session.truthBible ? validateTruthBible(session.truthBible, config, setting) : null;
  const characterArchives = session.characterArchives
    ? validateCharacterArchives(session.characterArchives, config, setting, truthBible)
    : null;
  const clueNetwork = session.clueNetwork && characterArchives
    ? validateClueNetwork(session.clueNetwork, config, characterArchives, truthBible, setting)
    : null;
  const infoMatrix = session.infoMatrix
    ? validateInfoMatrix(session.infoMatrix, config, characterArchives, setting, truthBible, clueNetwork)
    : null;
  if (!truthBible || !characterArchives || !clueNetwork || !infoMatrix) {
    throwErr("VALIDATION_ERROR", "入库前需完成真相、角色档案、线索网络与公共流程");
  }
  const truthNodeGate = scanTruthNodeDesign(truthBible);
  const endingCompositionGate = scanEndingComposition(truthBible, config, setting);
  const clueGate = scanClueNetworkDesign(clueNetwork, config, characterArchives, setting);
  if (!truthNodeGate.passed || !endingCompositionGate.passed || !clueGate.passed) {
    throwErr("VALIDATION_ERROR", "真相节点、角色尾声或线索网络尚未通过结构门禁，禁止入库", { truthNodeGate, endingCompositionGate, clueGate });
  }
  const hostRunbooks = session.hostRunbooks
    ? validateHostRunbooks({ runbooks: session.hostRunbooks }, config, setting).runbooks
    : [];
  if (setting.playStructure !== "mystery" && hostRunbooks.length < config.chapterKeys.length) {
    throwErr("VALIDATION_ERROR", "可玩结构入库前必须完成每一幕的可执行主持手册");
  }
  const proseDiagnostics = diagnoseScriptCollection(session.scripts, { expectedPov: setting.pov });
  if (!proseDiagnostics.skipped && !proseDiagnostics.passed) {
    throwErr("VALIDATION_ERROR", "玩家正文未通过场景化正文门禁，禁止生成入库包", {
      proseDiagnostics
    });
  }
  const proposal = validateDeepseekProposal(
    session.proposal || buildProposalFromMatrix({ setting, config, truthBible, infoMatrix, clueNetwork })
  );
  const rolesMeta = characterArchivesToRolesMeta(characterArchives, infoMatrix, config);
  const sections = {};
  for (const [roleKey, acts] of Object.entries(session.scripts || {})) {
    sections[roleKey] = {};
    for (const [actKey, script] of Object.entries(acts || {})) {
      if (!script?.body) continue;
      sections[roleKey][actKey] = {
        title: script.title,
        body: script.body,
        tasks: script.tasks,
        closingHook: script.closingHook
      };
    }
  }
  const mechanismCompilation = compilePipelineMechanismPackage(
    { ...session, proposal },
    session.mechanismDesign,
  );
  const mechanismValidationSummary = mechanismCompilation.packageValue
    ? summarizeMechanismSimulation(
        simulateMechanismPackage(mechanismCompilation.packageValue),
      )
    : null;
  if (setting.playStructure !== "mystery" && !mechanismCompilation.packageValue) {
    throwErr("VALIDATION_ERROR", "可玩结构没有生成可运行机制包：若驾驶舱已有机制草稿，请先确认；否则需补全逐幕决定与结局条件", {
      mechanismCompilationReason: mechanismCompilation.reason
    });
  }
  if (setting.playStructure !== "mystery" && mechanismValidationSummary) {
    const fatalCodes = new Set([
      "unsupported_operation",
      "state_type_mismatch",
      "state_value_outside_registry",
      "unreachable_ending_route",
      "equivalent_decision_options",
      "no_action_decision_without_default"
    ]);
    const fatalDiagnostics = (mechanismValidationSummary.authorDiagnostics || []).filter((item) => fatalCodes.has(item.code));
    if (fatalDiagnostics.length) {
      throwErr("VALIDATION_ERROR", "机制路径模拟未通过，禁止入库", {
        mechanismCompilationReason: mechanismCompilation.reason,
        fatalDiagnostics
      });
    }
  }
  const strategyPlaytest = playStructureProfile(setting.playStructure).requiresPlayableDecision
    ? simulateMatrixStrategyTable({ infoMatrix, clueNetwork, characterArchives, truthBible, runs: 100 })
    : { passed: true, skipped: true, runs: 0, issues: [], claimBoundary: "纯推理结构不执行策略型结局压力测试" };
  if (setting.playStructure !== "mystery" && !strategyPlaytest.passed) {
    throwErr("VALIDATION_ERROR", "100 局策略压力测试发现关键真相、默认推进或结局可达性存在阻断，禁止入库", { strategyPlaytest });
  }
  const artifactDependencyManifest = buildArtifactDependencyManifest({
    setting,
    synopsis: session.synopsis,
    truthBible,
    characterArchives,
    clueNetwork,
    infoMatrix,
    actOutlines: session.actOutlines,
    scripts: session.scripts,
    hostRunbooks
  });
  const generationAudit = buildPipelineGenerationAudit({
    ...session,
    truthBible,
    characterArchives,
    clueNetwork,
    infoMatrix,
    hostRunbooks,
    artifactDependencyManifest,
    strategyPlaytest
  }, { manifest: artifactDependencyManifest, strategyPlaytest });
  return {
    proposal,
    roleMatrix: rolesMeta,
    rolesMeta,
    sections,
    synopsis: {
      title: config.title || setting.theme,
      summary: truthBible.summary.slice(0, 1200),
      overallManuscript: truthBible.summary
    },
    truthBible,
    clueNetwork,
    truthNodeGate,
    endingCompositionGate,
    clueGate,
    infoMatrix,
    hostRunbooks,
    mechanismDesign: mechanismCompilation.design,
    mechanismPackagePreview: mechanismCompilation.packageValue,
    mechanismCompilationReason: mechanismCompilation.reason,
    mechanismValidationSummary,
    strategyPlaytest,
    artifactDependencyManifest,
    generationAudit,
    generationProvenance: session.generationProvenance || null,
    evaluation: session.evaluation || null,
    proseDiagnostics,
  };
}
