import { throwErr } from "./api-errors.js";
import { resolveCreativePipeline, validateDeepseekProposal } from "./deepseek.js";
import {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  validateCharacterArchives,
  validateInfoMatrix,
  validateTruthBible
} from "./pipeline-matrix-model.js";

export function buildPipelineImportPackage(session) {
  const { setting, config } = resolveCreativePipeline(session);
  const truthBible = session.truthBible ? validateTruthBible(session.truthBible, config) : null;
  const characterArchives = session.characterArchives
    ? validateCharacterArchives(session.characterArchives, config)
    : null;
  const infoMatrix = session.infoMatrix
    ? validateInfoMatrix(session.infoMatrix, config, characterArchives)
    : null;
  if (!truthBible || !characterArchives || !infoMatrix) {
    throwErr("VALIDATION_ERROR", "入库前需完成真相、角色档案与信息矩阵");
  }
  const proposal = validateDeepseekProposal(
    session.proposal || buildProposalFromMatrix({ setting, config, truthBible, infoMatrix })
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
    infoMatrix,
    hostRunbooks: session.hostRunbooks
  };
}
