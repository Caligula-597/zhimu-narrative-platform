/** Red-team a new premise without loading any prior story artefacts. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requestDeepseekJson } from "../src/deepseek-client.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(backendRoot, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const premise = {
  workingTitle: "未归还",
  format: "4 名玩家 / 60–90 分钟 / 3 幕 / 当代现实悬疑",
  setting: "一座运营二十余年的社区图书馆将在今晚闭馆搬迁。午夜前，四人必须签署新馆的冠名资助与馆藏移交协议。",
  playerPromise: "查清一段被简化成个人英雄传奇的公共记忆，并决定谁应当为保存真相付出代价。",
  objectiveMystery: "1998 年洪水抢救馆藏时，一批未登记的工人口述史为何没有进入正式馆藏；谁真正组织了救书；创馆人为何在后来的公开叙事中独占功劳。",
  presentPressure: "资助方只在保留创馆人冠名与现有英雄叙事时出资；不签约，新馆至少停摆一年。午夜后旧馆封存，档案处置权转移。",
  coreTruthDraft: [
    "临时编目员何岚掌握书库结构并组织居民搬书，创馆人沈启明调来厂车并承担了违规调车责任；救援是集体行动。",
    "第 17 箱装着工人对一次职业伤害事件的口述记录。沈启明为了让一份住房安置协议顺利签署，要求暂不入库；何岚担心材料被销毁，将整箱带走保管。",
    "沈启明次日接受了媒体的个人英雄报道，也用这份名望筹建图书馆；他同时替何岚签了‘洪水遗失’记录，使她没有因擅自带走公共材料被追责。",
    "沈启明多年后录下承认共同救援与第 17 箱去向的磁带，准备在安置完成后归还叙事，但没有真正公开。"
  ],
  roles: [
    "代理馆长：必须保住新馆；曾在资助申请中把英雄故事写成已核实事实；掌握馆藏与签约权限。",
    "创馆人后代兼资助方代表：希望保住祖辈名誉，也知道一封未公开的道歉信；能决定资助条款是否调整。",
    "口述史编辑：靠创馆传奇做出成名作品，最近才拿到原始磁带；能立刻公开，但曾剪掉不利片段。",
    "文献修复师兼何岚的外孙女：要求归还外祖母的名字；家中保存第 17 箱多年；能交出实物，却害怕家人被视为盗取馆藏。"
  ],
  endingDrafts: [
    "保留旧叙事并签约，新馆按期开张。",
    "四人共同承担名誉、职业、资金与法律代价，完成双重署名、完整入藏和修改资助条款。",
    "立即公开全部材料，资助终止、旧馆封存，但被抹去的口述史回到公共视野。",
    "若建立足够社区支持与替代资源，则拒绝冠名、共同接管新馆。"
  ]
};

const system = `你是互动叙事的逻辑编辑、游戏主持和事实核查员。只审查给定的新立项，不得引用或联想任何旧剧本。
要求极端挑剔：玩家是否都有行动权，事实是否可由证据推出，秘密是否只是拖延，选择是否真的有代价，时间压力是否合理，结局是否能由游戏状态决定。
不要润色文案，不写正文，不替作者掩饰漏洞。输出 JSON。`;

const user = `对以下立项进行红队审查：${JSON.stringify(premise)}

输出字段：
- verdict: keep / rebuild / reject
- strengths: 最多6项
- fatalIssues: 会让游戏失效的硬伤
- logicQuestions: 至少12个必须回答的问题
- roleAgencyAudit: 4项，逐角色审查目标、独占信息、主动手段、最终决定权、可能沦为陪衬的风险
- evidenceAudit: 建议10条可验证证据，每条写事实命题、载体、谁先拿到、能证明什么、不能单独证明什么
- endingAudit: 逐结局列必要条件、代价、是否可信
- sensitivityRisks: 现实议题与表达风险
- repairPlan: 按优先级列出不超过10项修复动作
- forbiddenShortcuts: 至少8项后续写作绝不能使用的偷懒手法`;

const result = await requestDeepseekJson(
  [{ role: "system", content: system }, { role: "user", content: user }],
  {
    maxTokens: 12000,
    temperature: 0.25,
    timeoutMs: 180000,
    phase: "original_showcase_premise_red_team",
    retryOnJsonParse: true,
    transportRetries: 2
  }
);

console.log(JSON.stringify({ model: result.model, usage: result.usage, ...result.value }, null, 2));
