import { normalizeCreativeConstitution } from "../../shared/creative-constitution.js";
import { normalizeStorySpine } from "../../shared/story-spine.js";
import {
  formatMechanismDesignForPrompt,
  normalizeMechanismDesign,
} from "../../shared/mechanism-design.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function text(value, maxLength) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function lines(values, maxItems = 20) {
  return (Array.isArray(values) ? values : [])
    .slice(0, maxItems)
    .map((value) => text(value, 800))
    .filter(Boolean);
}

function appendSection(base, label, rows, maximum) {
  const content = (Array.isArray(rows) ? rows : [rows])
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!content) return text(base, maximum);
  const marker = `【${label}】`;
  const section = text(`${marker}\n${content}`, maximum);
  const original = text(base, maximum);
  if (original.includes(marker)) return original;
  const prefix = text(original, Math.max(0, maximum - section.length - 2));
  if (!prefix) return section;
  return `${prefix}\n\n${section}`;
}

function formatStorySpine(spine) {
  const core = [
    ["一句话故事", spine.logline.text],
    ["整体故事", spine.overview.text],
    ["开场状态", spine.openingState.text],
    ["引爆事件", spine.incitingIncident.text],
    ["核心冲突", spine.centralConflict.text],
    ["玩家参与理由", spine.playerPremise.text],
    ["机制循环", spine.mechanismLoop.text],
    ["真相与反转", spine.truthAndReversal.text],
  ].filter(([, value]) => value);
  const chapterRows = spine.chapterArc.map(
    (chapter) =>
      `${chapter.sequence}. ${chapter.title}｜起因：${chapter.cause}｜玩家行动：${chapter.playerAction}｜转折：${chapter.turn}｜后果：${chapter.consequence}`,
  );
  const endingRows = spine.endingDirections.map(
    (ending) =>
      `${ending.title}｜条件：${ending.requirements}｜后果：${ending.consequence}`,
  );
  return [
    ...core.map(([label, value]) => `${label}：${value}`),
    chapterRows.length ? `章节因果：\n${chapterRows.join("\n")}` : "",
    endingRows.length ? `累积结局：\n${endingRows.join("\n")}` : "",
  ].filter(Boolean);
}

function formatRoleFunctions(spine) {
  return spine.roleFunctions.map(
    (role) =>
      `${role.roleName}｜故事职能：${role.storyFunction}｜目标：${role.goal}｜压力：${role.pressure}`,
  );
}

function formatCreatorBrief(brief) {
  const sparks = (Array.isArray(brief.sparks) ? brief.sparks : [])
    .slice(0, 12)
    .map(
      (spark) => `${text(spark?.tag, 80) || "灵感"}：${text(spark?.text, 800)}`,
    )
    .filter((row) => !row.endsWith("："));
  return [
    lines(brief.sellingPoints, 6).length
      ? `核心卖点：${lines(brief.sellingPoints, 6).join("；")}`
      : "",
    brief.target ? `目标玩家：${text(brief.target, 600)}` : "",
    brief.duration ? `体验时长：${text(brief.duration, 200)}` : "",
    brief.type ? `作品类型：${text(brief.type, 400)}` : "",
    brief.magicNote ? `作者备注：${text(brief.magicNote, 1000)}` : "",
    ...sparks,
  ].filter(Boolean);
}

function formatConstitution(constitution) {
  return [
    constitution.theme ? `核心主题：${constitution.theme}` : "",
    constitution.experiencePromise
      ? `体验承诺：${constitution.experiencePromise}`
      : "",
    ...constitution.inviolablePrinciples.map((value) => `不可破坏：${value}`),
    ...constitution.fairPuzzlePromises.map((value) => `公平推理：${value}`),
    ...constitution.pacingPrinciples.map((value) => `节奏原则：${value}`),
    ...constitution.forbiddenTropes.map((value) => `禁止套路：${value}`),
    constitution.desiredDebates
      ? `希望争论：${constitution.desiredDebates}`
      : "",
    constitution.avoidMisunderstandings
      ? `避免误解：${constitution.avoidMisunderstandings}`
      : "",
  ].filter(Boolean);
}

/**
 * Carries author-confirmed Creator Cockpit material into every matrix pipeline
 * step. The wizard's compact setup remains first, while the cockpit acts as a
 * canon appendix instead of becoming disconnected data.
 */
export function applyCreatorContextToPipelineInput(
  input = {},
  settingsValue = {},
) {
  const settings = record(settingsValue);
  const brief = record(settings.creatorBrief);
  const spine = normalizeStorySpine(settings.storySpine);
  const constitution = normalizeCreativeConstitution(
    settings.creativeConstitution,
  );
  const mechanismDesign = normalizeMechanismDesign(settings.mechanismDesign);
  const synopsis = { ...record(input.synopsis) };
  const setting = { ...record(input.setting) };
  const config = { ...record(input.config) };
  const formattedBrief = formatCreatorBrief(brief);
  const formattedSpine = formatStorySpine(spine);
  const formattedMechanism = formatMechanismDesignForPrompt(mechanismDesign);

  synopsis.body = appendSection(
    synopsis.body,
    "创作驾驶舱·权威创作上下文",
    [
      formattedBrief.length
        ? `【产品与体验目标】\n${formattedBrief.join("\n")}`
        : "",
      formattedSpine.length
        ? `【作者已确认故事主轴】\n${formattedSpine.join("\n")}`
        : "",
      formattedMechanism.length
        ? `【创作驾驶舱·机制设计】\n${formattedMechanism.join("\n")}`
        : "",
    ],
    12_000,
  );
  synopsis.charactersSketch = appendSection(
    synopsis.charactersSketch,
    "创作驾驶舱·六人职能",
    formatRoleFunctions(spine),
    4_000,
  );
  synopsis.truthSketch = appendSection(
    synopsis.truthSketch,
    "创作驾驶舱·不可改写真相",
    spine.truthAndReversal.text,
    4_000,
  );
  synopsis.redHerringsSketch = appendSection(
    synopsis.redHerringsSketch,
    "创作驾驶舱·误导边界",
    constitution.avoidMisunderstandings,
    2_000,
  );
  setting.extraConflicts = appendSection(
    setting.extraConflicts,
    "创作驾驶舱·硬约束",
    formatConstitution(constitution),
    3_000,
  );
  setting.styleAnchor = appendSection(
    setting.styleAnchor,
    "创作驾驶舱·表达原则",
    constitution.voicePrinciples,
    2_000,
  );
  config.notes = [
    ...(Array.isArray(config.notes) ? config.notes : []),
    ...formattedBrief.map((row) => `驾驶舱：${row}`),
    ...formattedMechanism.slice(0, 3).map((row) => `机制设计：${row}`),
  ].slice(0, 12);

  return { ...input, setting, synopsis, config };
}
