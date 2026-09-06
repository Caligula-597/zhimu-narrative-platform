/**
 * P10.5 Writer Rendering Adherence unit tests + RPT1C localization.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  diffPackageRenderingAgainstGrounded,
  diffWriterRenderingAgainstGroundedPacket,
  foldRenderingAdherenceIntoStatus,
} from "../shared/script-writer-rendering-adherence-diff.js";
import { approveCompleteScriptPackage } from "../shared/script-production-orchestrator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN = path.join(
  root,
  "trials/rpt-1-closed-after-hours/runs/2026-09-06T09-32-02-159Z",
);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const capture = {
  templateId: "M12-1",
  roles: { seeker: "沈岚", holder: "梁赫" },
  stake: "未公开的预展目录册",
  exchange: { beforeOwner: "梁赫", afterOwner: "沈岚 独占" },
};

test("P10.5 detects RELATION_INVERTED when seeker holds stake", () => {
  const r = diffWriterRenderingAgainstGroundedPacket({
    packetKind: "ROLE_SCRIPT",
    packet: { characterId: "P1", characterName: "沈岚" },
    characterName: "沈岚",
    packetCaptures: [capture],
    result: {
      sections: [
        {
          paragraphs: [
            "你手中的筹码：那本未公开的预展目录册。你并不想轻易交出它，将未公开的预展目录册交到对方手中。",
          ],
        },
      ],
    },
  });
  assert.ok(r.codes.includes("RELATION_INVERTED"), JSON.stringify(r.issues));
  assert.equal(r.status, "REVIEW_REQUIRED");
});

test("P10.5 detects CHOICE_PRE_RESOLVED and instruction leak", () => {
  const r = diffWriterRenderingAgainstGroundedPacket({
    packetKind: "PUBLIC_STAGE",
    packetCaptures: [capture],
    result: {
      sections: [
        {
          paragraphs: [
            "玩家可见：交换条件。仅同场，不暗示因果。对方犹豫片刻，最终点头接受了你的条件。无论过程如何，你们达成了协议。",
          ],
        },
      ],
    },
  });
  assert.ok(r.codes.includes("CHOICE_PRE_RESOLVED"));
  assert.ok(r.codes.includes("INTERNAL_INSTRUCTION_LEAK"));
});

test("P10.5 detects ROLE_SCOPE_INVENTED for non-primary", () => {
  const r = diffWriterRenderingAgainstGroundedPacket({
    packetKind: "ROLE_SCRIPT",
    packet: { characterId: "P3", characterName: "白绫" },
    characterName: "白绫",
    packetCaptures: [capture],
    result: {
      sections: [
        {
          paragraphs: [
            "你握有一份关键筹码——未公开的预展目录册。你提出交换代价，接受或改写要约，完成了交接。",
          ],
        },
      ],
    },
  });
  assert.ok(r.codes.includes("ROLE_SCOPE_INVENTED"), JSON.stringify(r.issues));
});

test("P10.5 fold status and approve block on rendering", () => {
  assert.equal(foldRenderingAdherenceIntoStatus("GENERATED", { ok: false }), "REVIEW_REQUIRED");
  const approval = approveCompleteScriptPackage(
    { status: "READY_FOR_REVIEW", diagnostics: [], roles: [], stages: [] },
    { ok: true },
    { sectionStates: [], renderingAdherence: { ok: false, issues: [{ code: "RELATION_INVERTED" }] } },
  );
  assert.equal(approval.ok, false);
  assert.equal(approval.reason, "rendering_review_required");
});

test("P10.5 RPT1C package localizes all four defect classes", () => {
  const pkg = readJson(path.join(RUN, "complete-script-package.json"));
  const audit = readJson(path.join(RUN, "projection-audit.json"));
  const adherence = diffPackageRenderingAgainstGrounded({
    package: pkg,
    packetCaptures: audit.packetCaptures,
    groundedExperience: { captures: audit.packetCaptures },
  });
  assert.equal(adherence.status, "RENDERING_REVIEW_REQUIRED");
  for (const code of [
    "RELATION_INVERTED",
    "ROLE_SCOPE_INVENTED",
    "CHOICE_PRE_RESOLVED",
    "INTERNAL_INSTRUCTION_LEAK",
  ]) {
    assert.ok(adherence.codes.includes(code), `missing ${code}: ${adherence.codes.join(",")}`);
  }
  assert.equal(adherence.expected.seeker, "沈岚");
  assert.equal(adherence.expected.holder, "梁赫");
});
