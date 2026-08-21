import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("zero-world creator landing prioritizes a minimal empty world", () => {
  const firstRun = read("../src/components/first-run-chooser.js");
  const emptyState = read("../src/components/emptyState.js");
  assert.match(firstRun, /先创建一个属于你的世界/);
  assert.match(firstRun, /选择类型 → 命名 → 进入工作区/);
  assert.match(firstRun, /创建空白世界/);
  assert.doesNotMatch(firstRun, /导入剧本|玩家官方示例|open-play-official|data-go="writer"/);
  assert.match(emptyState, /renderFirstRunChooser/);
  assert.match(emptyState, /if\(firstRunChooser\)return firstRunChooser/);
});

test("world creation only asks for product type and one name", () => {
  const wizardStore = read("../src/state/wizard-store.js");
  const wizard = read("../src/runtime/wizard.js");
  const productRegistry = read("../shared/product-domains/registry.js");
  assert.match(wizardStore, /worldName:\s*""/);
  assert.match(wizardStore, /creationType:\s*""/);
  assert.match(wizard, /creating \|\| !selectedCopy \? "disabled"/);
  assert.match(productRegistry, /"murder_mystery", "tabletop_rpg", "board_game"/);
  assert.match(wizard, /createWorld\(\{ name: draft\.worldName, summary: "", settings \}\)/);
  assert.match(wizard, /wizardStore\.set\(\{ wizardDraft: \{ worldName: "", creationType: "" \} \}\)/);
  assert.doesNotMatch(wizard, /bootstrapWorldFromWizard|createTestRoom|data-wizard-next|inviteCode/);
});

test("an existing product opens a type-locked creation flow", () => {
  const wizard = read("../src/runtime/wizard.js");
  const events = read("../src/bootstrap/events.js");
  assert.match(wizard, /const lockedCopy = lockedCreationType \? productDomainDefinition\(lockedCreationType\) : null/);
  assert.match(wizard, /\$\{locked \? "" : `<fieldset class="world-type-fieldset">/);
  assert.doesNotMatch(wizard, /boardOnly/);
  assert.match(events, /productModuleFromShellMode/);
  assert.match(events, /dataset\.productActive === "1"/);
  assert.doesNotMatch(events, /"murder-mystery": "murder_mystery"/);
});

test("onboarding recap action is wired to its dispatcher", () => {
  const onboarding = read("../src/components/onboarding-strip.js");
  const actions = read("../src/runtime/actions-workspace.js");
  assert.match(onboarding, /onboarding-go-archive/);
  assert.match(actions, /case "onboarding-go-archive"/);
});
