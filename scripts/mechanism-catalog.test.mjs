import assert from "node:assert/strict";
import test from "node:test";
import {
  MECHANISM_KIT_TEMPLATES,
  applyMechanismKitToDesign,
  getMechanismKit,
  isMechanismKitKey,
  listMechanismKits,
  mechanismCatalogFamilies,
} from "../shared/mechanism-catalog.js";
import {
  normalizeMechanismDesign,
  mechanismDesignCoverage,
} from "../shared/mechanism-design.js";
import { isMechanismInteractionKind } from "../shared/mechanism-interactions.js";
import { MINI_GAME_PLUGIN_KEYS } from "../shared/mini-game-protocol.js";

test("mechanism catalog covers reusable murder-mystery directions", () => {
  assert.ok(MECHANISM_KIT_TEMPLATES.length >= 18);
  const families = mechanismCatalogFamilies();
  for (const required of [
    "权限交换",
    "资源分配",
    "证据资格",
    "竞价与交换",
    "空间访问",
    "轮值职责",
  ]) {
    assert.ok(families.includes(required), `missing family ${required}`);
  }
  for (const required of [
    "search_depletion",
    "clue_destroy_forge",
    "identity_appearance",
    "parallel_booklet",
    "song_guess",
    "dual_host_split",
  ]) {
    assert.ok(isMechanismKitKey(required), `missing kit ${required}`);
  }
});

test("every kit maps to a known interaction kind and optional mini-game plugin", () => {
  for (const kit of MECHANISM_KIT_TEMPLATES) {
    assert.equal(
      isMechanismInteractionKind(kit.interactionKind),
      true,
      kit.key,
    );
    if (kit.miniGamePluginKey) {
      assert.ok(
        MINI_GAME_PLUGIN_KEYS.includes(kit.miniGamePluginKey),
        `${kit.key} -> ${kit.miniGamePluginKey}`,
      );
    }
  }
});

test("applying a kit seeds design fields without wiping later author edits", () => {
  const seeded = normalizeMechanismDesign(
    applyMechanismKitToDesign({}, "search_depletion"),
  );
  assert.equal(seeded.templateKey, "search_depletion");
  assert.equal(
    seeded.interactionKind,
    getMechanismKit("search_depletion").interactionKind,
  );
  assert.ok(seeded.recurringAction);
  assert.ok(mechanismDesignCoverage(seeded).filled >= 5);

  const preserved = normalizeMechanismDesign(
    applyMechanismKitToDesign(
      { title: "自定义搜证", recurringAction: "作者自己写的动作" },
      "search_depletion",
    ),
  );
  assert.equal(preserved.title, "自定义搜证");
  assert.equal(preserved.recurringAction, "作者自己写的动作");
});

test("listMechanismKits can filter by genre and capability", () => {
  const ready = listMechanismKits({ capability: "ready" });
  assert.ok(ready.length > 0);
  assert.ok(ready.every((kit) => kit.capability === "ready"));
  const search = listMechanismKits({ genre: "搜证" });
  assert.ok(search.some((kit) => kit.key === "search_depletion"));
});
