import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTerminologyGroundingContract,
  TERMINOLOGY_GROUNDING_BLOCK,
  TERMINOLOGY_GROUNDING_VERSION
} from "../src/prompts/matrix-terminology-grounding.js";
import { buildMatrixDeAiPassMessages } from "../src/prompts/matrix-player-script.js";

test("terminology contract records confirmed objects and actions without treating voice as authority", () => {
  const contract = buildTerminologyGroundingContract({
    setting: { theme: "借影", eraNotes: "沿河戏班" },
    synopsis: { body: "众人要在开演前找回柳叶刻刀。" },
    styleCard: { era: { vocabulary: "油灯、戏台", props: "刻刀、幕布" } },
    characterArchive: {
      publicIdentity: "刻影师",
      voiceHints: "说话像熟练匠人，多用月轮暗口和回刀礼",
      resources: [{ name: "柳叶刻刀", meaning: "可以修改皮影边缘" }],
      playableMoves: ["把两张覆片用透明线连起来"]
    },
    matrixRow: { tasks: ["在开演前确认刻刀去向"] },
    clueLedger: [{ name: "旧样片", observable: "边缘留有三个针孔" }],
    actMaterials: [{ name: "旧样片", physicalForm: "一张有三个针孔的皮影样片", affordances: ["迎光查看针孔"] }],
    roleKey: "role-1",
    actKey: "ch1"
  });

  assert.equal(contract.version, TERMINOLOGY_GROUNDING_VERSION);
  assert.ok(contract.registeredWorldTerms.some((item) => item.term === "柳叶刻刀"));
  assert.ok(contract.registeredWorldTerms.some((item) => item.term === "旧样片"));
  assert.ok(contract.registeredActionDescriptions.some((item) => item.action === "迎光查看针孔"));
  assert.ok(contract.registeredWorldTerms.every((item) => item.originKind === "locked_upstream_artifact" && item.confidence === "confirmed"));
  assert.equal(contract.creatorSourceRecords[0].originKind, "creator_input");
  assert.equal(contract.eraPresetRecords[0].confidence, "context_only");
  assert.deepEqual(contract.provenancePolicy.requiredFields, ["source", "originKind", "confidence"]);
  assert.ok(contract.nonAuthorityFields.includes("characterArchive.voiceHints"));
  assert.doesNotMatch(JSON.stringify(contract.registeredWorldTerms), /月轮暗口|回刀礼/u);
});

test("terminology gate makes unsupported precision a fact hallucination and survives rewrite", () => {
  assert.match(TERMINOLOGY_GROUNDING_BLOCK, /世界事实门禁/u);
  assert.match(TERMINOLOGY_GROUNDING_BLOCK, /不得因为角色是某种工匠/u);
  assert.match(TERMINOLOGY_GROUNDING_BLOCK, /不授权为它另造简称/u);
  assert.match(TERMINOLOGY_GROUNDING_BLOCK, /terminology_research_required/u);

  const contract = buildTerminologyGroundingContract({ roleKey: "role-1", actKey: "ch1" });
  const prompt = buildMatrixDeAiPassMessages({
    body: "我按住那张纸。",
    styleCard: { pov: "first" },
    targetWords: 800,
    terminologyGroundingContract: contract
  }).map((message) => message.content).join("\n");
  assert.match(prompt, /逐个核对正文中的行业词/u);
  assert.match(prompt, /不得新增表外专业词/u);
  assert.match(prompt, /closed_source_for_specialized_terms/u);
});
