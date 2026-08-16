import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { resolveKillerRoleKey, spoilerGateForAct } from "./matrix-prompt-engine.js";
import { playStructureProfile } from "../../../shared/play-structure.js";

export function buildHostRunbookMessages({ setting, synopsis, config, truthBible, infoMatrix, clueNetwork, characterArchives, actKey }) {
  const actRows = (infoMatrix.rows || []).filter((r) => r.actKey === actKey);
  const actClues = (infoMatrix.clues || []).filter((c) => c.actKey === actKey);
  const gate = spoilerGateForAct(truthBible, actKey);
  const killerKey = resolveKillerRoleKey(truthBible, characterArchives);
  const playProfile = playStructureProfile(setting.playStructure);
  const actContract = (infoMatrix.actContracts || []).find((item) => item.actKey === actKey) || null;
  const actDecision = (infoMatrix.decisions || []).find((item) => item.actKey === actKey) || null;
  const actMaterials = actClues.filter((item) => item.physicalForm);
  const runnableContract = playProfile.requiresPlayableDecision
    ? `- 必须逐场执行 actContract.sceneSequence，不得把本幕缩成自由讨论。\n- openingReadAloud 只宣布眼前局面和期限，不解释主题。\n- materialSetup 写清每份实体物料放在哪里、玩家允许如何操作。\n- decisionProcedure 必须说明收件、签署、投票、竞价或分配如何截止与结算；失败按 defaultEffect 推进，并逐项执行 defaultAxisEffects。\n- stateChanges 与 endCondition 必须能由主持当场观察确认。`
    : "- 若存在 actContract / actDecision，主持必须按公共幕合同执行，不得另造流程。";
  const system = `你是剧本杀主持/runbook 编写者。为本幕写主持操作手册，不写玩家私人正文。

${PRODUCT_BOUNDARY}

【剧透安全 — hostTruth】
- hostTruth 是主持独知，但不得包含本幕 spoilerGates.forbiddenFacts 中的结论（主持心里知道可以，文案不得复述给玩家听的「一句话剧透」）。
- 第一、二幕 hostTruth 禁止出现 killer 姓名/key；第三幕才可完整复盘。
- clueGrants 只能发放 actKey=${actKey} 的线索，不得提前发放后续幕 clue。

【任务】
- flow：本幕流程（何时讨论、何时搜证、何时发放线索）。
- hostTruth：本幕主持操作所需片段（时间线核对、线索含义），遵守剧透门禁。
- clueGrants：何时发放哪些 clueId（仅限本幕线索）。
- private/pair/group/bridge 线索只交给 holderRoleKeys 或由 acquisition 中的行动取得；grantMode=auto 不是全桌公开。只有 public_anchor 能写进 openingReadAloud 或当众展示。
- fallback 优先启用 truthCoverage 中尚未被压住的独立路径；不得把 hostMeaning 改写成提示直接报给玩家。
- 若发生 hide/destroy/swap，必须同时结算 interference.cost，并让 traceClueKey 留在可取得路径中。
- fallbacks：卡关兜底（用中性提示，不直接说凶手）。
${runnableContract}

【输出 schema】
{
  "actKey": "${actKey}",
  "title": "幕标题",
  "flow": "流程说明",
  "openingReadAloud": "开场可直接朗读的局面与期限",
  "roundGoal": "本幕结束前必须完成的世界内事项",
  "materialSetup": [{"clueId":"clue-1","placement":"放置与发放方式","allowedActions":["签署","转让"]}],
  "decisionProcedure": "主持可逐步执行的结算程序",
  "stateChanges": ["结算后立即登记的变化"],
  "failureAdvance": "无人达成时如何继续而不是停局",
  "endCondition": "何时允许翻到下一幕",
  "hostTruth": "主持真相片段（遵守剧透门禁）",
  "clueGrants": [{"clueId":"clue-1","when":"…"}],
  "fallbacks": ["兜底建议"],
  "suggestions": []
}`;
  const user = `请为 actKey=${actKey} 撰写主持手册。

${creativeInputUserBlocks(setting, synopsis)}
${untrustedUserPayload("本幕剧透门禁", gate)}
${killerKey ? untrustedUserPayload("真凶 key（hostTruth 前几幕勿明示）", { killerRoleKey: killerKey }) : ""}
${untrustedUserPayload("本幕线索", actClues)}
${untrustedUserPayload("本幕线索的还原路径与真实关联", {
  truthCoverage: (clueNetwork?.truthCoverage || []).filter((coverage) =>
    coverage.paths?.some((path) => path.clueKeys?.some((key) => actClues.some((clue) => clue.key === key)))
  ),
  links: (clueNetwork?.links || []).filter((link) =>
    actClues.some((clue) => clue.key === link.fromClueKey || clue.key === link.toClueKey)
  )
})}
${untrustedUserPayload("本幕角色状态", actRows)}
${actContract ? untrustedUserPayload("公共幕合同（唯一流程源）", actContract) : ""}
${actDecision ? untrustedUserPayload("本幕必须结算的决定", actDecision) : ""}
${actMaterials.length ? untrustedUserPayload("本幕实体物料", actMaterials) : ""}
${untrustedUserPayload("真相摘要（主持向）", { summary: truthBible.summary, method: truthBible.method })}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
