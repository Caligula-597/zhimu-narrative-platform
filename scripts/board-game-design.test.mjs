import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_GAME_COMPONENT_TYPES,
  assessBoardGameReadiness,
  createBoardGameComponent,
  createBoardGameMechanism,
  createBoardGameVariable,
  initialBoardGameState,
  simulateBoardGameMechanism,
  normalizeBoardGameDesign
} from "../shared/board-game-design.js";

test("board-game design keeps an empty world empty", () => {
  const design = normalizeBoardGameDesign({}, { title: "空白原型" });
  assert.equal(design.title, "空白原型");
  assert.deepEqual(design.components, []);
  assert.deepEqual(design.variables, []);
  assert.deepEqual(design.mechanisms, []);
  assert.equal(design.rulebook.objective, "");
});

test("board-game components support open custom state fields", () => {
  const component = createBoardGameComponent("custom");
  component.name = "旋转信息环";
  component.stateFields = [{ id: "face", label: "朝向", key: "facing", initialValue: "北" }];
  const design = normalizeBoardGameDesign({ components: [component] });
  assert.equal(design.components[0].name, "旋转信息环");
  assert.deepEqual(design.components[0].stateFields[0], {
    id: "face",
    label: "朝向",
    key: "facing",
    initialValue: "北"
  });
  assert.ok(BOARD_GAME_COMPONENT_TYPES.includes(design.components[0].type));
});

test("board-game deck preserves uploaded assets and editable card entries", () => {
  const component = createBoardGameComponent("deck");
  component.assets.push({ id: "cover", assetId: "asset-1", fileName: "行动牌.png", kind: "image", caption: "红框内是支付费用" });
  component.entries.push({ id: "card-1", name: "强行通过", description: "支付 2 行动力", quantity: 3 });
  const design = normalizeBoardGameDesign({ components: [component] });
  assert.equal(design.components[0].assets[0].caption, "红框内是支付费用");
  assert.equal(design.components[0].entries[0].quantity, 3);
});

test("board-game mechanism evaluates conditions, calculates effects and clamps bounds", () => {
  const variable = createBoardGameVariable();
  variable.id = "energy";
  variable.label = "行动力";
  variable.initialValue = 4;
  variable.min = 0;
  variable.max = 5;
  const mechanism = createBoardGameMechanism("resource_gain", [variable]);
  mechanism.conditions[0] = { id: "condition-1", sourceKey: "energy", operator: "gte", value: "3" };
  mechanism.effects[0] = { id: "effect-1", targetKey: "energy", operation: "add", value: "4" };
  const result = simulateBoardGameMechanism(mechanism, initialBoardGameState([variable]), [variable]);
  assert.equal(result.passed, true);
  assert.equal(result.state.energy, 5);
});

test("board-game readiness describes the minimum playable prototype", () => {
  const variable = createBoardGameVariable();
  const mechanism = createBoardGameMechanism("resource_cost", [variable]);
  const component = createBoardGameComponent("board");
  const readiness = assessBoardGameReadiness({
    components: [component],
    variables: [variable],
    mechanisms: [mechanism],
    rulebook: {
      objective: "最先抵达终点",
      setup: "每人一枚棋子",
      turnStructure: "顺时针行动",
      playerActions: "移动或休整",
      endCondition: "有人抵达终点",
      tieBreak: "剩余资源较多者胜"
    }
  }, 6);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.passed, readiness.total);
});
