/**
 * P8.0.2 Semantic Fact Scope + causal topology helpers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeterministicFactId,
  factsSatisfy,
  factTypesCompatible,
  matchProducedToRequired,
  normalizeSemanticFactRef,
  positionIsBefore,
  scopesOverlap,
} from "../shared/semantic-fact.js";

describe("P8.0.2 semantic facts", () => {
  it("factType same + different scope does not cross-block match", () => {
    const a = normalizeSemanticFactRef(
      { factType: "identity_latent", summary: "a" },
      { sourceBlockId: "smb_a", sourceBeatId: "beat-setup", characterIds: ["H1"] },
    );
    const b = normalizeSemanticFactRef(
      { factType: "identity_latent", summary: "b" },
      { sourceBlockId: "smb_b", sourceBeatId: "beat-setup", characterIds: ["H6"] },
    );
    assert.notEqual(a.factId, b.factId);
    assert.equal(factsSatisfy(a, b), false);
    assert.deepEqual(matchProducedToRequired([a], [b]), []);
  });

  it("same-block same type matches even with different character attribution", () => {
    const prod = normalizeSemanticFactRef(
      { factType: "identity_clue" },
      { sourceBlockId: "smb_x", sourceBeatId: "beat-setup", characterIds: ["H1"] },
    );
    const req = normalizeSemanticFactRef(
      { factType: "identity_clue" },
      { sourceBlockId: "smb_x", sourceBeatId: "beat-develop", characterIds: ["H6"] },
    );
    assert.notEqual(prod.factId, req.factId);
    assert.equal(factsSatisfy(prod, req), true);
    assert.ok(matchProducedToRequired([prod], [req]).length >= 1);
  });

  it("substring factTypes no longer compatible", () => {
    assert.equal(factTypesCompatible("identity", "identity_clue"), false);
  });

  it("deterministic factId is stable", () => {
    const id1 = buildDeterministicFactId({
      sourceBlockId: "smb_1",
      sourceBeatId: "beat-setup",
      factType: "site_accessible",
      scope: { characterIds: ["A"] },
    });
    const id2 = buildDeterministicFactId({
      sourceBlockId: "smb_1",
      sourceBeatId: "beat-setup",
      factType: "site_accessible",
      scope: { characterIds: ["A"] },
    });
    assert.equal(id1, id2);
    assert.match(id1, /^fact:smb_1:beat-setup:site_accessible:A$/);
  });

  it("scopesOverlap requires shared owner ids", () => {
    assert.equal(
      scopesOverlap({ characterIds: ["A"] }, { characterIds: ["B"] }),
      false,
    );
    assert.equal(
      scopesOverlap({ characterIds: ["A", "B"] }, { characterIds: ["B"] }),
      true,
    );
  });

  it("positionIsBefore respects stage then beat index", () => {
    assert.equal(positionIsBefore({ stageIndex: 0, beatIndex: 2 }, { stageIndex: 1, beatIndex: 0 }), true);
    assert.equal(positionIsBefore({ stageIndex: 1, beatIndex: 4 }, { stageIndex: 1, beatIndex: 1 }), false);
    assert.equal(positionIsBefore({ stageIndex: 2, beatIndex: 0 }, { stageIndex: 2, beatIndex: 3 }), true);
  });
});
