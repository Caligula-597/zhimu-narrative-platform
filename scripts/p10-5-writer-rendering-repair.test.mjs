/**
 * P10.5.1 Section-Scoped Adherence Repair unit tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSectionRepairBrief,
  selectJobsForAdherenceRepair,
  runSectionScopedAdherenceRepair,
} from "../shared/script-writer-rendering-repair.js";
import { normalizeScriptWriterResult } from "../shared/script-writer-result-contracts.js";

const capture = {
  templateId: "M12-1",
  roles: { seeker: "沈岚", holder: "梁赫" },
  stake: "未公开的预展目录册",
  exchange: { beforeOwner: "梁赫", afterOwner: "沈岚 独占" },
};

test("P10.5.1 repair brief forces relation + open choice + forbids deal", () => {
  const brief = buildSectionRepairBrief({
    issues: [
      {
        code: "RELATION_INVERTED",
        characterName: "沈岚",
        evidence: "手中的筹码：那本未公开的预展目录册",
      },
      {
        code: "CHOICE_PRE_RESOLVED",
        characterName: "梁赫",
        evidence: "最终点头",
      },
    ],
    packetCapture: capture,
    characterName: "梁赫",
    packetKind: "ROLE_SCRIPT",
  });
  assert.equal(brief.kind, "RENDERING_ADHERENCE_REPAIR");
  assert.ok(brief.mustKeep.some((l) => l.includes("holder = 梁赫")));
  assert.ok(brief.mustKeep.some((l) => l.includes("seeker = 沈岚")));
  assert.ok(brief.openChoices.some((l) => l.includes("接受")));
  assert.ok(brief.forbid.some((l) => l.includes("最终成交") || l.includes("最终点头")));
  assert.ok(brief.prose.includes("SEMANTIC REPAIR ONLY"));
  assert.ok(brief.prose.includes("not literary style / Voice V2"));
});

test("P10.5.1 selectJobs maps character issues and public leaks", () => {
  const jobs = selectJobsForAdherenceRepair({
    issues: [
      { code: "RELATION_INVERTED", characterId: "P1", characterName: "沈岚", evidence: "手中的筹码" },
      { code: "ROLE_SCOPE_INVENTED", characterId: "P3", characterName: "白绫", evidence: "核对" },
      {
        code: "INTERNAL_INSTRUCTION_LEAK",
        sectionHint: "PUBLIC_STAGE",
        evidence: "玩家可见：",
      },
    ],
    packetSet: {
      publicStages: [{ stageId: "act3" }, { stageId: "act4" }],
    },
    sectionStates: [
      {
        sectionId: "public:act3",
        packetKind: "PUBLIC_STAGE",
        result: { sections: [{ paragraphs: ["玩家可见：交换条件"] }] },
      },
    ],
  });
  const keys = jobs.map((j) => j.jobKey).sort();
  assert.deepEqual(keys, ["public:act3", "role:P1", "role:P3"]);
});

test("P10.5.1 one-shot repair: max 1 regen per job, then re-diff", async () => {
  const calls = [];
  const writer = {
    async write(request) {
      calls.push(request.requestId);
      return normalizeScriptWriterResult({
        requestId: request.requestId,
        packetKind: request.packetKind,
        sections: [
          {
            sectionId: "s1",
            stageId: "act1",
            title: "修复",
            paragraphs: [
              "你是梁赫。你开场掌握未公开的预展目录册。沈岚是需求方。",
              "沈岚可以接受、反提或拒绝。交接尚未发生。",
            ],
            provenance: { sourceBeatIds: [], sourceClueIds: [], sourceFactIds: [] },
            canonicalClaims: [],
            inventedCharacterIds: [],
            inventedStageIds: [],
          },
        ],
        proposedCanonicalChanges: [],
        diagnostics: [],
      });
    },
  };

  const badPkg = {
    status: "READY_FOR_REVIEW",
    roles: [
      { id: "role_p1", characterId: "P1", name: "沈岚", type: "PLAYER" },
      { id: "role_p2", characterId: "P2", name: "梁赫", type: "PLAYER" },
    ],
    roleScripts: {
      role_p1: [
        {
          paragraphs: ["你手中的筹码：那本未公开的预展目录册。"],
        },
      ],
      role_p2: [{ paragraphs: ["对方犹豫片刻，最终点头。"] }],
    },
    publicScripts: [],
    hostScript: { sections: [] },
    diagnostics: [{ code: "RENDERING_REVIEW_REQUIRED", message: "pre" }],
  };

  const production = {
    pmd: { id: "pmd-test" },
    packetSet: {
      groundedExperience: { captures: [capture] },
      roles: [
        { characterId: "P1", characterName: "沈岚" },
        { characterId: "P2", characterName: "梁赫" },
      ],
      publicStages: [],
      host: {},
      ending: {},
      clues: [],
    },
    sectionStates: [
      {
        sectionId: "role:P1",
        packetKind: "ROLE_SCRIPT",
        characterId: "P1",
        packet: { characterId: "P1", characterName: "沈岚" },
        status: "REVIEW_REQUIRED",
        result: {
          sections: [{ paragraphs: ["你手中的筹码：那本未公开的预展目录册。"] }],
        },
      },
      {
        sectionId: "role:P2",
        packetKind: "ROLE_SCRIPT",
        characterId: "P2",
        packet: { characterId: "P2", characterName: "梁赫" },
        status: "REVIEW_REQUIRED",
        result: {
          sections: [{ paragraphs: ["对方犹豫片刻，最终点头。"] }],
        },
      },
    ],
    package: badPkg,
    projectionAudit: { packetCaptures: [capture] },
  };

  const regenCounts = new Map();
  async function regenerateJob({ production: prod, jobKey, repairBrief }) {
    assert.ok(repairBrief?.kind === "RENDERING_ADHERENCE_REPAIR");
    regenCounts.set(jobKey, (regenCounts.get(jobKey) || 0) + 1);
    assert.equal(regenCounts.get(jobKey), 1, "max 1 repair per section");
    const raw = await writer.write({
      requestId: `repair-${jobKey}`,
      packetKind: "ROLE_SCRIPT",
      packet: prod.sectionStates.find((s) => s.sectionId === jobKey)?.packet,
      repairBrief,
    });
    const nextStates = prod.sectionStates.map((s) =>
      s.sectionId === jobKey
        ? { ...s, status: "GENERATED", result: raw, repairBrief }
        : s,
    );
    const roleId = jobKey === "role:P1" ? "role_p1" : "role_p2";
    return {
      ...prod,
      sectionStates: nextStates,
      package: {
        ...prod.package,
        roleScripts: {
          ...prod.package.roleScripts,
          [roleId]: raw.sections,
        },
      },
    };
  }

  const out = await runSectionScopedAdherenceRepair({
    production,
    writer,
    regenerateJob,
    maxRepairsPerSection: 1,
  });

  assert.equal(regenCounts.get("role:P1"), 1);
  assert.equal(regenCounts.get("role:P2"), 1);
  assert.equal(out.repairLog.length, 2);
  assert.ok(out.adherenceAfter.ok, JSON.stringify(out.adherenceAfter.summary));
  assert.equal(out.status, "RENDERING_PASS");
  assert.equal(
    out.adherenceAfter.summary.relationInverted +
      out.adherenceAfter.summary.choicePreResolved +
      out.adherenceAfter.summary.instructionLeak +
      out.adherenceAfter.summary.roleScopeInvented,
    0,
  );
  assert.ok(!out.production.package.diagnostics.some((d) => d.code === "RENDERING_REVIEW_REQUIRED"));
});

test("P10.5.1 instruction leak principle forbids silent prefix strip", () => {
  const brief = buildSectionRepairBrief({
    issues: [{ code: "INTERNAL_INSTRUCTION_LEAK", evidence: "玩家可见：" }],
    packetCapture: capture,
    packetKind: "PUBLIC_STAGE",
  });
  assert.ok(brief.repairPrinciples.some((p) => p.includes("禁止简单字符串删除")));
  assert.ok(brief.prose.includes("Do not patch by deleting prefixes only"));
});
