import assert from "node:assert/strict";
import test from "node:test";
import {
  creatorTerms,
  legacyWorldModeForNarrativeProfile,
  narrativeProfileFromSettings,
  normalizeNarrativeProfile,
  normalizeNarrativeSettings,
  normalizeNarrativeSettingsPatch
} from "../shared/narrative-profile.js";
import { creatorTerms as legacyCreatorTerms } from "../shared/creator-terminology.js";

test("legacy scripted worlds normalize to the murder mystery one-shot profile", () => {
  assert.deepEqual(narrativeProfileFromSettings({ worldMode: "scripted" }), {
    version: 1,
    creationType: "murder_mystery",
    runFormat: "single_session",
    roleMode: "fixed",
    ruleset: { mode: "none", key: "", diceNotation: "" }
  });
});

test("legacy campaign worlds normalize to the tabletop campaign profile", () => {
  const profile = narrativeProfileFromSettings({ worldMode: "campaign" });
  assert.equal(profile.creationType, "tabletop_rpg");
  assert.equal(profile.runFormat, "campaign");
  assert.equal(profile.roleMode, "mixed");
  assert.equal(profile.ruleset.mode, "system_neutral");
});

test("legacy hybrid preserves the existing long-form murder mystery behavior", () => {
  const profile = narrativeProfileFromSettings({ worldMode: "hybrid" });
  assert.equal(profile.creationType, "murder_mystery");
  assert.equal(profile.runFormat, "campaign");
  assert.equal(legacyWorldModeForNarrativeProfile(profile), "hybrid");
});

test("canonical narrative settings preserve unrelated world settings", () => {
  const settings = normalizeNarrativeSettings({
    worldMode: "campaign",
    contentSource: "document",
    creatorBrief: { logline: "测试" }
  });
  assert.equal(settings.contentSource, "document");
  assert.deepEqual(settings.creatorBrief, { logline: "测试" });
  assert.equal(settings.creationType, "tabletop_rpg");
  assert.equal(settings.narrativeProfile.version, 1);
});

test("unrelated settings patches are not populated with default narrative fields", () => {
  assert.deepEqual(normalizeNarrativeSettingsPatch({ coverAssetId: "asset-1" }), {
    coverAssetId: "asset-1"
  });
});

test("invalid profile values fall back to the selected creation type defaults", () => {
  const profile = normalizeNarrativeProfile({
    creationType: "tabletop_rpg",
    runFormat: "invalid",
    roleMode: "invalid",
    ruleset: { mode: "invalid", key: "custom", diceNotation: "2d6" }
  });
  assert.equal(profile.runFormat, "campaign");
  assert.equal(profile.roleMode, "mixed");
  assert.deepEqual(profile.ruleset, { mode: "system_neutral", key: "custom", diceNotation: "2d6" });
});

test("legacy terminology imports retain their existing labels", () => {
  assert.equal(creatorTerms("murder_mystery").clue, "线索");
  assert.equal(creatorTerms("tabletop_rpg").clue, "HO");
  assert.equal(creatorTerms("board_game").role, "玩家席位");
  assert.equal(creatorTerms("board_game").act, "阶段");
  assert.equal(creatorTerms("interactive_story").host, "导演");
  assert.equal(legacyCreatorTerms("tabletop_rpg").host, "KP");
});

test("board-game profile is first-class while keeping legacy mode compatibility", () => {
  const profile = normalizeNarrativeProfile({ creationType: "board_game" });
  assert.equal(profile.creationType, "board_game");
  assert.equal(profile.roleMode, "player_created");
  assert.equal(profile.ruleset.mode, "custom");
  assert.equal(legacyWorldModeForNarrativeProfile(profile), "campaign");
});
