import test from "node:test";
import assert from "node:assert/strict";

import {
  diagnosePlayerScript,
  diagnoseScriptCollection,
  fingerprintScriptCollection,
  assessHumanLikeProse
} from "../../shared/prose-quality-gate.js";
import { buildMatrixDeAiPassMessages } from "../src/prompts/matrix-player-script.js";

const rejectedSample = `你没有签。

不是舍不得。你只是那阵子忙，三号机组刚换氟，两个老员工办退休，银行来查消防改造款。等这些事忙完，你会签。

你一直这么告诉自己。`;

const sceneSample = `离婚协议在柜台的玻璃板下压了三个月。今天唐远来交维修单，收银员把那叠纸一起抽出来，推到他手边。

“还差你一个名字。”

唐远捏着笔，没有碰协议。他先把维修单上的数字圈了一遍，又问：“三号机组的发票呢？”

收银员看了他一会儿，把协议翻回正面：“发票昨天就给你了。”

门外有人催缴费。唐远把笔帽扣上，拿走维修单，协议仍留在玻璃板上。`;

const compressedDialogueSample = `唐峥把存款截单压在手下，许青问：“你到底能拿多少？”

“五万。”

“上个月你说十三。”

“八万是手术押金。”`;

const callbackSample = `四张封面排在桌上。陈克填最终分配表时，手指一直压着那枚提交码，像怕别人抢。没人能抢走，码只认他的账号。

我的章也只认我。`;

const strategyMenuSample = `我可以把原会议簿拿出来，换周放承认这笔账。也可以继续压着不动，先让陈克补足医疗款。第三种办法是把存款贴进去。`;

const matrixSerializationSample = `像我有退休金，名字就该往上填。许青母亲那几年受过我的照应，不等于许青的房贷也该从我卡里走。她念漏了空置、漏水和提前退出中的哪一项，我就把章扣回掌心；念全了，我也还得算一遍每月买药以后剩多少。`;

test("scene-first gate blocks the exact self-explaining narration regression", () => {
  const result = diagnosePlayerScript(rejectedSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "corrective_thesis"));
  assert.ok(result.issues.some((issue) => issue.code === "self_explaining_narrator"));
});

test("scene-first gate accepts action and dialogue without explaining their meaning", () => {
  const result = diagnosePlayerScript(sceneSample);
  assert.equal(result.passed, true);
  assert.equal(result.summary.high, 0);
  assert.ok(result.metrics.sceneEvidenceRatio >= 0.5);
});

test("pov gate blocks first-person author analysis while allowing lived first-person action", () => {
  const lived = diagnosePlayerScript("我把柜门关上，说早扔了。女儿没再问。", { expectedPov: "first" });
  const explained = diagnosePlayerScript("我把柜门关上。我之所以不肯拿出来，是因为我始终无法面对过去。", { expectedPov: "first" });
  assert.equal(lived.passed, true);
  assert.equal(explained.passed, false);
  assert.ok(explained.issues.some((issue) => issue.code === "first_person_self_analysis"));
});

test("pov gate blocks narration switching between first and second person", () => {
  const first = diagnosePlayerScript("我把柜门关上。你站在门口没动。", { expectedPov: "first" });
  const second = diagnosePlayerScript("你把柜门关上。我站在门口没动。", { expectedPov: "second" });
  assert.ok(first.issues.some((issue) => issue.code === "mixed_narrative_pov"));
  assert.ok(second.issues.some((issue) => issue.code === "mixed_narrative_pov"));
});

test("conversation-shape gate blocks telegraphic question-answer ladders", () => {
  const result = diagnosePlayerScript(compressedDialogueSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "compressed_dialogue_ladder"));
});

test("reader-language gate blocks compressed pseudo-jargon and missing predicates", () => {
  const result = diagnosePlayerScript("我正在给猴王换腕子。半轮月掉到桌下，我捡起来，断口毛，针眼倒还齐。", { expectedPov: "first" });
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "compressed_trade_expression"));
});

test("paragraph-rhythm gate blocks six mechanically equal information blocks", () => {
  const result = diagnosePlayerScript(`我把旧账册摊在桌上，先找去年留下的折角。窗外有人催门，我没应声。纸页仍压在杯底。

周敏进来以后先看账册，又去摸抽屉上的锁。她问钥匙是谁拿的，我说不记得。她没有继续追问。

门口的脚步停了一阵，很快又绕到后窗。我把杯子挪开，露出下面的名字。最后一笔墨还没有干。

周敏把名字念了一遍，又把声音压低。她说外面的人就是来找这个。我让她先把窗帘拉严。

抽屉里只有两张收据和一截红线，钥匙并不在里面。周敏拿起红线看了看。我没有告诉她认得这个结。

后窗被敲了第三次，桌上的纸跟着震了一下。我把账册推给周敏，让她自己选。她却先问我准备去哪儿。`, { expectedPov: "first" });
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "template_paragraph_cadence"));
});

test("transition gate reports long prose that only hard-cuts between actions", () => {
  const result = diagnosePlayerScript(`我把账册摊在桌上，纸角压着一枚旧钥匙。门外有人敲了两次，我没有应声，只把钥匙收进袖口。

周敏推门进来，鞋底带着院里的泥。她看见桌上的账册，伸手翻到最后一页，把其中一个名字圈了起来。

我按住她的笔，问她从哪里听到这个名字。她抬眼看着我，嘴里说不记得，手却一直没有松开。

院门又响了一次，窗纸上映出两个人影。周敏把账册合上，抱进怀里，叫我先去把后窗插牢。

后窗下面放着一只木箱，锁眼里塞着半截红线。我抽出红线，认出是去年绑在货单上的那一根。

周敏蹲下来翻木箱，最底下只有两张收据。她把收据递给我，指着同一个名字，问我还准备瞒多久。

我没有回答，把后窗推开一条缝。巷口停着一辆没见过的车，车上的人正朝院门走。`, { expectedPov: "first" });
  assert.ok(result.issues.some((issue) => issue.code === "missing_transition_bridges"));
});

test("conversation-shape gate allows brief relational exchanges without field delivery", () => {
  const result = diagnosePlayerScript(`陈克站在门口，看着她从吊柜里摸出红布包。\n\n“找这个？”\n\n“晚上要用。”\n\n“你先把鞋换了。”\n\n他没换，只把公文包放到饭桌边。`);
  assert.equal(result.passed, true);
  assert.ok(!result.issues.some((issue) => issue.code === "compressed_dialogue_ladder"));
  assert.ok(!result.issues.some((issue) => issue.code === "manufactured_fragment_rhythm"));
});

test("conversation-shape gate blocks manufactured callback punchlines", () => {
  const result = diagnosePlayerScript(callbackSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "manufactured_callback_punchline"));
});

test("role-agency gate blocks strategy menus disguised as narration", () => {
  const result = diagnosePlayerScript(strategyMenuSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "strategy_menu_narration"));
});

test("scene gate blocks information matrices serialized as first-person prose", () => {
  const result = diagnosePlayerScript(matrixSerializationSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "matrix_serialization"));
});

test("scene gate allows the same dispute to emerge through a situated exchange", () => {
  const result = diagnosePlayerScript(`许青把合同转到罗姨面前。罗姨先把纸抽了回去：“别急着写我。我有退休金归我有退休金，总不能你这房贷也跟着从我卡里扣。你妈那几年，我跑人事科是我愿意，买房不是一回事。”\n\n许青把担保栏翻给她看：“我没让你还房贷。这里写的是漏水维修，你先听我念完。”`);
  assert.equal(result.passed, true);
  assert.ok(!result.issues.some((issue) => issue.code === "matrix_serialization"));
});

test("dialogue may contain a disputed phrase without being treated as narrator voice", () => {
  const result = diagnosePlayerScript(`周敏把申请表拍在桌上。“不是舍不得。你只是怕他们问到账。”\n\n你把表格推了回去。`);
  assert.equal(result.passed, true);
});

test("collection diagnostics identify the blocked role-act cell", () => {
  const result = diagnoseScriptCollection({
    role1: { act1: { body: sceneSample }, act2: { body: rejectedSample } }
  });
  assert.equal(result.passed, false);
  assert.equal(result.summary.blockedCells, 1);
  assert.equal(result.issues.find((issue) => issue.severity === "high")?.cell, "role1_act2");
});

test("script fingerprint is stable and changes after an edit", () => {
  const left = { role2: { act1: { body: "乙" } }, role1: { act1: { body: "甲" } } };
  const reordered = { role1: { act1: { body: "甲" } }, role2: { act1: { body: "乙" } } };
  const edited = { role1: { act1: { body: "甲改" } }, role2: { act1: { body: "乙" } } };
  assert.equal(fingerprintScriptCollection(left), fingerprintScriptCollection(reordered));
  assert.notEqual(fingerprintScriptCollection(left), fingerprintScriptCollection(edited));
});

test("repair prompt receives exact gate evidence and required action", () => {
  const diagnostics = diagnosePlayerScript(rejectedSample);
  const messages = buildMatrixDeAiPassMessages({
    body: rejectedSample,
    styleCard: {},
    targetWords: 600,
    repairFeedback: diagnostics.issues
  });
  const prompt = messages.map((message) => message.content).join("\n");
  assert.match(prompt, /机械门禁命中（必须修复后再复检）/);
  assert.match(prompt, /你一直这么告诉自己/);
  assert.match(prompt, /不要只替换触发词/);
});

test("upload assessment scores scene-based prose above self-explaining prose", () => {
  const rejected = assessHumanLikeProse(rejectedSample, { sections: [{ title: "坏段", body: rejectedSample }] });
  const sceneBased = assessHumanLikeProse(sceneSample, { sections: [{ title: "场景", body: sceneSample }] });
  assert.ok(sceneBased.score > rejected.score);
  assert.equal(rejected.level, "weak");
  assert.equal(rejected.gate.decision, "manual_review");
  assert.match(rejected.disclaimer, /不是作者身份或 AI 使用情况的鉴定/);
  assert.equal(sceneBased.confidence, "low");
  assert.equal(sceneBased.gate.decision, "manual_review");
  assert.match(sceneBased.gate.reason, /样本过短/u);
});
