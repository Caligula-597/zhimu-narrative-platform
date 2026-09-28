/**
 * Design-only Live Event Spine probe.
 *
 * These are event candidates, not new Canon and not Writer input. The probe
 * exists to force the story to specify what happens live in each act before
 * mechanisms are attached to the event chain.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLiveEventSpine } from "../shared/story-live-event-spine-contract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const spine = {
  version: 1,
  id: "M07-3-LIVE-EVENT-SPINE-DESIGN",
  status: "DESIGN_ONLY",
  events: [
    {
      eventId: "live-act1-public-sealing-alert",
      actId: "act1",
      title: "封存程序当场提前启动",
      eventType: "LIVE_EVENT",
      status: "PROPOSED_DESIGN_ONLY",
      whatHappens: "在玩家注意到展柜与公开名册不一致后，馆方当场宣布相关记录提前进入封存，值班台不再按原计划开放核对。",
      cause: "开场异常被多人同时看见，馆方需要立即控制公开记录的流动。",
      immediateImpact: "玩家不再拥有充裕的公共核对时间；现场所有人都知道记录状态发生了变化。",
      playerResponseWindow: ["在封存前公开核对现有名册", "寻找仍能接触原始记录的合法入口"],
      persistentConsequence: "Act 2 的调查与交换都必须在受限窗口内进行，且谁先行动会改变谁先接触记录。",
      nextEventTrigger: "受限核对或调档申请触发记录窗口的处理动作。",
      stateChanges: [
        { dimension: "access", before: "公开名册可按原计划核对", after: "公开核对窗口被提前收紧" },
        { dimension: "stakes", before: "异常可以慢慢确认", after: "封存成为即时压力" },
      ],
    },
    {
      eventId: "live-act2-record-access-tightens",
      actId: "act2",
      title: "核对行为让记录处理进入不可逆阶段",
      eventType: "LIVE_EVENT",
      status: "PROPOSED_DESIGN_ONLY",
      whatHappens: "玩家的公开核对或调档申请被现场处理；窗口方必须在封存前决定一份记录是否继续留在可见流程中。",
      cause: "Act 1 的提前封存把原本静态的查档变成了现场的权限与时间处置。",
      immediateImpact: "某一层记录的可见性、接触资格或留痕风险发生变化，行动不再只是取得同一答案的不同按钮。",
      playerResponseWindow: ["承担留痕和资格成本继续核对", "放弃当前入口，保留另一条尚未关闭的获取方式"],
      persistentConsequence: "Act 3 的角色关系会携带不同的暴露风险与信息先手，且至少一条入口会被关闭或变得更昂贵。",
      nextEventTrigger: "记录可见性变化与 M07 Payoff 的口径冲突共同触发第一层解释的崩塌。",
      stateChanges: [
        { dimension: "access", before: "两条获取入口都可尝试", after: "至少一条入口被收紧或留下处理痕迹" },
        { dimension: "exposure", before: "行动不会立刻留下身份风险", after: "谁申请、谁核对开始可被追溯" },
      ],
      triggeredByEventId: "live-act1-public-sealing-alert",
    },
    {
      eventId: "live-act3-partial-share-becomes-visible",
      actId: "act3",
      title: "有限共享被第三方看见",
      eventType: "LIVE_EVENT",
      status: "PROPOSED_DESIGN_ONLY",
      whatHappens: "两人为了对齐各自掌握的一半记录而进行有限共享，但侧廊或窗口规则让这次共享留下可被旁人察觉的痕迹。",
      cause: "Act 2 的记录处理改变了双方各自的先手与风险，单独持有半份信息已经不足以继续解释冲突。",
      immediateImpact: "合作不再只是私下意愿：共享本身改变了两人的暴露程度和彼此信任。",
      playerResponseWindow: ["只共享能推进核验的最小部分", "拒绝共享并承担无法互证的代价"],
      persistentConsequence: "Act 4 汇流时，双方必须处理已经发生的暴露与不对称，而不是从零开始决定是否合作。",
      nextEventTrigger: "共享痕迹与封存倒计时叠加，迫使双方在同一张记录桌前处理后果。",
      stateChanges: [
        { dimension: "relationship", before: "互相怀疑但仍可保持距离", after: "有限合作已被现实痕迹绑定" },
        { dimension: "exposure", before: "双方私有信息尚未形成公共风险", after: "共享行为本身留下可追溯风险" },
      ],
      triggeredByEventId: "live-act2-record-access-tightens",
    },
    {
      eventId: "live-act4-sealing-forces-disposition",
      actId: "act4",
      title: "封存时刻迫使记录进入处置",
      eventType: "LIVE_EVENT",
      status: "PROPOSED_DESIGN_ONLY",
      whatHappens: "封存真正开始，摆在记录桌上的两份材料必须被公开、保留、转交或收回其中一种；现场不再允许无限期保留中间状态。",
      cause: "Act 3 的有限共享已经把两半信息与各自风险带到同一张桌上，封存时间成为不可回避的现实后果。",
      immediateImpact: "玩家必须面对一项会改变公开程度、关系风险或后续访问权的现场处置。",
      playerResponseWindow: ["推动一层信息进入公开流程", "保留信息并承担被收回、失去入口或关系破裂的代价"],
      persistentConsequence: "下一阶段继承的不是‘缺页已确认’，而是记录被如何处置、谁承担了代价以及谁仍保有访问权。",
      nextEventTrigger: "记录处置结果把 M07 的过去真相与下一阶段的现实冲突接在一起。",
      stateChanges: [
        { dimension: "resource", before: "两份记录仍可并置核对", after: "至少一份记录的公开权或访问权发生不可逆变化" },
        { dimension: "relationship", before: "有限合作尚可撤回", after: "处置结果让沉默、公开或转交成为关系事实" },
      ],
      triggeredByEventId: "live-act3-partial-share-becomes-visible",
    },
  ],
};

function render(report) {
  const lines = [
    "# M07-3 · Live Event Spine V1",
    "",
    "> PROPOSED_DESIGN_ONLY：以下四项是现场事件候选，不是当前 Canon、不是 Writer 输入，也没有进入 Runtime。",
    "",
    `**校验：** ${report.code} · structureReady=${report.structureReady} · liveEventReady=${report.liveEventReady}`,
    "",
    "| 幕 | 现场真正发生什么 | 为什么现在发生 | 当场改变什么 | 玩家响应窗口 | 持续后果 | 下一事件触发 |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const event of report.spine.events) {
    lines.push(`| ${event.actId} · ${event.title} | ${event.whatHappens} | ${event.cause} | ${event.immediateImpact} | ${event.playerResponseWindow.join("；")} | ${event.persistentConsequence} | ${event.nextEventTrigger} |`);
  }
  lines.push("", "## State changes", "", "| 事件 | 维度 | 之前 | 之后 |", "|---|---|---|---|");
  for (const event of report.spine.events) {
    for (const change of event.stateChanges) {
      lines.push(`| ${event.eventId} | ${change.dimension} | ${change.before} | ${change.after} |`);
    }
  }
  lines.push("", "## 当前审查项", "", ...report.issues.map((issue) => `- ${issue.code}：${issue.eventId || issue.count || ""}`));
  return lines.join("\n");
}

const report = validateLiveEventSpine(spine);
const out = path.join(ROOT, "captures", "story-formation-showcase", "m07-3-live-event-spine");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "live-event-spine.md"), `${render(report)}\n`, "utf8");
fs.writeFileSync(path.join(out, "live-event-spine.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outDir: path.relative(ROOT, out), code: report.code, structureReady: report.structureReady, liveEventReady: report.liveEventReady, issues: report.issues.length, events: report.spine.events.length }, null, 2));

