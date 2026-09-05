/**
 * P8.2.1 Provenance Diff — bad-writer fixtures
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScriptProductionPacketSet } from "../shared/script-production-packets.js";
import { diffWriterResultAgainstPacket } from "../shared/script-writer-provenance-diff.js";
import { makeMutatingWriter } from "../shared/deterministic-test-script-writer.js";
import { buildScriptWriterRequest } from "../shared/script-writer-result-contracts.js";
import { loadGen01Pmd } from "./p821-gen01-fixture.mjs";

describe("P8.2.1 provenance diff bad writers", () => {
  it("FOREIGN_FACT_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const forbidden = role.forbiddenFactIds[0];
    assert.ok(forbidden, "need a forbidden fact for this fixture");
    const writer = makeMutatingWriter((result) => {
      result.sections[0].provenance.sourceFactIds.push(forbidden);
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "f", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    const diff = diffWriterResultAgainstPacket({ packet: role, result });
    assert.equal(diff.status, "INVALID");
    assert.ok(diff.forbiddenSourceRefs.includes(forbidden));
  });

  it("UNKNOWN_BEAT_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const writer = makeMutatingWriter((result) => {
      result.sections[0].provenance.sourceBeatIds.push("beat-does-not-exist");
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "ub", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: role, result }).status, "INVALID");
  });

  it("UNKNOWN_FACT_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const writer = makeMutatingWriter((result) => {
      result.sections[0].provenance.sourceFactIds.push("fact:totally:fake:id");
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "uf", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: role, result }).status, "INVALID");
  });

  it("NEW_STAGE_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const writer = makeMutatingWriter((result) => {
      result.sections[0].inventedStageIds = ["stage_evil"];
      result.sections[0].stageId = "stage_evil";
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "ns", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: role, result }).status, "INVALID");
  });

  it("NEW_CHARACTER_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const writer = makeMutatingWriter((result) => {
      result.sections[0].inventedCharacterIds = ["char_intruder"];
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "nc", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: role, result }).status, "INVALID");
  });

  it("CLUE_FLIP_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const clue = buildScriptProductionPacketSet(pmd).clues[0];
    assert.ok(clue);
    const writer = makeMutatingWriter((result) => {
      result.sections[0].clueSemanticsPatch = {
        ...clue.lockedSemantics,
        isMisleading: !clue.isMisleading,
      };
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "cf", packetKind: "CLUE_WRITER", packet: clue }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: clue, result }).status, "INVALID");
  });

  it("NO_PROVENANCE_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const writer = makeMutatingWriter((result) => {
      result.sections[0].provenance = {
        sourceBeatIds: [],
        sourceClueIds: [],
        sourceFactIds: [],
      };
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "np", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: role, result }).status, "INVALID");
  });

  it("CANON_CHANGE_WRITER → REVIEW_REQUIRED", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const writer = makeMutatingWriter((result) => {
      result.proposedCanonicalChanges = [
        {
          type: "ADD_FACT",
          summary: "钥匙藏在厨房",
          reason: "写顺需要",
          sourceSectionId: result.sections[0].sectionId,
        },
      ];
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "cc", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: role, result }).status, "REVIEW_REQUIRED");
  });

  it("ENDING_INVENTS_TRUTH_WRITER → INVALID", async () => {
    const pmd = loadGen01Pmd();
    const ending = buildScriptProductionPacketSet(pmd).ending;
    const writer = makeMutatingWriter((result) => {
      result.sections[0].canonicalClaims.push({
        claimId: "invented_culprit",
        type: "INVENT_CULPRIT",
        summary: "真凶是某人",
      });
      return result;
    });
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "ei", packetKind: "ENDING", packet: ending }),
    );
    assert.equal(diffWriterResultAgainstPacket({ packet: ending, result }).status, "INVALID");
  });
});
