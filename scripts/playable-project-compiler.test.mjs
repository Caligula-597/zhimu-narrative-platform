/**
 * P7.0 Playable Compiler tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  compileWarehouseSixFixture,
  compilePlayableProject,
  buildWarehouseSixFixture,
  assertSourceFidelity,
  WAREHOUSE_SIX_FIXTURE_REVISION,
} from "../shared/playable-project-compiler.js";
import {
  normalizePlayableProject,
  validateRuntimeEffect,
  listContentUnitsForRole,
  refreshPlayableProjectStale,
  playableSourceFingerprint,
} from "../shared/playable-project-contracts.js";

const FIXED = () => "2026-09-05T00:00:00.000Z";

test("fixture → PlayableProject READY", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  assert.equal(pp.status, "READY");
  assert.equal(pp.diagnostics.filter((d) => d.severity === "ERROR").length, 0);
});

test("6 player + 1 host roles", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  assert.equal(pp.roles.filter((r) => r.type === "PLAYER").length, 6);
  assert.equal(pp.roles.filter((r) => r.type === "HOST").length, 1);
});

test("stage order kept", () => {
  const fixture = buildWarehouseSixFixture();
  const pp = compilePlayableProject(fixture, { now: FIXED });
  assert.deepEqual(
    pp.stages.map((s) => s.id),
    fixture.stages.map((s) => s.id),
  );
});

test("private / public / host-only audience", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  const priv = pp.contentUnits.find((c) => c.id === "cu_a_s1");
  assert.equal(priv.audience.visibility, "PRIVATE");
  assert.deepEqual(priv.audience.roleIds, ["role_a"]);
  const pub = pp.contentUnits.find((c) => c.id === "cu_public_s1");
  assert.equal(pub.audience.visibility, "PUBLIC");
  const host = pp.contentUnits.find((c) => c.id.startsWith("cu_host_"));
  assert.equal(host.audience.visibility, "HOST_ONLY");
  assert.ok(!host.audience.roleIds.includes("role_a"));
});

test("clue single source via contentUnit", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  for (const clue of pp.clues) {
    const cu = pp.contentUnits.find((c) => c.id === clue.contentUnitId);
    assert.ok(cu);
    assert.equal(cu.type, "CLUE");
    assert.ok(cu.content.length > 0);
  }
  assert.ok(pp.clues.length >= 3);
});

test("M03 and M09 placements + outcome bindings", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  const m03 = pp.mechanismPlacements.find((m) => m.familyId === "M03");
  const m09 = pp.mechanismPlacements.find((m) => m.familyId === "M09");
  assert.ok(m03);
  assert.ok(m09);
  assert.ok(m03.outcomeBindings.length >= 1);
  assert.ok(m09.outcomeBindings.length >= 1);
  for (const ef of m03.outcomeBindings[0].effects) {
    assert.equal(ef.valid, true);
  }
});

test("four effect schemas validate", () => {
  assert.equal(validateRuntimeEffect({ type: "PERMISSION_GRANT", permissionId: "p1", target: "WINNER" }).ok, true);
  assert.equal(validateRuntimeEffect({ type: "PERMISSION_REVOKE", permissionId: "p1", target: "WINNER" }).ok, true);
  assert.equal(validateRuntimeEffect({ type: "STATE_APPLY", key: "k", value: 1 }).ok, true);
  assert.equal(validateRuntimeEffect({ type: "STATE_CLEAR", key: "k" }).ok, true);
  assert.equal(validateRuntimeEffect({ type: "PERMISSION_GRANT" }).ok, false);
});

test("unknown role → ERROR / INVALID", () => {
  const fixture = buildWarehouseSixFixture();
  const broken = {
    ...fixture,
    roleScripts: {
      ...fixture.roleScripts,
      role_ghost: [{ id: "g1", stageId: "stage_1", title: "x", paragraphs: ["y"] }],
    },
  };
  const pp = compilePlayableProject(broken, { now: FIXED });
  assert.ok(pp.diagnostics.some((d) => d.code === "UNKNOWN_ROLE_REF" && d.severity === "ERROR"));
  assert.equal(pp.status, "INVALID");
});

test("unknown stage → ERROR", () => {
  const fixture = buildWarehouseSixFixture();
  const broken = {
    ...fixture,
    publicScripts: [
      ...fixture.publicScripts,
      { id: "bad", stageId: "stage_missing", title: "x", paragraphs: ["y"] },
    ],
  };
  const pp = compilePlayableProject(broken, { now: FIXED });
  assert.ok(pp.diagnostics.some((d) => d.code === "UNKNOWN_STAGE_REF"));
  assert.equal(pp.status, "INVALID");
});

test("duplicate id → ERROR", () => {
  const fixture = buildWarehouseSixFixture();
  const broken = {
    ...fixture,
    roles: [...fixture.roles, { ...fixture.roles[1], name: "dup" }],
  };
  const pp = compilePlayableProject(broken, { now: FIXED });
  assert.ok(pp.diagnostics.some((d) => d.code === "DUPLICATE_ID"));
  assert.equal(pp.status, "INVALID");
});

test("sourceRef coverage + no text rewrite + deterministic", () => {
  const fixture = buildWarehouseSixFixture();
  const a = compilePlayableProject(fixture, { now: FIXED });
  const b = compilePlayableProject(fixture, { now: FIXED });
  assert.equal(assertSourceFidelity(fixture, a).length, 0);
  for (const cu of a.contentUnits) {
    assert.ok(cu.sourceRef?.sourceType);
  }
  assert.deepEqual(
    a.contentUnits.map((c) => c.content),
    b.contentUnits.map((c) => c.content),
  );
  assert.equal(a.source.fingerprint, b.source.fingerprint);
});

test("persistence roundtrip normalize", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  const round = normalizePlayableProject(JSON.parse(JSON.stringify(pp)));
  assert.equal(round.status, "READY");
  assert.equal(round.contentUnits.length, pp.contentUnits.length);
  assert.equal(round.mechanismPlacements.length, 2);
});

test("source revision change → stale", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  const stale = refreshPlayableProjectStale(pp, {
    sourceFingerprint: playableSourceFingerprint({
      sourceType: "FIXTURE",
      sourceId: pp.source.fixtureId,
      sourceRevision: "9.9.9",
      fixtureId: pp.source.fixtureId,
    }),
  });
  assert.equal(stale.isStale, true);
  assert.equal(stale.status, "STALE");
  void WAREHOUSE_SIX_FIXTURE_REVISION;
});

test("simulate role A sees private not host-only", () => {
  const pp = compileWarehouseSixFixture({ now: FIXED });
  const units = listContentUnitsForRole(pp, "role_a");
  assert.ok(units.some((u) => u.id === "cu_a_s1"));
  assert.ok(!units.some((u) => u.audience.visibility === "HOST_ONLY"));
  assert.ok(units.some((u) => u.audience.visibility === "PUBLIC"));
});
