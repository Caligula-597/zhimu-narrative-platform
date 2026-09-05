/**
 * P9.2 GEN-05《零点拍卖会》— explicit GAME narrative binding fixture.
 * Preferences alone do not place; gamePlan rows must be explicitly accepted.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acceptGameplayPlacement, normalizeGameNarrativePlan } from "./game-narrative-plan.js";
import {
  applyGameNarrativePlanToPackage,
  finalSettlementOutcomes,
  midStoryWinnerOutcome,
} from "./game-narrative-package-binding.js";
import { buildProjectContextProfile } from "./project-context-profile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gen05Case = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "p8-generalization-cases", "GEN-05-midnight-auction.json"),
    "utf8",
  ),
);

/** Canonical story beats that justify GAME (must exist before binding). */
export const GEN05_BEAT_CATALOG = Object.freeze({
  beat_act1_gather: Object.freeze({
    id: "beat_act1_gather",
    stageId: "act1",
    summary: "宾客到场，拍品尚未公开完整信息。",
  }),
  beat_act2_scarcity: Object.freeze({
    id: "beat_act2_scarcity",
    stageId: "act2",
    summary: "加密拍品目录只剩一个临时查看名额，多人需要抢先取得其中线索。",
  }),
  beat_act3_exhibit: Object.freeze({
    id: "beat_act3_exhibit",
    stageId: "act3",
    summary: "关键证物进入托管争议，只有一人能取得保管/查看权。",
  }),
  beat_act4_assembly: Object.freeze({
    id: "beat_act4_assembly",
    stageId: "act4",
    summary: "各方信息汇总，需要集体表决给出公开结论。",
  }),
});

export function buildGen05ContextProfile() {
  return buildProjectContextProfile({
    creationSpec: {
      setting: { era: "CONTEMPORARY" },
      genreTags: ["强玩法", "弱推理", "拍卖"],
    },
    premise: { era: "当代地下拍卖" },
    preferredPresetId: "CONTEMPORARY_URBAN",
    explicitBindings: {
      contestedResource: { label: "加密拍品目录的独家查看权", kind: "RESOURCE" },
      decisiveEvidence: { label: "关键证物的保管/查看权", kind: "OBJECT" },
      publicTask: { label: "零点场最终指认表决", kind: "TASK" },
    },
  });
}

/**
 * Explicitly accept GEN-05 gamePlan rows (never from preference alone).
 */
export function acceptGen05GamePlacements() {
  const rows = gen05Case.gamePlan || [];
  return rows.map((row) => {
    if (row.instanceKey === "intel-bid") {
      return acceptGameplayPlacement({
        candidate: row,
        stageId: row.stageId,
        mechanismTemplateId: "M03-1",
        familyId: "M03",
        instanceKey: row.instanceKey,
        sourceBeatIds: ["beat_act2_scarcity"],
        afterBeatId: "beat_act2_scarcity",
      });
    }
    if (row.instanceKey === "resource-bid") {
      return acceptGameplayPlacement({
        candidate: row,
        stageId: row.stageId,
        mechanismTemplateId: "M03-1",
        familyId: "M03",
        instanceKey: row.instanceKey,
        sourceBeatIds: ["beat_act3_exhibit"],
        afterBeatId: "beat_act3_exhibit",
      });
    }
    return acceptGameplayPlacement({
      candidate: row,
      stageId: row.stageId,
      mechanismTemplateId: "M09-1",
      familyId: "M09",
      instanceKey: row.instanceKey,
      sourceBeatIds: ["beat_act4_assembly"],
      afterBeatId: "beat_act4_assembly",
    });
  });
}

export function buildGen05GameNarrativePlan({ contextProfile = null } = {}) {
  const profile = contextProfile || buildGen05ContextProfile();
  const [intel, resource, vote] = acceptGen05GamePlacements();

  const bindings = [
    {
      ...intel,
      narrative: {
        causeSummary:
          "档案式拍品目录只剩一个临时访问名额，而多人都需要先取得里面的记录才能继续追查。",
        stake: {
          label: "加密拍品目录的独家查看权",
          contextBindingKey: "contestedResource",
        },
        participantReason: "获取这份记录将直接影响后续调查与议价能力。",
        publicPrompt:
          "第一轮竞价开始：最高价者获得加密拍品目录的独家查看权。请提交竞价。",
      },
      outcomes: [
        midStoryWinnerOutcome({
          permissionId: "catalog_preview_access",
          clueIds: ["clue_encrypted_catalog"],
          stateKey: "catalog_preview",
          stakeLabel: "加密拍品目录的独家查看权",
        }),
      ],
      fallback: { type: "HOST_OVERRIDE_PICK_WINNER" },
    },
    {
      ...resource,
      narrative: {
        causeSummary:
          "关键证物进入托管争议：只有一人能取得保管/查看权，否则后续指认将缺少硬证据。",
        stake: {
          label: "关键证物的保管/查看权",
          contextBindingKey: "decisiveEvidence",
        },
        participantReason: "掌握证物保管权意味着掌握下一阶段的举证主动权。",
        publicPrompt:
          "第二轮竞价开始：最高价者获得关键证物的保管/查看权。请提交竞价。",
      },
      outcomes: [
        midStoryWinnerOutcome({
          permissionId: "evidence_custody_access",
          clueIds: ["clue_contested_exhibit"],
          stateKey: "evidence_custody",
          stakeLabel: "关键证物的保管/查看权",
        }),
      ],
      fallback: { type: "HOST_OVERRIDE_PICK_WINNER" },
    },
    {
      ...vote,
      narrative: {
        causeSummary: "信息汇总后，场内需要一次公开表决给出集体结论。",
        stake: {
          label: "零点场最终指认表决",
          contextBindingKey: "publicTask",
        },
        participantReason: "所有在场玩家都需要对公开结论负责。",
        publicPrompt:
          "最终表决：请投票指认你认为的责任方。多数票形成玩家集体决定，不等于自动改写案件真相。",
      },
      runtimeConfig: {
        candidates: ["A1", "A2", "A3", "A4", "A5", "A6"],
        submit_seconds: 600,
        tie_exit: "KEEP_ALL",
        correctOptionId: "A3",
        decisionQuestion: "谁应承担主要责任？",
      },
      outcomes: finalSettlementOutcomes({
        endingPermissionId: "ending_reveal_access",
        decisionQuestion: "谁应承担主要责任？",
      }),
      fallback: { type: "HOST_OVERRIDE_SETTLEMENT" },
      requiredForStageCompletion: true,
    },
  ];

  return normalizeGameNarrativePlan({
    revision: 1,
    sourcePmdId: "pmd-gen05-demo",
    sourcePmdRevision: 1,
    sourceContextRevision: profile.revision,
    bindings,
    updatedAt: "2026-09-05T00:00:00.000Z",
  });
}

export function buildGen05PackageShell() {
  const roles = [
    ...gen05Case.characters.map((c) => ({
      id: c.id,
      name: c.name,
      type: "PLAYER",
      characterId: c.id,
      playerAssignable: true,
    })),
    { id: "HOST", name: "主持", type: "HOST", playerAssignable: false },
  ];
  const stages = gen05Case.stages.map((s) => ({
    id: s.id,
    order: s.order,
    title: s.label,
    stageRole: s.order === 0 ? "SETUP" : s.order === 3 ? "PAYOFF" : "ESCALATION",
  }));

  return {
    id: "pkg-gen05-narrative",
    status: "DRAFT",
    metadata: {
      title: gen05Case.title,
      revision: 1,
      caseId: "GEN-05",
    },
    roles,
    stages,
    hostScript: {
      documentId: "doc_host_gen05",
      sections: stages.map((s) => ({
        id: `host_${s.id}`,
        stageId: s.id,
        title: `主持·${s.title}`,
        paragraphs: [`主持推进 ${s.title}。`],
      })),
    },
    roleScripts: Object.fromEntries(
      gen05Case.characters.map((c) => [
        c.id,
        stages.map((s) => ({
          id: `role_${c.id}_${s.id}`,
          stageId: s.id,
          title: `${c.name}·${s.title}`,
          paragraphs: [`${c.name}在${s.title}的行动备忘。`],
        })),
      ]),
    ),
    sharedScripts: [],
    publicScripts: [
      {
        id: "public_act2_rules",
        stageId: "act2",
        title: "公共规则·目录竞价",
        paragraphs: ["加密拍品目录只允许一人临时查看。资格将通过竞价决定。"],
      },
      {
        id: "public_act3_rules",
        stageId: "act3",
        title: "公共规则·证物竞价",
        paragraphs: ["关键证物保管权只授予一人。资格将通过第二轮竞价决定。"],
      },
    ],
    clues: [
      {
        id: "clue_encrypted_catalog",
        title: "加密拍品目录摘录",
        stageId: "act2",
        delivery: "CONDITION_UNLOCK",
        visibility: "PRIVATE",
        roleIds: [],
        paragraphs: ["目录第7项旁注：拍品来源链在午夜前被人为切断。"],
      },
      {
        id: "clue_contested_exhibit",
        title: "关键证物检视记录",
        stageId: "act3",
        delivery: "CONDITION_UNLOCK",
        visibility: "PRIVATE",
        roleIds: [],
        paragraphs: ["证物内侧有与白川私人印鉴吻合的磨损痕迹。"],
      },
    ],
    endingContent: {
      finalStageId: "act4",
      sections: [
        {
          id: "ending_vote_result",
          stageId: "act4",
          title: "最终表决结果",
          type: "REVEAL",
          paragraphs: ["最终指认已结算。请对照票数与真相宣读。"],
        },
        {
          id: "ending_canon_truth",
          stageId: "act4",
          title: "案件真相",
          type: "REVEAL",
          paragraphs: [
            "真相：白川（A3）在拍品流转中伪造来源链。多数指认只代表玩家集体决定，不等于自动改写真相。",
          ],
        },
      ],
    },
    mechanismAnnotations: [],
    permissions: [],
  };
}

export function buildGen05NarrativelyBoundPackage() {
  const contextProfile = buildGen05ContextProfile();
  const plan = buildGen05GameNarrativePlan({ contextProfile });
  const shell = buildGen05PackageShell();
  return {
    ...applyGameNarrativePlanToPackage(shell, plan, { contextProfile }),
    contextProfile,
    beatCatalog: GEN05_BEAT_CATALOG,
  };
}
