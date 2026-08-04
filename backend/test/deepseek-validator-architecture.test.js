import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(backendRoot, relativePath), "utf8");

test("deepseek validator facade preserves its public contract", async () => {
  const facade = await import("../src/deepseek-validators.js");
  assert.deepEqual(Object.keys(facade).sort(), [
    "chapterNarrativeMinChars",
    "mergeStoryOutlineAssembly",
    "normalizeStoryBrief",
    "validateChapterNarrative",
    "validateDeepseekProposal",
    "validateManuscriptSynopsis",
    "validateOutlineBatchDiversity",
    "validateRoleMatrix",
    "validateRoleScriptFromNarrative",
    "validateRoleSection",
    "validateRolesFromNarrative",
    "validateRolesMeta",
    "validateStoryEvaluation",
    "validateStoryOutline",
    "validateStoryOutlineAssemblyComponent",
    "validateStoryOutlineBlueprint",
    "validateStorySpec"
  ]);
});

test("deepseek public facade contains compatibility exports only", async () => {
  const facade = await read("src/deepseek-validators.js");

  assert.match(facade, /deepseek-validation\/input-contract\.js/);
  assert.match(facade, /deepseek-validation\/blueprint-validator\.js/);
  assert.match(facade, /deepseek-validation\/assembly-component-validator\.js/);
  assert.match(facade, /deepseek-validation\/assembly-merge\.js/);
  assert.match(facade, /deepseek-validation\/legacy-outline-reader\.js/);
  assert.match(facade, /deepseek-validation\/proposal-validator\.js/);
  assert.match(facade, /deepseek-validation\/role-validators\.js/);
  assert.match(facade, /deepseek-validation\/manuscript-validators\.js/);
  assert.match(facade, /deepseek-validation\/evaluation-validator\.js/);
  assert.doesNotMatch(facade, /^(?:export )?function\b/m);
  assert.doesNotMatch(facade, /api-errors\.js|prompts\/shared\.js/);
});

test("deepseek lifecycle modules remain acyclic and responsibility scoped", async () => {
  const modules = Object.fromEntries(await Promise.all([
    "constants.js",
    "primitives.js",
    "input-contract.js",
    "blueprint-contract.js",
    "blueprint-validator.js",
    "blueprint/policy.js",
    "blueprint/validation-context.js",
    "blueprint/rules/index.js",
    "blueprint/rules/core-identity.js",
    "blueprint/rules/genre-state-resource.js",
    "blueprint/rules/semantic-evidence.js",
    "blueprint/rules/ending-contract.js",
    "assembly-component-validator.js",
    "assembly-merge.js",
    "legacy-outline-reader.js",
    "proposal-validator.js",
    "role-validators.js",
    "manuscript-validators.js",
    "evaluation-validator.js"
  ].map(async (name) => [name, await read(`src/deepseek-validation/${name}`)])));

  for (const [name, source] of Object.entries(modules)) {
    assert.doesNotMatch(source, /deepseek-validators\.js|\/deepseek\.js/, `${name} must not import the DeepSeek public facade`);
  }

  for (const [name, source] of Object.entries(modules)) {
    if (name !== "legacy-outline-reader.js") {
      assert.doesNotMatch(source, /outline-quality-validator\.js/, `${name} must not bypass its lifecycle boundary`);
    }
  }

  assert.match(modules["legacy-outline-reader.js"], /outline-quality-validator\.js/);
  assert.doesNotMatch(modules["input-contract.js"], /validateStoryOutlineBlueprint|mergeStoryOutlineAssembly|validateStoryOutlineV2/);
  assert.match(modules["blueprint-validator.js"], /blueprint\/rules\/index\.js/);
  assert.match(modules["blueprint-validator.js"], /blueprint\/validation-context\.js/);
  assert.match(modules["blueprint/validation-context.js"], /blueprint-contract\.js/);
  assert.doesNotMatch(modules["blueprint-contract.js"], /throwErr|issues|validateStoryOutlineBlueprint/);
  assert.doesNotMatch(modules["blueprint/validation-context.js"], /throwErr|DEEPSEEK_OUTPUT_INVALID/);
  assert.doesNotMatch(modules["blueprint/rules/core-identity.js"], /validateBlueprintGenreStateResource|validateBlueprintSemanticEvidence|validateBlueprintEndingContract/);
  assert.doesNotMatch(modules["blueprint/rules/genre-state-resource.js"], /validateBlueprintCoreIdentity|validateBlueprintSemanticEvidence|validateBlueprintEndingContract/);
  assert.doesNotMatch(modules["blueprint/rules/semantic-evidence.js"], /validateBlueprintCoreIdentity|validateBlueprintGenreStateResource|validateBlueprintEndingContract/);
  assert.doesNotMatch(modules["blueprint/rules/ending-contract.js"], /validateBlueprintCoreIdentity|validateBlueprintGenreStateResource|validateBlueprintSemanticEvidence/);
  assert.doesNotMatch(modules["blueprint-validator.js"], /mergeStoryOutlineAssembly|validateStoryOutlineV2|validateRole/);
  assert.match(modules["assembly-component-validator.js"], /story-outline-contract\/vocabulary\.js/);
  assert.match(modules["assembly-merge.js"], /story-outline-contract\/vocabulary\.js/);
  assert.doesNotMatch(modules["assembly-component-validator.js"], /mergeStoryOutlineAssembly|validateStoryOutlineBlueprint|validateStoryOutlineV2|validateRole/);
  assert.doesNotMatch(modules["assembly-merge.js"], /validateStoryOutlineAssemblyComponent|validateStoryOutlineBlueprint|validateStoryOutlineV2|validateRole/);
  assert.doesNotMatch(modules["legacy-outline-reader.js"], /validateStoryOutlineBlueprint|mergeStoryOutlineAssembly|validateRole/);
  assert.doesNotMatch(modules["proposal-validator.js"], /validateRole|validateChapterNarrative|validateStoryEvaluation/);
  assert.doesNotMatch(modules["role-validators.js"], /validateDeepseekProposal|validateStoryEvaluation/);
  assert.doesNotMatch(modules["manuscript-validators.js"], /validateRoleMatrix|validateStoryEvaluation/);
  assert.doesNotMatch(modules["evaluation-validator.js"], /validateRole|validateChapterNarrative|validateDeepseekProposal/);

  const orchestrator = await read("src/deepseek.js");
  assert.match(orchestrator, /deepseek-outline-repair\/issue-policy\.js/);
  assert.match(orchestrator, /deepseek-outline-repair\/json-pointer-patch\.js/);
  assert.doesNotMatch(orchestrator, /function applyJsonPointerPatches|const PATCHABLE_(?:BLUEPRINT|ASSEMBLY)_ISSUE/);
});

test("blueprint rule order and issue arrays remain deterministic contracts", async () => {
  const ruleIndex = await read("src/deepseek-validation/blueprint/rules/index.js");
  const expectedOrder = [
    "validateBlueprintCoreIdentity",
    "validateBlueprintGenreStateResource",
    "validateBlueprintSemanticEvidence",
    "validateBlueprintEndingContract"
  ];
  const orderStart = ruleIndex.indexOf("Object.freeze([");
  const positions = expectedOrder.map((name) => ruleIndex.indexOf(name, orderStart));
  assert.ok(positions.every((position) => position >= orderStart));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);

  const { ValidationIssueCollector } = await import("../src/deepseek-validation/blueprint/validation-context.js");
  const issues = new ValidationIssueCollector();
  issues.push("first", "second");
  const snapshot = issues.toArray();
  assert.equal(Array.isArray(snapshot), true);
  assert.deepEqual(snapshot, ["first", "second"]);
  snapshot.push("outside");
  assert.deepEqual(issues.toArray(), ["first", "second"]);
});

test("generation and acceptance validators share neutral outline vocabulary by identity", async () => {
  const [vocabulary, qualityConstants] = await Promise.all([
    import("../src/story-outline-contract/vocabulary.js"),
    import("../src/outline-quality/constants.js")
  ]);
  const sharedNames = [
    "OUTLINE_VERSION",
    "OUTLINE_REVISION",
    "OUTLINE_REVISIONS",
    "ENTITY_TYPES",
    "RESPONSIBILITY_TYPES",
    "CAUSAL_RESPONSIBILITY_TYPES",
    "AUTHORIZATION_STATUSES",
    "OPTION_EFFECT_OPERATIONS",
    "RESOURCE_VALUE_TYPES",
    "RESOURCE_OWNER_TYPES",
    "INTERNAL_CHOICE_LANGUAGE",
    "INTERNAL_NARRATIVE_LANGUAGE",
    "SOURCE_SHELL_ENTITY",
    "GENERIC_FINGERPRINT",
    "GENERIC_ENDING_TITLE",
    "GENERIC_RESPONSIBILITY_ACTION",
    "GENERIC_RESPONSIBILITY_EFFECT",
    "MISDIRECTION_KINDS",
    "BATCH_FINGERPRINT_FIELDS"
  ];
  for (const name of sharedNames) assert.strictEqual(qualityConstants[name], vocabulary[name], `${name} must have one owner`);

  const blueprintPolicy = await read("src/deepseek-validation/blueprint/policy.js");
  assert.match(blueprintPolicy, /UNRESOLVED_BLUEPRINT_LOGIC/);
  assert.doesNotMatch(blueprintPolicy, /ENTITY_TYPES|MISDIRECTION_KINDS|FINGERPRINT_FIELDS|INTERNAL_NARRATIVE_LANGUAGE|GENERIC_RESPONSIBILITY/);
});

test("outline assembly structure has one neutral executable owner", async () => {
  const structure = await import("../src/story-outline-contract/structure.js");
  assert.deepEqual(structure.OUTLINE_ASSEMBLY_COMPONENTS, [
    {
      key: "playerActions",
      assemblyField: "playerChapterActions",
      blueprintSlot: "players[].chapterActions"
    },
    {
      key: "chapterBeats",
      assemblyField: "chapterBeats",
      blueprintSlot: "chapterBeats"
    },
    {
      key: "styleExpressions",
      assemblyField: "styleChapterExpressions",
      blueprintSlot: "styleContract.chapterExpressions"
    }
  ]);
  assert.deepEqual(structure.OUTLINE_ASSEMBLY_COMPONENT_KEYS, [
    "playerActions",
    "chapterBeats",
    "styleExpressions"
  ]);
  assert.deepEqual(structure.OUTLINE_ASSEMBLY_ROOT_FIELDS, [
    "playerChapterActions",
    "chapterBeats",
    "styleChapterExpressions"
  ]);
  assert.deepEqual(structure.OUTLINE_ASSEMBLY_ROOT_POINTERS, [
    "/playerChapterActions",
    "/chapterBeats",
    "/styleChapterExpressions"
  ]);
  assert.equal(structure.getOutlineAssemblyField("playerActions"), "playerChapterActions");
  assert.equal(structure.getOutlineAssemblyField("unknown"), null);
  assert.equal(structure.getOutlineBlueprintSlotPath("playerActions", 2), "players[2].chapterActions");
  assert.deepEqual(
    structure.findUnexpectedOutlineAssemblyFields({ playerChapterActions: [], truthTimeline: "forbidden" }),
    ["truthTimeline"]
  );
  assert.ok(Object.isFrozen(structure.OUTLINE_ASSEMBLY_COMPONENTS));
  assert.ok(structure.OUTLINE_ASSEMBLY_COMPONENTS.every(Object.isFrozen));

  const draft = {
    players: [{ chapterActions: [{ chapterKey: "chapter-1" }] }],
    chapterBeats: [{ chapterKey: "chapter-1" }],
    styleContract: { chapterExpressions: [{ chapterKey: "chapter-1" }] }
  };
  assert.strictEqual(structure.resetOutlineAssemblyBlueprintSlots(draft), draft);
  assert.deepEqual(draft.players[0].chapterActions, []);
  assert.deepEqual(draft.chapterBeats, []);
  assert.deepEqual(draft.styleContract.chapterExpressions, []);

  const [contractSource, componentValidator, assemblyMerge, blueprintContract, outlinePrompt, pipeline] = await Promise.all([
    read("src/story-outline-contract/structure.js"),
    read("src/deepseek-validation/assembly-component-validator.js"),
    read("src/deepseek-validation/assembly-merge.js"),
    read("src/deepseek-validation/blueprint-contract.js"),
    read("src/prompts/outline.js"),
    read("src/deepseek.js")
  ]);
  assert.doesNotMatch(contractSource, /deepseek-validation|outline-quality|prompts\/outline|deepseek\.js/);
  for (const source of [componentValidator, assemblyMerge, blueprintContract, outlinePrompt, pipeline]) {
    assert.match(source, /story-outline-contract\/structure\.js/);
  }
  assert.doesNotMatch(componentValidator, /fieldByComponent/);
  assert.doesNotMatch(assemblyMerge, /\["playerChapterActions", "chapterBeats", "styleChapterExpressions"\]/);
});

test("V2.2 blueprint materialization uses the shared fingerprint field contract", async () => {
  const { materializeBlueprintGenerationContract } = await import("../src/deepseek-validation/blueprint-contract.js");
  const result = materializeBlueprintGenerationContract(
    {
      players: [{ chapterActions: [{ chapterKey: "chapter-1" }] }],
      batchFingerprint: { storyEngine: "draft" },
      styleContract: { chapterExpressions: [{ chapterKey: "chapter-1" }] }
    },
    { outlineRevision: "2.2", storyEngine: "locked-engine" },
    { chapterKeys: [] }
  );
  assert.equal(result.batchFingerprint.storyEngine, "locked-engine");
  assert.deepEqual(result.players[0].chapterActions, []);
  assert.deepEqual(result.chapterBeats, []);
  assert.deepEqual(result.styleContract.chapterExpressions, []);
});
