/**
 * Run one information-isolated blind table for 《未归还》.
 *
 * Each role call receives only:
 * - that role's private packet;
 * - sources currently held by that role and available by act;
 * - sources and statements already made public at the table.
 *
 * The model never receives the canon, host fact gates, ending requirements,
 * other role packets, or unreleased sources held by another role.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requestDeepseekJson } from "../src/deepseek-client.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(backendRoot, "..");
const envPath = join(backendRoot, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const storyRoot = join(repoRoot, "examples", "pending-review", "未归还");
const prototypeRoot = join(storyRoot, "prototype-v1");
const readPrototype = (relativePath) => readFileSync(join(prototypeRoot, relativePath), "utf8");
const prototype = JSON.parse(readPrototype("prototype-contract.json"));

const roleFiles = {
  R1: "roles/R1-梁芷-第一幕.md",
  R2: "roles/R2-沈闻川-第一幕.md",
  R3: "roles/R3-周慕-第一幕.md",
  R4: "roles/R4-何溪-第一幕.md"
};

const roleNames = {
  R1: "梁芷",
  R2: "沈闻川",
  R3: "周慕",
  R4: "何溪"
};

const rolePackets = Object.fromEntries(
  Object.entries(roleFiles).map(([roleId, relativePath]) => [roleId, readPrototype(relativePath)])
);

const packetText = Object.fromEntries(
  prototype.documents.evidence.map((relativePath) => [
    relativePath.match(/(P\d{2})-/)?.[1],
    readPrototype(relativePath)
  ])
);

const sourceToPacket = new Map();
const sourceMeta = new Map();
for (const packet of prototype.distribution) {
  for (const source of packet.sources) {
    sourceToPacket.set(source.id, packet.packet);
    sourceMeta.set(source.id, {
      holder: source.holder,
      act: packet.act,
      packet: packet.packet,
      release: packet.release
    });
  }
}

function sourceText(sourceId) {
  const packetId = sourceToPacket.get(sourceId);
  const text = packetText[packetId];
  if (!text) throw new Error(`Missing packet for ${sourceId}`);
  const headings = [...text.matchAll(/^## (E\d{2})(?:-[A-Z])?｜/gm)];
  const startHeading = headings.find((match) => match[1] === sourceId);
  if (!startHeading) throw new Error(`Missing heading for ${sourceId}`);
  const start = startHeading.index;
  const nextDifferent = headings.find((match) => match.index > start && match[1] !== sourceId);
  return text.slice(start, nextDifferent?.index ?? text.length).trim();
}

const sourceTexts = Object.fromEntries(
  [...sourceMeta.keys()].map((sourceId) => [sourceId, sourceText(sourceId)])
);

const finalChoices = {
  R1: {
    sign: "正常签约：保留当前陈述，不提交纠正附件",
    sign_with_correction: "附纠正签约：承认申请未经充分核实，提交已公开来源并接受调查",
    pause_transfer: "暂停移交：不在午夜签署，要求档案和合同进入正式审核"
  },
  R2: {
    keep_naming: "维持冠名：继续以启明社区图书馆名义履约",
    activate_correction: "启动第9.3条：仅在23:20保留资格时可选，去冠名并接受暂扣",
    freeze_grant: "冻结资助：停止本轮拨款，交董事会调查"
  },
  R3: {
    air_old_cut: "播放旧版：保留现有纪念短片",
    air_corrected_summary: "播放更正摘要：撤旧版，只使用公开来源与授权允许的匿名摘要",
    publish_raw: "公开原始材料：发布完整录音与箱内原始内容",
    cancel_stream: "停播：取消今晚直播，不作公开发布"
  },
  R4: {
    withhold: "不交付：箱子继续由家属控制",
    conditional_deposit: "条件入藏：逐件登记，按授权分级访问，完整记录来源责任",
    escrow_review: "独立托管：交第三方封存审核，馆方与家属暂时都不能单独取用",
    unrestricted_handover: "无限制交付：把箱内材料交给周慕和馆方，不附传播限制"
  }
};

const commonOpening = `2026年10月17日22:30，青禾社区图书馆旧馆最后一晚。午夜前要完成档案移交和新馆资助签约。迁移系统提示入藏号2001-017无验收记录；闭馆预告仍称沈启明“一个人救下全部馆藏”。桌上的P03资助申请和第9.3条已经提交核验。规则：只有持有人把原始来源卡放进闭门会议的核验区，才算事实证据；这不等于登记入藏或直播、上传、展陈等对外传播。口述、概述和私人记忆都不算证据；任何人不能抢卡、代签或替他人行使权力。有条件交换写在条件板上，目标角色接受后提出者必须立即履行或当桌承认反悔，不能拖到下一轮。`;

const system = `你在参加一场首次接触的四人互动叙事盲测。你只扮演收到的一个角色，不是作者、主持或评审。
你不知道标准答案、事实编号、结局条件和别人私密资料。不要猜测作者偏爱的结局，不要为了“推进剧情”无条件提交材料。
只依据你眼前的私密资料、自己持有的来源和公共桌面行动。你可以自保、交换、追问、承认、撒谎或扣留；但不能伪造来源文字、引用未发给你的卡、替别人决定或声明未公开材料已经核验。
输出严格JSON，不写长篇表演。`;

const publicState = {
  sources: new Set(["E12"]),
  events: ["开场：P03/E12公开；系统提示2001-017无验收记录。"],
  boxFoundTonight: false,
  fundingResponse: null,
  finalActions: {}
};

const violations = [];
const decisions = [];

function publicSnapshot() {
  const publicEvidence = [...publicState.sources]
    .sort()
    .map((sourceId) => `${sourceId}\n${sourceTexts[sourceId]}`)
    .join("\n\n");
  return `公共事件记录：\n${publicState.events.map((event, index) => `${index + 1}. ${event}`).join("\n")}\n\n公共来源原文：\n${publicEvidence}`;
}

function availablePrivateSources(roleId, act) {
  return [...sourceMeta.entries()]
    .filter(([sourceId, meta]) => (
      meta.holder === roleId
      && meta.act <= act
      && !publicState.sources.has(sourceId)
      && sourceId !== "E12"
    ))
    .map(([sourceId]) => sourceId);
}

async function requestDecision(roleId, act, mode) {
  const available = availablePrivateSources(roleId, act);
  const heldText = available.length
    ? available.map((sourceId) => `${sourceId}\n${sourceTexts[sourceId]}`).join("\n\n")
    : "本轮没有尚未公开且可用的新来源卡。";

  const modeInstruction = mode === "final"
    ? `现在是23:55，证据提交和协商已经结束，不能再提交来源。请从下列动作中锁定且只锁定一项：${JSON.stringify(finalChoices[roleId])}。此选择不能被别人替代。`
    : `现在是第${act}幕。你可以提交零张或多张自己当前持有的来源到闭门核验区，也可以附加能当场成交的交换条件。`

  const special = [
    act === 1 && roleId === "R4"
      ? "你还必须明确选择是否公开说出第17箱今夜在你手里；拒绝是合法动作。"
      : "",
    act === 2 && roleId === "R2"
      ? "你还必须对23:20基金问询选择no_dispute、pending_verification、material_dispute或no_response之一。"
      : ""
  ].filter(Boolean).join("\n");

  const user = `你的私密角色资料：\n${rolePackets[roleId]}\n\n${commonOpening}\n\n${publicSnapshot()}\n\n你当前可决定是否提交核验的来源：\n${heldText}\n\n${modeInstruction}\n${special}\n
输出字段：
- reasoning: 不超过120字，只写角色此刻的权衡
- publicSpeech: 不超过160字，给桌上其他人的话
- releaseSources: 只可填当前持有来源ID的数组；不提交则空数组
- questions: 最多2个对其他角色的具体问题
- condition: 一个交换或归还条件，没有则空字符串
- revealBoxTonight: 仅R4第一幕填true/false，其他情况填null
- fundingResponse: 仅R2第二幕填no_dispute/pending_verification/material_dispute/no_response，其他情况填null
- finalAction: 仅final模式填写动作ID，其他情况填null`;

  const response = await requestDeepseekJson(
    [{ role: "system", content: system }, { role: "user", content: user }],
    {
      maxTokens: 1800,
      temperature: 0.42,
      timeoutMs: 180000,
      phase: `original_showcase_blind_${mode}_act${act}_${roleId}`,
      retryOnJsonParse: true,
      transportRetries: 2
    }
  );

  const decision = {
    roleId,
    roleName: roleNames[roleId],
    act,
    mode,
    model: response.model,
    usage: response.usage,
    availableSources: available,
    ...response.value
  };

  if (mode === "final" && !Object.hasOwn(finalChoices[roleId], decision.finalAction)) {
    const repair = await requestDeepseekJson(
      [{ role: "system", content: "你只需修正一个无效的互动游戏终局动作。严格输出JSON。" }, {
        role: "user",
        content: `角色${roleNames[roleId]}上一轮没有给出有效终局动作。只能从${JSON.stringify(finalChoices[roleId])}选择一个。输出字段finalAction和reasoning，不得填null。`
      }],
      {
        maxTokens: 500,
        temperature: 0.05,
        timeoutMs: 180000,
        phase: `original_showcase_blind_final_repair_${roleId}`,
        retryOnJsonParse: true,
        transportRetries: 2
      }
    );
    decision.finalAction = repair.value.finalAction;
    decision.finalRepairUsage = repair.usage;
  }

  return decision;
}

function applyDecision(decision) {
  const permittedSources = new Set(decision.availableSources);
  const requestedSources = Array.isArray(decision.releaseSources) ? decision.releaseSources : [];
  const released = [];
  for (const sourceId of requestedSources) {
    if (!permittedSources.has(sourceId)) {
      violations.push({
        role: decision.roleId,
        act: decision.act,
        type: "illegal_source_release",
        sourceId
      });
      continue;
    }
    publicState.sources.add(sourceId);
    released.push(sourceId);
  }

  if (released.length) {
    publicState.events.push(`${decision.roleName}公开来源：${released.join("、")}。`);
  }
  if (decision.publicSpeech) {
    publicState.events.push(`${decision.roleName}说：“${String(decision.publicSpeech).slice(0, 220)}”`);
  }
  if (decision.condition) {
    publicState.events.push(`${decision.roleName}提出条件：${String(decision.condition).slice(0, 180)}`);
  }
  if (Array.isArray(decision.questions) && decision.questions.length) {
    publicState.events.push(`${decision.roleName}提出问题：${decision.questions.slice(0, 2).join("；")}`);
  }

  if (decision.roleId === "R4" && decision.act === 1 && decision.mode !== "final") {
    publicState.boxFoundTonight = decision.revealBoxTonight === true;
    publicState.events.push(publicState.boxFoundTonight
      ? "何溪公开确认：第17箱今夜在她手里，但不等于已经交付。"
      : "何溪拒绝确认第17箱今夜是否在她手里；实物寻回状态保持待核。"
    );
  }

  if (decision.roleId === "R2" && decision.act === 2 && decision.mode !== "final") {
    const allowed = new Set(["no_dispute", "pending_verification", "material_dispute", "no_response"]);
    publicState.fundingResponse = allowed.has(decision.fundingResponse)
      ? decision.fundingResponse
      : "no_response";
    if (!allowed.has(decision.fundingResponse)) {
      violations.push({ role: "R2", act: 2, type: "invalid_funding_response" });
    }
    publicState.events.push(`23:20基金答复锁定：${publicState.fundingResponse}。`);
  }

  decisions.push({ ...decision, appliedReleaseSources: released });
}

function factIsVerified(factId) {
  const gate = prototype.verification[factId];
  const base = gate.requiredPublicSources.every((sourceId) => publicState.sources.has(sourceId));
  const supplement = !gate.oneOfPublicSources
    || gate.oneOfPublicSources.some((sourceId) => publicState.sources.has(sourceId));
  return base && supplement;
}

function resolveEnding(finalActions, verifiedFacts, correctionGateAvailable) {
  if (finalActions.R3 === "publish_raw" && finalActions.R4 === "unrestricted_handover") return "END-C";
  if (
    verifiedFacts.length >= 5
    && correctionGateAvailable
    && finalActions.R1 === "sign_with_correction"
    && finalActions.R2 === "activate_correction"
    && finalActions.R3 === "air_corrected_summary"
    && finalActions.R4 === "conditional_deposit"
  ) return "END-B";
  if (finalActions.R1 === "sign" && finalActions.R2 === "keep_naming") return "END-A";
  return "END-D";
}

const actOrders = {
  1: ["R3", "R1", "R2", "R4"],
  2: ["R4", "R1", "R3", "R2"],
  3: ["R4", "R3", "R1", "R2"]
};

for (const act of [1, 2, 3]) {
  publicState.events.push(`第${act}幕行动轮开始。`);
  for (const roleId of actOrders[act]) {
    const decision = await requestDecision(roleId, act, "discussion");
    applyDecision(decision);
  }
}

publicState.events.push("23:55：进入同时锁定终局动作。所有角色看到同一份最终公共记录。");
for (const roleId of ["R1", "R2", "R3", "R4"]) {
  const decision = await requestDecision(roleId, 3, "final");
  const allowed = Object.keys(finalChoices[roleId]);
  const action = allowed.includes(decision.finalAction) ? decision.finalAction : allowed[0];
  if (!allowed.includes(decision.finalAction)) {
    violations.push({ role: roleId, act: 3, type: "invalid_final_action", supplied: decision.finalAction });
  }
  if (roleId === "R2" && action === "activate_correction" && !["pending_verification", "material_dispute"].includes(publicState.fundingResponse)) {
    violations.push({ role: roleId, act: 3, type: "unavailable_correction_action", supplied: action });
    publicState.finalActions[roleId] = "freeze_grant";
  } else {
    publicState.finalActions[roleId] = action;
  }
  decisions.push({ ...decision, appliedFinalAction: publicState.finalActions[roleId] });
}

const verifiedFacts = Object.keys(prototype.verification).filter(factIsVerified);
const correctionGateAvailable = ["pending_verification", "material_dispute"].includes(publicState.fundingResponse);
const ending = resolveEnding(publicState.finalActions, verifiedFacts, correctionGateAvailable);
const totalUsage = decisions.reduce((usage, decision) => ({
  promptTokens: usage.promptTokens + (decision.usage?.promptTokens || 0),
  completionTokens: usage.completionTokens + (decision.usage?.completionTokens || 0),
  totalTokens: usage.totalTokens + (decision.usage?.totalTokens || 0)
}), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });

console.log(JSON.stringify({
  protocol: "information_isolated_sequential_blind_table_v1",
  publicSources: [...publicState.sources].sort(),
  boxFoundTonight: publicState.boxFoundTonight,
  fundingResponse: publicState.fundingResponse,
  verifiedFacts,
  finalActions: publicState.finalActions,
  ending,
  violations,
  decisions,
  publicEvents: publicState.events,
  totalUsage
}, null, 2));
