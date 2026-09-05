/**
 * Shared GEN-01 PMD loader for P8.2.1 tests.
 */
import path from "node:path";
import {
  buildProjectStoryStateFromFixture,
  listCaseFixturePaths,
  loadCaseFixture,
} from "../shared/p8-generalization-runner.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";

export const FIXED_NOW = () => "2026-09-05T18:00:00.000Z";

export function loadGen01Pmd() {
  const gen01 = listCaseFixturePaths().find((p) => path.basename(p).startsWith("GEN-01"));
  const fixture = loadCaseFixture(gen01);
  let state = buildProjectStoryStateFromFixture(fixture);
  state = integrateMasterOutline(state, { now: FIXED_NOW });
  return expandProductionMasterDraft(state, {
    now: FIXED_NOW,
    title: `${fixture.caseId} ${fixture.title}`,
  });
}
