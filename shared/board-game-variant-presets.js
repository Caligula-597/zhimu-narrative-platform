import { createLastLighthouseDesign } from "./last-lighthouse-preset.js";

const clone = (value) => structuredClone(value);

export const BOARD_GAME_PRESET_CATALOG = Object.freeze([
  { id: "last-lighthouse-standard", label: "潮痕标准局", summary: "半合作灯塔建设，验证基础资源闭环。" },
  { id: "last-lighthouse-black-tide", label: "黑潮压境", summary: "更短回合、更低稳定度，验证生存压力。" },
  { id: "last-lighthouse-trade-route", label: "群岛商路", summary: "提高贸易与影响力，验证区域经营。" },
  { id: "last-lighthouse-race", label: "灯火竞速", summary: "更快结束、更低单次建设收益，验证竞速。" }
]);

function setVariable(design, id, initialValue) {
  const variable = design.variables.find((item) => item.id === id);
  if (variable) variable.initialValue = initialValue;
}

function setStateField(design, key, value) {
  const field = design.components.flatMap((component) => component.stateFields || []).find((item) => item.key === key);
  if (field) field.initialValue = value;
}

function setRulebook(design, objective, setup, notes) {
  design.rulebook.objective = objective;
  design.rulebook.setup = setup;
  design.rulebook.notes = notes;
}

export function createBoardGamePreset(presetId = "last-lighthouse-standard") {
  const design = clone(createLastLighthouseDesign());
  if (presetId === "last-lighthouse-black-tide") {
    design.title = "最后灯塔：黑潮压境";
    design.designGoal = "在六轮黑潮中维持世界稳定，验证高压半合作的容错边界。";
    design.playTimeMinutes = 28;
    setVariable(design, "stability", 6);
    setVariable(design, "supply", 3);
    setVariable(design, "material", 1);
    setVariable(design, "energy", 0);
    setVariable(design, "influence", 1);
    setStateField(design, "stability", "6 / 10");
    design.engine.maxRounds = 6;
    design.components.find((component) => component.id === "component-tide-deck").notes = "黑潮压境版每轮都视为高风险事件，优先测试资源不足时是否仍有可恢复空间。";
    setRulebook(
      design,
      "六轮黑潮内共同维持稳定度并修复至少五座灯塔；玩家的个人声望仍决定最终排名。",
      "稳定度为 6；每席获得 3 补给、1 材料、0 能源、1 影响力。首轮必须建立能源或控制安全区域。",
      "这是压力测试配置，不作为基础教学局。若首轮后稳定度跌至 4 以下，说明事件与资源模型需要增加缓冲。"
    );
  } else if (presetId === "last-lighthouse-trade-route") {
    design.title = "最后灯塔：群岛商路";
    design.designGoal = "用贸易、区域控制和灯塔建设形成多条得分路线，验证经营型半合作。";
    design.playTimeMinutes = 35;
    setVariable(design, "stability", 8);
    setVariable(design, "supply", 2);
    setVariable(design, "material", 1);
    setVariable(design, "energy", 0);
    setVariable(design, "influence", 2);
    setStateField(design, "stability", "8 / 10");
    const trade = design.mechanisms.find((item) => item.id === "mechanism-trade");
    if (trade) trade.effects.find((effect) => effect.targetKey === "supply").value = "3";
    design.engine.actions.find((action) => action.id === "action-trade").description = "支付 1 材料，获得 3 补给与 1 声望。";
    design.engine.actions.find((action) => action.id === "action-secure-route").description = "支付 1 影响力，控制一个尚未被占领的区域，建立商路。";
    setRulebook(
      design,
      "在稳定度没有归零的前提下，通过贸易、商路和灯塔建设获得最高声望。",
      "稳定度为 8；每席获得 2 补给、1 材料、0 能源、2 影响力。贸易的补给收益提高，鼓励玩家先经营再建设。",
      "这是经济路线横向对照局，重点观察贸易是否成为有效替代，而不是所有玩家都走打捞—建设路线。"
    );
  } else if (presetId === "last-lighthouse-race") {
    design.title = "最后灯塔：灯火竞速";
    design.designGoal = "在较短赛程中抢先完成灯塔建设，验证公共目标下的个人竞速。";
    design.playTimeMinutes = 24;
    setVariable(design, "stability", 7);
    setVariable(design, "supply", 4);
    setVariable(design, "material", 1);
    setVariable(design, "energy", 0);
    setVariable(design, "influence", 1);
    setStateField(design, "stability", "7 / 10");
    design.engine.maxRounds = 6;
    design.engine.endConditions = [{ variableKey: "beacons", operator: "gte", value: 5 }];
    const build = design.mechanisms.find((item) => item.id === "mechanism-build-beacon");
    if (build) build.effects.find((effect) => effect.targetKey === "score").value = "4";
    design.engine.actions.find((action) => action.id === "action-build-beacon").description = "支付 2 材料与 1 能源，灯塔 +1、稳定度 +1、声望 +4。";
    setRulebook(
      design,
      "在六轮内抢先推动公共灯塔进度，同时用个人声望争夺最终胜者；第五座灯塔出现时立即进入结算。",
      "稳定度为 7；每席获得 4 补给、1 材料、0 能源、1 影响力。航行更宽裕，但修塔单次声望较低。",
      "这是竞速压力测试，重点观察先手、位置和修塔贡献是否造成不可逆领先。"
    );
  }
  return design;
}

