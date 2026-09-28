/**
 * Design-only cross-mechanism choreography probe.
 * No Writer, no LLM, no new M01/M08 Gold. The output is the one-page review
 * artifact that must be judged before any authored production work continues.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryActChoreography } from "../shared/story-act-choreography-contract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const choreography = {
  version: 2,
  id: "M07-3-M01-FRAMING-M08-6-4ACT-DESIGN",
  status: "DESIGN_ONLY",
  authoredSlices: {
    m01: {
      sliceId: "M01-FRAMING:V02:CHOREOGRAPHY-SLICE",
      mechanismId: "M01-FRAMING",
      variantId: "V02",
      scope: "CHOREOGRAPHY_ONLY",
      initialInterpretation: "展柜和公开名册同时少了青铜镜，可以先合理理解为临时撤展；值班台的公开说明还没有显示流程被实质改动。",
      counterEvidence: {
        statement: "M07-3 在 act2 通过调查或交换任一路径打开的原始记录，把青铜镜放在待入库交接链上；公开撤展说明却只写临时调整，两种记录口径无法同时成立。",
        source: {
          mechanismId: "M07-3",
          actId: "act2",
          phase: "PAYOFF",
          outputRef: "m07-original-intake-chain-vs-public-withdrawal",
        },
      },
      reinterpretation: "第一幕的撕痕不再只是缺页痕迹；它也可能是把待入库风险伪装成普通撤展时留下的流程痕迹。",
      newQuestion: "如果临时撤展只是表面说法，谁需要让待入库风险看起来像普通撤展，而你手里的这一半记录为什么不能单独回答？",
      dependsOn: ["M07-3:act2:PAYOFF:m07-original-intake-chain-vs-public-withdrawal"],
    },
    m08: {
      sliceId: "M08-6:V01:CHOREOGRAPHY-SLICE",
      mechanismId: "M08-6",
      variantId: "V01",
      scope: "CHOREOGRAPHY_ONLY",
      sideAHas: "沈岚手里的公开撕痕、连续页码和独立核对结果，足以证明流程异常，却不能解释待入库记录为什么会被写成临时撤展。",
      sideBHas: "梁赫掌握调档窗口的记录背景和旧藏交接语境，足以解释原始记录的口径，却不能单独证明公开流程确实被人为改动。",
      mutualDependency: "任何一方都只有异常或语境的一半；只有把两半放在一起，才能区分普通撤展与被伪装的入库风险。",
      sharingBoundary: "沈岚只需交出页码、撕痕和核对结果，不必交出记忆来源；梁赫只需说明对应的交接语境，不必一次交出老师旧藏和被收回清单的全部细节。",
      timeWindow: "预展结束、公开名册和原始记录封存之前；窗口关闭后，双方只能留下各自无法互证的半份判断。",
      cooperationCanAdvance: "把公开版本与原始交接链对齐，确认哪一段流程需要被保护或伪装，并把问题交给下一阶段。",
      cooperationCannotResolve: "不能直接指出经手人、动机或最终结果，也不能替任何一方决定公开、指控或结盟。",
    },
  },
  acts: [
    {
      actId: "act1",
      label: "异常先落地，第一层解释形成",
      dramaticNeeds: ["让异常公开可见", "制造封存前的时间压力", "种下可被后续反证重解释的表面解释"],
      mechanismContributions: [
        { mechanismId: "M07-3", job: "把异常变成可观察、可获取的 Formation Seed", needsCovered: ["让异常公开可见"], output: "撕痕、缺页问题与两种入口进入公共视野" },
        { mechanismId: "M01-FRAMING", job: "提供暂时可信的表面解释", needsCovered: ["种下可被后续反证重解释的表面解释"], output: "临时撤展仍可成立，但不闭合" },
      ],
      sceneAffordances: [
        { sceneId: "exhibition-case", label: "展柜", affordances: ["公开观察", "前后状态差异", "物理痕迹", "多人可同时目击"], needsCovered: ["让异常公开可见"], mechanismIds: ["M07-3"], whyThisScene: "只有展柜同时呈现空位、残留痕迹和公开可见性，异常才不是角色私下声称。", deletionImpact: "删除展柜后，青铜镜消失只剩口述，公开异常与后续物理核验都失去起点。" },
        { sceneId: "public-desk", label: "值班台", affordances: ["公开名册", "多人共享观察", "原件不可带走", "封存倒计时"], needsCovered: ["制造封存前的时间压力"], mechanismIds: ["M07-3"], whyThisScene: "值班台把名册、核对规则和封存时间放在同一公共位置。", deletionImpact: "删除值班台后，时间压力和公共核对入口消失，M07 Seed 不能以同样方式成立。" },
      ],
      payoff: "—（开场幕，无上一幕悬念）",
      reveal: "公开名册和展柜同时缺少青铜镜；页码连续，却留下新的装订撕痕，且记录即将封存。",
      causalChain: {
        payoffToReveal: "开场把‘临时撤展’放在桌面上，但撕痕和封存时限让它无法成为完整答案。",
        revealToShift: "异常从物件消失升级为公开流程可能被动过，核对窗口成为现实压力。",
        shiftToHook: "正因为流程可能被动过，玩家才会追问：消失的究竟是一件展品，还是一页记录？",
      },
      shift: { knowledge: "从‘青铜镜被撤展’变成‘公开流程可能被动过’", stakes: "核对窗口有明确时限" },
      hook: "消失的究竟只是一件展品，还是一页本该存在的记录？",
      beats: [
        { mechanismId: "M07-3", variantId: "V01", phase: "SEED", purpose: "让异常可见并开放两种获取入口", authored: true },
        { mechanismId: "M01-FRAMING", variantId: "V02", phase: "FORESHADOW", purpose: "让‘临时撤展’成为第一层可相信但不稳的解释", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M01-FRAMING:V02:CHOREOGRAPHY-SLICE" },
      ],
      gameWindow: "可选：公开观察/物件核验只负责把异常落到桌面，不提前给出结论。",
    },
    {
      actId: "act2",
      label: "M07 部分兑现，旧解释被撞开",
      dramaticNeeds: ["回收异常并确认记录确实存在", "让表面解释出现可核对的裂缝", "让获取事实付出资格或时间成本"],
      mechanismContributions: [
        { mechanismId: "M07-3", job: "通过调查或交换任一路径取得同一份原始记录", needsCovered: ["回收异常并确认记录确实存在"], output: "缺页与青铜镜的对应关系被确认" },
        { mechanismId: "M01-FRAMING", job: "把原始记录中的口径冲突激活为反证压力", needsCovered: ["让表面解释出现可核对的裂缝"], output: "临时撤展无法解释待入库记录" },
        { mechanismId: "GAME-DOCUMENT-CHECK", job: "让玩家承担一次获取/核验成本", needsCovered: ["让获取事实付出资格或时间成本"], output: "谁先看见哪一层记录成为桌面结果" },
      ],
      sceneAffordances: [
        { sceneId: "public-desk", label: "值班台", affordances: ["版本对照", "逐项核验", "公开规则", "原件不可带走"], needsCovered: ["回收异常并确认记录确实存在"], mechanismIds: ["M07-3"], whyThisScene: "调查路径需要一个公共、受限、能把页码/编号/撕痕放在一起比对的位置。", deletionImpact: "删除值班台后，调查路径只剩抽象‘去查’，无法产生版本不一致这个具体揭示。" },
        { sceneId: "archive-window", label: "调档窗口", affordances: ["资格门槛", "用途说明", "记录留痕", "窗口关闭时间"], needsCovered: ["让获取事实付出资格或时间成本", "让表面解释出现可核对的裂缝"], mechanismIds: ["M07-3", "M01-FRAMING", "GAME-DOCUMENT-CHECK"], whyThisScene: "交换路径的成本不是旁白宣布，而是角色必须在窗口前说明用途并留下可追溯记录。", deletionImpact: "删除调档窗口后，交换路径变成无成本取资料，M07 的 A/B 差异、M01 的记录矛盾和时间压力同时变弱。" },
      ],
      payoff: "M07 的调查或交换任一路径都能打开同一份原始记录，确认缺页与青铜镜相关。",
      reveal: "【M01 设计候选】原始记录把青铜镜放在待入库的交接链上，而公开撤展说明只写临时调整；时间与记录口径对不上。",
      causalChain: {
        payoffToReveal: "M07 先回答‘缺页是否真实’，这个答案把原始记录中的待入库状态带到台面上。",
        revealToShift: "待入库记录与临时撤展说法冲突，玩家对第一幕的解释从合理变成有人在遮盖别的流程。",
        shiftToHook: "旧解释出现裂缝后，新的问题不再是怎么查，而是谁需要让一条入库风险看起来像普通撤展。",
      },
      shift: { knowledge: "从‘有异常’变成‘有人把记录移出公开流程’", interpretation: "临时撤展不再足以解释全部事实", access: "至少一条合法路径已经打开原始记录" },
      hook: "如果这份原始记录是真的，那么第一幕里谁对什么事实说得不完整？",
      beats: [
        { mechanismId: "M07-3", variantId: "V01", phase: "PAYOFF", purpose: "交付缺页与青铜镜的对应关系", authored: true },
        { mechanismId: "M01-FRAMING", variantId: "V02", phase: "ACTIVATION", purpose: "把 M07 结果转成第一层解释的反证入口", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M01-FRAMING:V02:CHOREOGRAPHY-SLICE", handoffTo: "M01-FRAMING" },
        { mechanismId: "M07-3", variantId: "V01", phase: "HANDOFF", purpose: "把‘查到了’交棒成‘原来的理解可能错了’", authored: true, handoffTo: "M01-FRAMING" },
      ],
      gameWindow: "若插入 GAME，应承担一次获取/核验过程，并让结果直接产生 M01 的冲突，不单独延长查档。",
    },
    {
      actId: "act3",
      label: "M01 翻转，M08 关系条件出现",
      dramaticNeeds: ["推翻第一层解释但不交付完整真相", "制造不对称知识", "让有限合作成为当前唯一能补齐信息的方式"],
      mechanismContributions: [
        { mechanismId: "M01-FRAMING", job: "用反证重解释第一幕旧事实", needsCovered: ["推翻第一层解释但不交付完整真相"], output: "撕痕从缺页痕迹变成可能的流程伪装" },
        { mechanismId: "M08-6", job: "把两名角色的互补信息变成有限共享条件", needsCovered: ["制造不对称知识", "让有限合作成为当前唯一能补齐信息的方式"], output: "各自掌握一半，合作可推进但不能解决责任与动机" },
      ],
      sceneAffordances: [
        { sceneId: "side-corridor", label: "展厅侧廊", affordances: ["半公开交谈", "可被旁人看见但听不全", "短暂私密窗口"], needsCovered: ["制造不对称知识"], mechanismIds: ["M08-6"], whyThisScene: "有限合作需要一个既不能完全公开、又不能完全隔绝旁观的地点。", deletionImpact: "删除侧廊后，共享要么变成公开广播，要么变成无旁观风险的私聊，M08 的有限性消失。" },
        { sceneId: "archive-window", label: "调档窗口", affordances: ["可核验原件", "资格记录", "共享范围可控制"], needsCovered: ["让有限合作成为当前唯一能补齐信息的方式"], mechanismIds: ["M08-6", "M01-FRAMING"], whyThisScene: "两人的信息只有在同一份原始记录前短暂对照，才会暴露互补关系。", deletionImpact: "删除窗口后，两人可以泛泛谈合作，却没有必须共享的具体对象。" },
      ],
      payoff: "M01 的反证排除或改写第一层嫌疑；玩家不再只追问‘谁拿走了’，还要重新解释此前看过的证据。",
      reveal: "两名角色各自掌握对方无法单独取得的一半信息或资源；共享有现实收益，也有暴露代价。具体关系事实由 M08-6 Gold 提供。",
      causalChain: {
        payoffToReveal: "M01 的反证不提供完整真相，只排除第一层解释，并留下必须从另一方取得的缺口。",
        revealToShift: "信息缺口与各自掌握的资源互补，使关系从互相怀疑变成不得不计算共享成本。",
        shiftToHook: "既然对方手里有唯一能补上的一半，问题就变成：你愿意拿什么换取有限的相信？",
      },
      shift: { suspicion: "第一层嫌疑被削弱或转移", relationship: "双方从互相可疑变成可能互补但不可信任", stakes: "继续追查开始牵动个人声誉或旧关系" },
      hook: "如果只有对方手里的那一半能解释新反证，为什么要把最不想说的部分交出去？",
      beats: [
        { mechanismId: "M01-FRAMING", variantId: "V02", phase: "PAYOFF", purpose: "用反证改变第一幕事实的意义", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M01-FRAMING:V02:CHOREOGRAPHY-SLICE" },
        { mechanismId: "M08-6", variantId: "V01", phase: "SEED", purpose: "形成有时限、有限共享范围的临时合作理由", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M08-6:V01:CHOREOGRAPHY-SLICE", handoffTo: "M08-6" },
        { mechanismId: "M01-FRAMING", variantId: "V02", phase: "HANDOFF", purpose: "把‘错误嫌疑’交棒成‘必须处理关系’", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M01-FRAMING:V02:CHOREOGRAPHY-SLICE", handoffTo: "M08-6" },
      ],
      gameWindow: "可选：让玩家通过一次不完全公开的核验决定共享哪一半信息，不替角色完成结盟。",
    },
    {
      actId: "act4",
      label: "关系压力汇流，第一幕被重新解释",
      dramaticNeeds: ["让有限合作承担现实代价", "把 M07/M01/M08 的结果汇成更大的问题", "留下一个具体而非泛化的下一问"],
      mechanismContributions: [
        { mechanismId: "M08-6", job: "让共享范围和退出代价压到当前关系上", needsCovered: ["让有限合作承担现实代价"], output: "沉默、公开和继续共享各有代价" },
        { mechanismId: "M08-6", job: "用有限共享把两半信息短暂接上", needsCovered: ["把 M07/M01/M08 的结果汇成更大的问题"], output: "谁承担记录风险、谁保护哪段流程变得可见" },
        { mechanismId: "M07-3", job: "把已确认记录交棒给下一个主线问题", needsCovered: ["留下一个具体而非泛化的下一问"], output: "问题转向谁需要伪装入库风险" },
      ],
      sceneAffordances: [
        { sceneId: "sealed-record-table", label: "封存前的记录桌", affordances: ["两份记录并置", "共同可见但可控制共享范围", "封条/收档倒计时"], needsCovered: ["让有限合作承担现实代价", "把 M07/M01/M08 的结果汇成更大的问题"], mechanismIds: ["M07-3", "M08-6"], whyThisScene: "跨机制汇流必须发生在两份记录同时可见、但马上会被收走的具体位置。", deletionImpact: "删除记录桌后，汇流只能靠人物口头总结，封存压力和共享代价不再具有物理载体。" },
      ],
      payoff: "M08 的共享范围与退出代价变成桌面上的现实压力；M01 的反证和 M07 的原始记录互相咬合。",
      reveal: "第一幕的异常不再只是缺页事件，而暴露出谁能接触公开流程、谁承担记录风险、谁可能从中获益的更大问题。",
      causalChain: {
        payoffToReveal: "有限合作迫使两半信息短暂对接，M07 的记录、M01 的反证和人物各自的风险首次放在同一张桌上。",
        revealToShift: "问题从‘谁拿走了缺页’扩大为‘谁需要把入库风险伪装成撤展，以及谁被迫替它承担代价’。",
        shiftToHook: "旧事实获得新意义后，幕尾留下一个具体追问：真正被隐藏的是缺页，还是借缺页保护的关系与利益？",
      },
      shift: { relationship: "临时合作可以成立，但信任与共享范围仍未锁死", stakes: "沉默和公开各自带来具体代价", interpretation: "第一幕的撕痕/缺页获得新的解释层" },
      hook: "真正被隐藏的究竟是缺页本身，还是借缺页保护的那段关系与利益？",
      beats: [
        { mechanismId: "M08-6", variantId: "V01", phase: "PRESSURE", purpose: "让有限共享和退出成本压迫当前关系", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M08-6:V01:CHOREOGRAPHY-SLICE" },
        { mechanismId: "M08-6", variantId: "V01", phase: "CROSS_MECHANISM", purpose: "让关系压力把 M01 反证与 M07 原始记录重新咬合", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M08-6:V01:CHOREOGRAPHY-SLICE" },
        { mechanismId: "M07-3", variantId: "V01", phase: "HANDOFF", purpose: "把确认的记录交给下一个主线问题，而不是继续写 M07 余波", authored: true },
      ],
      gameWindow: "GAME 结果可以决定公开/保留哪一层信息，但不直接结算真相或关系终局。",
    },
  ],
};

function render(report) {
  const { m01, m08 } = report.choreography.authoredSlices;
  const lines = [
    "# M07-3 × M01-FRAMING × M08-6 · Act Choreography V2",
    "",
    "> DESIGN_ONLY：这里只包含 M01/M08 为四幕编排补的 authored slice，不代表完整机制 Gold。未通过结构审查前不得进入 Writer。",
    "",
    `**编排校验：** ${report.code} · ${report.issues.length ? `${report.issues.length} 个结构问题` : "无结构问题"} · **Writer readiness：${report.writerReady ? "READY" : "BLOCKED（DESIGN_ONLY）"}**`,
    "",
    "| 幕 | 回收（PAYOFF） | 新揭示（REVEAL） | 机制交接 | 幕尾钩子（HOOK） |",
    "|---|---|---|---|---|",
  ];
  for (const act of report.choreography.acts) {
    lines.push(`| ${act.actId} · ${act.label} | ${act.payoff} | ${act.reveal} | ${act.beats.map((beat) => `${beat.mechanismId} ${beat.phase}`).join("；")} | ${act.hook} |`);
  }
  lines.push("", "## Act Choreography V2 · 需求 × 机制职责 × 场景能力", "");
  lines.push("| 幕 | Dramatic Need | Mechanism Job | Scene Affordance | 删除后影响 |", "|---|---|---|---|---|");
  for (const act of report.choreography.acts) {
    const needs = act.dramaticNeeds.join("；");
    const jobs = act.mechanismContributions.map((item) => `${item.mechanismId}：${item.job}`).join("；");
    const scenes = act.sceneAffordances.map((item) => `${item.label}：${item.affordances.join("、")}`).join("；");
    const impacts = act.sceneAffordances.map((item) => `${item.label}：${item.deletionImpact}`).join("；");
    lines.push(`| ${act.actId} | ${needs} | ${jobs} | ${scenes} | ${impacts} |`);
  }
  lines.push("", "## 每幕 State Shift", "");
  for (const act of report.choreography.acts) {
    lines.push(`### ${act.actId}`, "", `- knowledge：${act.shift.knowledge || "—"}`, `- suspicion：${act.shift.suspicion || "—"}`, `- relationship：${act.shift.relationship || "—"}`, `- stakes：${act.shift.stakes || "—"}`, `- access：${act.shift.access || "—"}`, `- interpretation：${act.shift.interpretation || "—"}`, `- GAME 窗口：${act.gameWindow || "—"}`, "");
  }
  lines.push("## 因果链检查", "");
  for (const act of report.choreography.acts) {
    lines.push(`### ${act.actId}`, "", `- PAYOFF → REVEAL：${act.causalChain.payoffToReveal}`, `- REVEAL → SHIFT：${act.causalChain.revealToShift}`, `- SHIFT → HOOK：${act.causalChain.shiftToHook}`, "");
  }
  lines.push(
    "## M01 / M08 最小编排素材（DESIGN_ONLY）",
    "",
    "### M01-FRAMING / V02 · authored slice（非完整 Gold）",
    "",
    `- initialInterpretation：${m01.initialInterpretation}`,
    `- counterEvidence：${m01.counterEvidence.statement}`,
    `- counterEvidence source：${m01.counterEvidence.source.mechanismId} / ${m01.counterEvidence.source.actId} / ${m01.counterEvidence.source.phase} / ${m01.counterEvidence.source.outputRef}`,
    `- reinterpretation：${m01.reinterpretation}`,
    `- newQuestion：${m01.newQuestion}`,
    `- dependency：${m01.dependsOn.join("；")}`,
    "",
    "### M08-6 / V01 · authored slice（非完整 Gold）",
    "",
    `- sideAHas：${m08.sideAHas}`,
    `- sideBHas：${m08.sideBHas}`,
    `- mutualDependency：${m08.mutualDependency}`,
    `- sharingBoundary：${m08.sharingBoundary}`,
    `- timeWindow：${m08.timeWindow}`,
    `- cooperationCanAdvance：${m08.cooperationCanAdvance}`,
    `- cooperationCannotResolve：${m08.cooperationCannotResolve}`,
    "",
  );
  lines.push("## 当前阻塞", "", ...report.issues.map((issue) => `- ${issue.code}${issue.mechanismId ? `：${issue.mechanismId}` : ""}`));
  return lines.join("\n");
}

const report = validateStoryActChoreography(choreography);
const out = path.join(ROOT, "captures", "story-formation-showcase", "m07-3-choreography-probe");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "four-act-choreography.md"), `${render(report)}\n`, "utf8");
fs.writeFileSync(path.join(out, "four-act-choreography.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outDir: path.relative(ROOT, out), code: report.code, issues: report.issues.length, acts: report.choreography.acts.length }, null, 2));
