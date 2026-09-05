/**
 * P8.2.1 Writer Port — packet allow-lists + DeterministicTestWriter contract
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildScriptProductionPacketSet,
  packetAllowLists,
} from "../shared/script-production-packets.js";
import { DeterministicTestScriptWriter } from "../shared/deterministic-test-script-writer.js";
import { buildScriptWriterRequest } from "../shared/script-writer-result-contracts.js";
import { diffWriterResultAgainstPacket } from "../shared/script-writer-provenance-diff.js";
import { loadGen01Pmd } from "./p821-gen01-fixture.mjs";

describe("P8.2.1 packet allow-lists use real factIds", () => {
  it("role packet separates factIds / beatIds / clueIds / knowledge labels", () => {
    const pmd = loadGen01Pmd();
    const packets = buildScriptProductionPacketSet(pmd);
    const role = packets.roles[0];
    const allows = packetAllowLists(role);
    assert.ok(Array.isArray(allows.allowedFactIds));
    assert.ok(Array.isArray(allows.forbiddenFactIds));
    assert.ok(allows.allowedSourceBeatIds.length >= 1);
    for (const id of allows.allowedFactIds) {
      assert.ok(!/[\u4e00-\u9fff]/.test(id) || id.startsWith("fact:"), `unexpected factId ${id}`);
    }
  });
});

describe("P8.2.1 DeterministicTestScriptWriter", () => {
  it("GOOD_WRITER Packet in → structured sections CLEAN", async () => {
    const pmd = loadGen01Pmd();
    const role = buildScriptProductionPacketSet(pmd).roles[0];
    const writer = new DeterministicTestScriptWriter();
    const result = await writer.write(
      buildScriptWriterRequest({ requestId: "g", packetKind: "ROLE_SCRIPT", packet: role }),
    );
    assert.ok(result.sections.length >= 1);
    assert.ok(result.sections[0].provenance);
    assert.equal(diffWriterResultAgainstPacket({ packet: role, result }).status, "CLEAN");
  });
});
