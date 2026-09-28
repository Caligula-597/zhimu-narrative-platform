import { normalizeBoardGameDesign } from "./board-game-design.js";
import { compileBoardGameEngine } from "./board-game-engine.js";

export const BOARD_GAME_PORTING_VERSION = 1;

export const BOARD_GAME_PORTING_OPTIMIZATIONS = Object.freeze([
  { id: "authoritative-server", label: "服务器权威结算", keeps: "线下的行动顺序、资源支付、胜负判定", changes: "把结算从桌面主持人转为服务端原子命令", benefit: "防止不同客户端看到不同结果，并允许断线重连。" },
  { id: "deadline-auto-progress", label: "限时与自动推进", keeps: "超时等同于线下选择保留、跳过或主持人代处理", changes: "为每个待提交阶段设置服务器倒计时，超时执行安全自动行动", benefit: "避免一名玩家或 AI 卡死整局。" },
  { id: "private-public-projection", label: "公开与私密投影", keeps: "公开信息、手牌信息和结算日志的原有边界", changes: "同一份权威状态按观看席位生成不同快照", benefit: "AI 能读取公共局势，但不会越权读取对手手牌。" },
  { id: "deterministic-replay", label: "确定性随机与回放", keeps: "洗牌、翻牌和卡牌数量", changes: "给牌堆绑定种子，并保存每条带唯一 ID 的命令", benefit: "公平性测试、争议复盘和自动化回归都可重复。" },
  { id: "legality-guidance", label: "合法行动提示", keeps: "线下规则允许的目标与资源门槛", changes: "线上只展示当前席位合法目标，并在提交前再次校验", benefit: "降低误操作，不改变可执行策略空间。" },
  { id: "responsive-table", label: "响应式桌面", keeps: "中央棋盘、个人面板、牌面和日志的信息层级", changes: "移动端改为分区折叠、横向牌列和固定行动栏", benefit: "小屏仍能完整体验，不用把规则压缩成不可读数字。" }
]);

const RULEBOOK_FIELDS = Object.freeze(["objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"]);
const text = (value) => String(value ?? "").trim();

function componentEntryCount(components) {
  return components.reduce((total, component) => total + component.entries.length, 0);
}

function componentEntryQuantity(components) {
  return components.reduce((total, component) => total + component.entries.reduce((sum, entry) => sum + entry.quantity, 0), 0);
}

function referencedDeckIds(design) {
  const ids = new Set();
  for (const phase of design.engine.phases) if (phase.deckId) ids.add(phase.deckId);
  for (const action of design.engine.actions) if (action.deckId) ids.add(action.deckId);
  return ids;
}

function coverageItem(id, label, value) {
  return { id, label, expected: true, passed: Boolean(value) };
}

export function createBoardGamePortingReport(designValue, options = {}) {
  const design = normalizeBoardGameDesign(designValue);
  const compile = compileBoardGameEngine(design, design.playerCount.min);
  const omissions = [];
  const referencedDecks = referencedDeckIds(design);
  const decks = design.components.filter((component) => component.type === "deck");
  const rulebookCoverage = RULEBOOK_FIELDS.map((field) => coverageItem(`rulebook.${field}`, `说明书：${field}`, text(design.rulebook[field]).length >= 12));
  const componentCoverage = design.components.map((component) => coverageItem(
    `component.${component.id}`,
    `组件：${component.name}`,
    text(component.description).length >= 12 && text(component.playerAction).length >= 6
  ));
  const actionCoverage = design.engine.actions.map((action, index) => coverageItem(
    `action.${action.id}`,
    `行动：${action.label}`,
    text(action.description).length >= 12 && compile.issues.every((issue) => issue.path !== `engine.actions.${index}.phaseId`)
  ));
  const deckCoverage = decks.map((deck) => {
    const referenced = referencedDecks.has(deck.id);
    if (!referenced) omissions.push(`牌堆「${deck.name}」没有被任何线上阶段或行动消费。`);
    if (!deck.entries.length) omissions.push(`牌堆「${deck.name}」没有卡面条目。`);
    return coverageItem(`deck.${deck.id}`, `牌堆：${deck.name}`, referenced && deck.entries.length > 0);
  });
  const requiredCoverage = [...rulebookCoverage, ...componentCoverage, ...actionCoverage, ...deckCoverage];
  const hardCompileIssues = compile.issues.filter((issue) => issue.level === "error");
  hardCompileIssues.forEach((issue) => omissions.push(issue.message));
  const contentCoverage = {
    components: design.components.length,
    componentEntries: componentEntryCount(design.components),
    declaredEntryQuantity: componentEntryQuantity(design.components),
    decks: decks.length,
    executableDecks: decks.filter((deck) => referencedDecks.has(deck.id)).length,
    phases: design.engine.phases.length,
    actions: design.engine.actions.length,
    mechanisms: design.mechanisms.length
  };
  const complete = requiredCoverage.every((item) => item.passed) && hardCompileIssues.length === 0;
  return {
    version: BOARD_GAME_PORTING_VERSION,
    designId: options.designId || design.title,
    title: design.title,
    status: complete ? "complete" : "review_required",
    fidelity: {
      ruleSemantics: "preserved",
      contentAssets: "preserved",
      onlineExpression: "optimized",
      note: "线上优化只改变承载方式，不在未版本化的情况下改变费用、奖励、阶段顺序、结束条件或平局规则。"
    },
    coverage: contentCoverage,
    checks: requiredCoverage,
    omissions,
    preserved: [
      "组件名称、数量、卡面条目与描述",
      "席位、资源作用域、行动成本与目标合法性",
      "阶段顺序、同时提交、公开结算与轮转顺序",
      "结束条件、胜负比较与平局裁决",
      "确定性牌堆、个人手牌和公开日志"
    ],
    optimizations: BOARD_GAME_PORTING_OPTIMIZATIONS
  };
}

export function assertBoardGamePortingComplete(designValue, options = {}) {
  const report = createBoardGamePortingReport(designValue, options);
  if (report.status !== "complete") throw new Error(`${report.title} 的线上复刻验收未通过：${report.omissions.join("；")}`);
  return report;
}
